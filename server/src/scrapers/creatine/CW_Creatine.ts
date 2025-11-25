// src/scrapers/chemistWarehouse.ts
import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

// Helper to collect brand names
async function collectBrands(): Promise<string[]> {
  try {
    // This returns the HTML snippet with the <table class="DataListCategory"> you showed
    const html = await fetchHtml('https://www.chemistwarehouse.co.nz/v1/shop-online/1255/category');

    const $ = cheerio.load(html);
    const names = new Set<string>();

    // Structure:
    // <div class="DataListCategory">
    //   <table ...>
    //     <a class="category-entry" href="...">
    //       <span class="category-count">(10)</span>
    //       <span class="category-name">Amazonia RAW</span>
    //     </a>
    //   ...
    // </div>
    $('.DataListCategory a.category-entry .category-name').each((_, el) => {
      const raw = $(el).text().trim();
      if (!raw) return;

      // Normalise spacing; keep original casing since splitBrandFromName is case-insensitive
      const name = raw.replace(/\s+/g, ' ');
      names.add(name);
    });

    // Group similar brand variants (e.g. "Balance" + "Balance Sports Nutrition")
    const suffixes = ['sports nutrition', 'nutrition', 'lifestyle', 'supplements'];

    const byKey = new Map<string, string>(); // normalised key -> canonical brand
    for (const rawName of names) {
      const name = rawName.trim().replace(/\s+/g, ' ');
      if (!name) continue;

      let key = name.toLowerCase();

      // Strip generic suffixes from the key
      for (const suffix of suffixes) {
        const re = new RegExp(`\\b${suffix}\\b`, 'gi');
        key = key.replace(re, '');
      }

      key = key.replace(/\s+/g, ' ').trim();
      if (!key) key = name.toLowerCase();

      const existing = byKey.get(key);
      // keep the longest name as canonical for that key
      if (!existing || name.length > existing.length) {
        byKey.set(key, name);
      }
    }

    const result = [...byKey.values()];
    // console.log('Chemist Warehouse collectBrands():', result);
    return result;
  } catch (e) {
    console.error('collectBrands (Chemist Warehouse) failed:', e);
    return [];
  }
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

    const full = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1) Try full brand at the start
    //    e.g. "Bondi Protein Co. Daily Protein"
    //    allow space, hyphen, dot, colon after the brand, or end of-string
    const reFull = new RegExp(`^${full}(?=[\\s\\-.:]|$)`, 'i');
    if (reFull.test(base)) {
      found = brand;
      // Remove the brand + any trailing separators from the original base
      base = base
        .replace(reFull, '')
        .replace(/^[\s\-.:]+/, '')
        .trim();
      break;
    }

    // 2) Fallback: first word of brand at the start
    //    e.g. "Inc Micellar Casein" vs brand "INC Sports"
    const firstWord = brand.split(/\s+/)[0];
    if (!firstWord) continue;
    const short = firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reShort = new RegExp(`^${short}(?=[\\s\\-.:]|$)`, 'i');
    if (reShort.test(base)) {
      found = brand;
      base = base
        .replace(reShort, '')
        .replace(/^[\s\-.:]+/, '')
        .trim();
      break;
    }
  }

  return { brand: found, baseName: base };
}

export const scrapeChemistWarehouseCreatine = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl = 'https://www.chemistwarehouse.co.nz';
  const categoryUrl = `${baseUrl}/shop-online/1255/sports-nutrition`;
  const products: Product[] = [];
  const errors: string[] = [];
  const knownBrands = (await collectBrands()).map((b) => b.trim()).filter(Boolean);

  // Browser for scraping flavours for each product
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
  });
  const page = await context.newPage();

  const seenProductUrls = new Set<string>();

  try {
    // Load the main category page once
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // If we hit a verification / holding page, wait then retry once
    const title = (await page.title().catch(() => '')) || '';
    if (/just a moment|verify you are human|attention required/i.test(title)) {
      await page.waitForTimeout(12000);
      await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await page.waitForSelector('a.product__container', { timeout: 15000 }).catch(() => {});

    const maxPages = 50;

    // Using pager buttons for JS-driven pagination
    for (let p = 1; p <= maxPages; p++) {
      // Testing runtime limit
      if (process.env.SCRAPE_TESTING === '1') {
        const maxRuntime = Number(process.env.MAX_MS || 0);
        if (maxRuntime && Date.now() - startTime > maxRuntime) break;
      }

      // Get current page HTML and parse product tiles
      const html = await page.content();
      const $ = cheerio.load(html);

      const $cards = $('a.product__container'); // cheerio collection of product tiles
      console.log(`Page ${p}, Product cards found: ${$cards.length}`);

      if ($cards.length === 0) {
        // no cards, end of results
        break;
      }

      // Track whether this page produced any new product URLs
      let newOnThisPage = 0;

      // Loop through the cards on this page
      for (const [index, element] of $cards.toArray().entries()) {
        // Testing runtime limit (per product)
        if (process.env.SCRAPE_TESTING === '1') {
          const maxRuntime = Number(process.env.MAX_MS || 0);
          if (maxRuntime && Date.now() - startTime > maxRuntime) break;
        }

        try {
          const $card = $(element); // Make a Cheerio wrapper

          // Find the product page link
          const href = $card.attr('href');
          if (!href) throw new Error('missing href on product card');

          const productUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();

          // Skip if we've already seen this URL
          if (seenProductUrls.has(productUrl)) {
            continue;
          }
          seenProductUrls.add(productUrl);
          newOnThisPage++;

          // Scraped fields
          // Name: from .product__title
          const scrapedName = $card.find('.product__title').first().text().trim();
          if (!scrapedName) {
            errors.push(`No name, skipping #${index} url=${productUrl}`);
            continue;
          }

          // Price:
          //   <div class="product__price">
          //     <span class="product__price-current">$95.99</span>
          //     <em class="product__price-discount">Why Pay $173.90?</em>
          //   </div>
          //
          // Also on the <a> tag: data-analytics-price="95.99"
          const $priceElement = $card.find('.product__price-current').first();
          const textPrice = $priceElement.text().trim();
          const attrPrice = $card.attr('data-analytics-price');

          const scrapedPrice = textPrice || (attrPrice ? `$${attrPrice}` : '');

          if (!scrapedPrice) {
            errors.push(`No price, skipping #${index} url=${productUrl}`);
            continue; // skip this card
          }

          // Stock status – if Buy button exists and no "sold out" text, treat as in stock
          const hasBuyButton = $card.find('.product-buy-button').length > 0;
          const outOfStockText = /sold out|out of stock|unavailable/i.test($card.text() || '');
          const inStock = hasBuyButton && !outOfStockText;

          // Normalised fields
          // Search for brand in name using known brands list
          const { brand: detectedBrand } = splitBrandFromName(scrapedName, knownBrands);
          const brand = detectedBrand ?? 'Chemist Warehouse';

          // Remove weight info (e.g., "- 1kg", "- 1000 g") and anything that follows it
          const name = captialisation(scrapedName.replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

          const weight_g = weightGrams(scrapedName);

          // Pick the last price if it's a range like "$34.00 - $40.00"
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
            retailer: 'Chemist Warehouse',
            // For now we just mark flavours as "to be processed"
            flavours: ['to be processed'],
            // include only when defined
            ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
          };

          products.push(product);
        } catch (e: any) {
          errors.push(e?.message ?? String(e));
        }
      }

      if (newOnThisPage === 0) {
        console.log(`No new products on page ${p}, stopping pagination.`);
        break;
      }

      // Check if there is a "Next" page button
      const hasNext = await page.evaluate(() => {
        const btn = document.querySelector<HTMLButtonElement>('button.pager__button--next');
        return !!btn && !btn.disabled && !btn.classList.contains('pager__button--disabled');
      });

      if (!hasNext) {
        // No more pages
        break;
      }

      // Click the Next page button to load the next set of results
      await page.click('button.pager__button--next');

      // Give time for the JS pager to fetch and render the next page
      await page.waitForTimeout(2500);
    }
  } catch (e: any) {
    errors.push(`Failed to scrape Chemist Warehouse: ${e?.message ?? String(e)}`);
  } finally {
    await browser.close();
  }

  console.log(`NZProtein: scraped ${products.length} products`);

  return { products, errors };
};
