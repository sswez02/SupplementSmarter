import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';
import { chromium, type Page, type LaunchOptions } from 'playwright';

// Helper to open brands page and collect brand names
async function collectBrands(): Promise<string[]> {
  try {
    const html = await fetchHtml('https://xplosiv.nz/brands');
    const $ = cheerio.load(html);

    const names = new Set<string>();

    $('.ambrands-brand-item a.ambrands-inner').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (!/\/brand(s)?\//i.test(href)) return;

      const $label = $(el).find('.ambrands-label').first();
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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const title = (await page.title().catch(() => '')) || '';
  if (/just a moment|verify you are human|attention required/i.test(title)) {
    await page.waitForTimeout(12000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // retry once
  }

  const selectOptions = page.locator(
    'select[name^="super_attribute"] option[value]:not([value=""])'
  );

  await Promise.race([selectOptions.first().waitFor({ state: 'attached', timeout: 5000 })]).catch(
    () => {}
  );

  const labels = await selectOptions.allInnerTexts().catch(() => []);

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

    const re = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(base)) {
      found = brand;
      base = base
        .replace(re, '')
        .replace(/^\s*-\s*/, '')
        .trim();
      break;
    }
  }

  return { brand: found, baseName: base };
}

export const scrapeXplosivProtein = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl = 'https://xplosiv.nz/protein-powder.html';
  const products: Product[] = [];
  const errors: string[] = [];
  const knownBrands = (await collectBrands())
    .map((b) => b.trim())
    .filter((b) => b && !/xplosiv/i.test(b));

  const launchOptions: LaunchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-gpu',
    ],
  };

  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
  } as const;

  let browser = await chromium.launch(launchOptions);
  let context = await browser.newContext(contextOptions);
  let page: Page = await context.newPage();

  let flavoursChecked = 0;
  let flavoursFound = 0;

  let totalCards = 0;
  let processed = 0;

  // Page scraping
  for (let p = 1; p < 50; p++) {
    if (process.env.SCRAPE_TESTING === '1') {
      const maxRuntime = Number(process.env.MAX_MS || 0);
      if (maxRuntime && Date.now() - startTime > maxRuntime) break;
    }

    const pageUrl = p === 1 ? baseUrl : `${baseUrl}?p=${p}`;
    let html: string | null = null;

    try {
      html = await fetchHtml(pageUrl);
    } catch {
      break;
    }

    const $ = cheerio.load(html);

    const $cards = $('li.product-item'); // cheerio collection of product cards
    console.log(`Page ${p}, Product cards found: ${$cards.length}`);
    if ($cards.length === 0) break;

    totalCards += $cards.length;

    // Loop through the cards
    for (const [index, element] of $cards.toArray().entries()) {
      if (process.env.SCRAPE_TESTING === '1') {
        const maxRuntime = Number(process.env.MAX_MS || 0);
        if (maxRuntime && Date.now() - startTime > maxRuntime) break;
      }

      processed++;

      try {
        const $card = $(element); // make a Cheerio wrapper
        const href = $card.find('a').attr('href');
        if (!href) throw new Error('missing href on product card');
        const productUrl = new URL(href, baseUrl).toString();

        const scrapedName = $card.find('.product-item-link').text().trim();

        const $priceElement = $card.find('[data-role="priceBox"]').first();
        const scrapedPrice = $priceElement
          .find('[data-price-type="finalPrice"]')
          .attr('data-price-amount');

        if (!scrapedPrice) {
          errors.push(`No price, skipping #${index} url=${productUrl}`);
          continue;
        }

        const inStock = $card.find('button.action.tocart, #product-addtocart-button').length > 0;

        const { brand: detectedBrand } = splitBrandFromName(scrapedName, knownBrands);
        const brand = detectedBrand ?? 'Xplosiv';
        const name = captialisation(scrapedName.replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

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

        const priceRange = (
          scrapedPrice.match(/(?:NZ\$|\$)\s*\d[\d,]*(?:\.\d{1,2})?/g) ?? [scrapedPrice]
        ).pop()!;

        const price = normalisePrice(priceRange);

        const product: Product = {
          id: `${brand}:${name}:${weight_g ?? 'na'}`.toLowerCase().replace(/\s+/g, '_'),
          brand,
          name,
          price,
          inStock,
          url: productUrl,
          scrapedAt: new Date().toISOString(),
          retailer: 'Xplosiv',
          ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
          ...(flavours.size ? { flavours: [...flavours] } : {}),
        };
        products.push(product);
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }

      // Recycle browser every 40 products to keep memory under control
      if (processed > 0 && processed % 40 === 0 && processed < totalCards) {
        console.log(
          `Xplosiv: processed ${processed}/${totalCards}, recycling browser to free memory`
        );
        try {
          await page.close().catch(() => {});
          await context.close().catch(() => {});
          await browser.close().catch(() => {});
        } catch {
          // ignore cleanup errors
        }

        browser = await chromium.launch(launchOptions);
        context = await browser.newContext(contextOptions);
        page = await context.newPage();
      }
    }
  }

  await browser.close();

  console.log(`Flavours: checked ${flavoursChecked} Flavours: found ${flavoursFound} `);

  return { products, errors };
};
