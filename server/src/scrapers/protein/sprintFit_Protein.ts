import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';
import { chromium, type Page } from 'playwright';

// Helper to open product page and collect flavour names
async function collectFlavours(url: string, page: Page): Promise<string[]> {
  // Wait for product page to load with a 30s timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // If verification block, pause to let it complete, then retry
  const title = (await page.title().catch(() => '')) || '';
  if (/just a moment|verify you are human|attention required/i.test(title)) {
    await page.waitForTimeout(10000); // wait 10 seconds
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // retry once
  }

  const selectOptions = page.locator('.variation-group select option[value]:not([value="null"])');

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

export const scrapeSprintFitProtein = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl =
    'https://www.sprintfit.co.nz/products/category/321/protein-powder?pgNmbr=9&pgSize=999999999';
  const products: Product[] = [];
  const errors: string[] = [];
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

  const $cards = $('.product'); // cheerio collection of product cards
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
      //  <div class="name">
      //     OPTIMUM NUTRITION<br>
      //     <strong>
      //         GOLD STANDARD 100% WHEY<br>
      //         1LB
      //     </strong>
      //  </div>
      const scrapedName = $card.find('.name').first().html() ?? '';

      // Turn "<br>"s into "\n", drop <strong> tags, then split
      // eg:
      //  OPTIMUM NUTRITION (lines [0])
      //  GOLD STANDARD 100% WHEY (lines [1])
      //  1LB (lines[2])
      const lines = scrapedName
        .replace(/<br\s*\/?>/gi, '\n') // <br> into \n
        .replace(/<\/?strong[^>]*>/gi, '') // Remove <strong> tags
        .split('\n') // Split by lines
        .map((s) => s.replace(/\s+/g, ' ').trim()) // Collapses gaps
        .filter(Boolean); // Filter out empty lines

      const $priceElement = $card.find('.price-area').find('.price').first(); // eg (on special):
      //  <div class="price-area">
      //     <span class="price special">
      //         <span class="line-through">$59.95</span>
      //         $50.96
      //     </span>
      //  </div>
      //
      // eg (not on special):
      //  <div class="price-area">
      //     <span class="price "> $179.00 </span>
      //  </div>
      const scrapedPrice = $priceElement.hasClass('special')
        ? // Sale: take only the text (exclude <span class="line-through">)
          $priceElement
            .contents()
            .filter(function () {
              return this.type === 'text';
            })
            .text()
            .trim()
        : // No sale: just take the text
          $priceElement.text().trim();
      if (!scrapedPrice) {
        errors.push(`No price, skipping #${index} url=${productUrl}`);
        continue; // skip this card
      }

      // Stock status
      const inStock = $card.find('.product-tag.tag-out-of-stock').length === 0;

      // Normalised fields
      const brand = lines[0] || '';
      // Removes weight info (e.g., "- 1kg", "- 1000 g") and anything that follows it
      // Examples:
      //  "Whey Isolate - 1kg"            -> "Whey Isolate"
      //  "Whey Isolate-1000 g (Vanilla)" -> "Whey Isolate"
      //  "Casein - 500G"                 -> "Casein"
      // Captialises the resulting name
      const name = captialisation((lines[1] || '').replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

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
        retailer: 'SprintFit',
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
