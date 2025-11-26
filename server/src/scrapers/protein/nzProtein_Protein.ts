import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';
import { chromium, type Page, type LaunchOptions } from 'playwright';

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

  const selectOptions = page.locator('.flavours-selection .flavour-info h5');

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

export const scrapeNZProteinProtein = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl = 'https://www.nzprotein.co.nz/category/protein-powders';
  const products: Product[] = [];
  const errors: string[] = [];

  // Launch options (re-used when we recycle the browser)
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

  // Browser for scraping flavours for each product
  let browser = await chromium.launch(launchOptions);
  let context = await browser.newContext(contextOptions);
  let page: Page = await context.newPage();

  let flavoursChecked = 0;
  let flavoursFound = 0;

  const html = await fetchHtml(baseUrl);

  // Loading HTML into cheerio
  const $ = cheerio.load(html);

  const $cards = $('.product-wrap'); // cheerio collection of product cards
  console.log(`Product cards found: ${$cards.length}`);
  const totalCards = $cards.length;
  let processed = 0;

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

    processed++;

    try {
      const $card = $(element); // Make a Cheerio wrapper
      const href = $card.find('a').attr('href');
      if (!href) throw new Error('missing href on product card');
      const productUrl = new URL(href, baseUrl).toString(); // Find the product page from card

      // Scraped fields
      const scrapedName = $card.find('h3[data-mh="product-title"]').text().trim();

      // Price (ignore "(NZD)" span)
      const $priceElement = $card.find('.product-price.h3').first();
      const scrapedPrice = $priceElement
        .contents()
        .filter(function () {
          return this.type === 'text';
        })
        .text()
        .trim();

      if (!scrapedPrice) {
        errors.push(`No price, skipping #${index} url=${productUrl}`);
        continue; // skip this card
      }

      // Stock status
      const outOfStock = $card.find('.btn-no-stock').length > 0;
      const inStock = !outOfStock;

      // Normalised fields
      const brand = 'NZProtein';
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
        retailer: 'NZProtein',
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
        `NZProtein: processed ${processed}/${totalCards}, recycling browser to free memory`
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

  await browser.close();

  console.log(`Flavours: checked ${flavoursChecked} Flavours: found ${flavoursFound} `);

  return { products, errors };
};
