import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';
import { chromium, type Page } from 'playwright';

// Helper to open brands page and collect brand names
async function collectBrands(): Promise<string[]> {
  try {
    const html = await fetchHtml('https://xplosiv.nz/brands');
    const $ = cheerio.load(html);

    const names = new Set<string>();

    $('.ambrands-brand-item a.ambrands-inner').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (!/\/brand(s)?\//i.test(href)) return;

      // Grab the label span
      const $label = $(el).find('.ambrands-label').first();

      // Remove the count span, then read text
      const labelText = $label.clone().find('.ambrands-count').remove().end().text().trim();

      if (labelText) {
        names.add(labelText);
      }
    });

    return [...names];
  } catch (e) {
    console.error('collectBrands failed:', e);
    return [];
  }
}

// Helper to open product page and collect flavour names
async function collectFlavours(url: string, page: Page): Promise<string[]> {
  // Wait for product page to load with a 30s timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Retry page if verification block
  const title = (await page.title().catch(() => '')) || '';
  if (/just a moment|verify you are human|attention required/i.test(title)) {
    await page.waitForTimeout(12000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // retry once
  }

  const selectOptions = page.locator(
    'select[name^="super_attribute"] option[value]:not([value=""])'
  );

  // Wait up to 5s for UI to appear
  await Promise.race([selectOptions.first().waitFor({ state: 'attached', timeout: 5000 })]).catch(
    () => {}
  );

  // Extract flavour labels
  const labels = await selectOptions.allInnerTexts().catch(() => []);

  // Merge into an array and clean out 'choose an option' label
  const out = Array.from(
    new Set([...labels].map((t) => t.trim()).filter((t) => t && !/choose an option/i.test(t)))
  );

  return out;
}

// Helper to split brand from name using known brands list
function splitBrandFromName(
  scrapedName: string,
  knownBrands: string[]
): { brand: string | null; baseName: string } {
  let base = scrapedName.trim().replace(/\s+/g, ' ');
  let found: string | null = null;

  for (const rawBrand of knownBrands) {
    const brand = rawBrand.trim();
    if (!brand) continue;

    // Brand at start of string
    const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(base)) {
      found = brand;
      // Remove brand from base name
      base = base
        .replace(re, '')
        .replace(/^\s*-\s*/, '')
        .trim();
      break;
    }
  }

  return { brand: found, baseName: base };
}

export const scrapeNoWheyProtein = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl = 'https://nowhey.co.nz/';
  const products: Product[] = [];
  const errors: string[] = [];
  const knownBrands = (await collectBrands()).map((b) => b.trim()).filter(Boolean);
  // Browser for scraping flavours for each product
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-gpu',
    ],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
  });
  const page = await context.newPage();

  let flavoursChecked = 0;
  let flavoursFound = 0;

  const html = await fetchHtml(baseUrl);

  // Loading HTML into cheerio
  const $ = cheerio.load(html);
  // console.log('HTML length:', html.length);
  // console.log('HTML preview:\n', html.slice(0, 1500));

  const $cards = $('.deal_body'); // cheerio collection of product cards
  console.log(`Product cards found: ${$cards.length}`);
  if ($cards.length === 0) {
    await browser.close();
    return { products, errors };
  }

  // Loop through the cards
  for (const [index, element] of $cards.toArray().entries()) {
    // Testing runtime limit
    if (process.env.SCRAPE_TESTING === '1') {
      const maxRuntime = Number(process.env.MAX_MS || 0);
      if (maxRuntime && Date.now() - startTime > maxRuntime) break;
    }

    try {
      const $card = $(element); // Make a Cheerio wrapper
      const href = $card.find('a').attr('href');
      if (!href) throw new Error('missing href on product card');
      const productUrl = new URL(href, baseUrl).toString(); // Find the product page from card

      // Scraped fields
      // eg:
      //  <div class="deal_title">
      //    <h2>
      //        <a href="https://nowhey.co.nz/gaspari-bone-broth-collagen.html">Gaspari Bone Broth + Collagen</a>
      //    </h2>
      //  </div>
      const scrapedName = $card.find('.deal_title').text().trim();
      // eg:
      //   <div class='deal_price_wrap'>
      //     <div class='deal_price_before_wrap'>
      //       Elsewhere <span class='price'>$69.95</span>
      //     </div>
      //     <div class='deal_price_now_wrap'>
      //       <div class='deal_price_now'>
      //         Now <span class='price'>$48.97</span>
      //       </div>
      //     </div>
      //   </div>;
      const $priceElement = $card.find('.deal_price_wrap').first();
      // Filter by type attributes
      const scrapedPrice =
        $priceElement.find('.deal_price_now .price').first().text().trim() || // "$48.97"
        $priceElement.find('.deal_price_before_wrap .price').first().text().trim() || // fallback if no price now
        $priceElement.find('.price-area .price').first().text().trim(); // final fallback
      if (!scrapedPrice) {
        errors.push(`No price, skipping #${index} url=${productUrl}`);
        continue; // skip this card
      }

      // Stock status
      const inStock = $priceElement.length > 0 && $priceElement.text().trim().length > 0;

      // Normalised fields
      // Search for brand in name using known brands list (from https://xplosiv.nz/brands)
      // If found, remove it from the name and use it as the brand field
      const { brand: detectedBrand, baseName } = splitBrandFromName(scrapedName, knownBrands);
      const brand = detectedBrand ?? 'NoWhey';
      // Removes weight info (e.g., "- 1kg", "- 1000 g") and anything that follows it
      // Examples:
      //  "Whey Isolate - 1kg"            -> "Whey Isolate"
      //  "Whey Isolate-1000 g (Vanilla)" -> "Whey Isolate"
      //  "Casein - 500G"                 -> "Casein"
      // Captialises the resulting name
      const name = captialisation(scrapedName.replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

      // Use the collectFlavours browser to get the list of flavours
      const flavours = new Set<string>();
      await page.waitForTimeout(250);
      flavoursChecked++;
      const labels = await collectFlavours(productUrl, page).catch(() => []);
      for (let label of labels) {
        label = label.trim();
        if (!label) continue;
        flavours.add(label);
      }
      if (flavours.size > 0) flavoursFound++;

      const weight_g = weightGrams(scrapedName);

      // Pick the last price if it's a range like "$34.00 - $40.00" for no discount
      const priceRange = (
        scrapedPrice.match(/(?:NZ\$|\$)\s*\d[\d,]*(?:\.\d{1,2})?/g) ?? [scrapedPrice]
      ).pop()!;

      const price = normalisePrice(priceRange);

      const product: Product = {
        id: `${brand}:${name}:${weight_g ?? 'na'}`.toLowerCase().replace(/\s+/g, '_'), // nzprotein:whey_isolate:1000
        brand,
        name,
        price,
        inStock,
        url: productUrl,
        scrapedAt: new Date().toISOString(),
        retailer: 'NoWhey',
        // include only when defined
        ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
        ...(flavours.size ? { flavours: [...flavours] } : {}),
      };
      products.push(product);
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  await browser.close();

  console.log(`Flavours: checked ${flavoursChecked} Flavours: found ${flavoursFound} `);

  return { products, errors };
};
