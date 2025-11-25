import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';

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

export const scrapeXplosivCreatine = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  // Creatine category page (Xplosiv)
  const baseUrl = 'https://xplosiv.nz/muscle-growth-recovery/creatine.html';
  const products: Product[] = [];
  const errors: string[] = [];
  const knownBrands = (await collectBrands()).map((b) => b.trim()).filter(Boolean);

  // Page scraping
  for (let p = 1; p < 50; p++) {
    // Testing runtime limit
    if (process.env.SCRAPE_TESTING === '1') {
      const maxRuntime = Number(process.env.MAX_MS || 0);
      if (maxRuntime && Date.now() - startTime > maxRuntime) break;
    }

    // If we are on the first page we use baseUrl
    // Otherwise we continue incrementing page, eg:
    // https://xplosiv.nz/muscle-growth-recovery/creatine.html?p=2
    // https://xplosiv.nz/muscle-growth-recovery/creatine.html?p=3
    const pageUrl = p === 1 ? baseUrl : `${baseUrl}?p=${p}`;
    let html: string | null = null;

    try {
      html = await fetchHtml(pageUrl);
    } catch (e: any) {
      break;
    }

    // Loading HTML into cheerio
    const $ = cheerio.load(html);
    // console.log('HTML length:', html.length);
    // console.log('HTML preview:\n', html.slice(0, 1500));

    const $cards = $('li.product-item'); // cheerio collection of product cards
    console.log(`Page ${p}, Product cards found: ${$cards.length}`);
    if ($cards.length === 0) break;

    // Loop through the cards
    for (const [index, element] of $cards.toArray().entries()) {
      // Testing runtime limit
      if (process.env.SCRAPE_TESTING === '1') {
        const maxRuntime = Number(process.env.MAX_MS || 0);
        if (maxRuntime && Date.now() - startTime > maxRuntime) break;
      }

      try {
        const $card = $(element); // make a Cheerio wrapper
        const href = $card.find('a').attr('href');
        if (!href) throw new Error('missing href on product card');
        const productUrl = new URL(href, baseUrl).toString(); // find the product page from card

        // Scraped fields
        const scrapedName = $card.find('.product-item-link').text().trim();

        // Hard filter to creatine-ish products only
        // (extra safety in case category ever mixes products)
        if (
          !/creatine/i.test(scrapedName) &&
          !/creapure/i.test(scrapedName) &&
          !/mono\s*hydrate/i.test(scrapedName)
        ) {
          continue;
        }

        // eg:
        //    <span id="product-price-26014"
        //       data-price-amount="72.95"
        //       data-price-type="finalPrice"
        //       class="price-wrapper">
        //     <span class="price">$72.95</span>
        //   </span>
        const $priceElement = $card.find('[data-role="priceBox"]').first();
        // Filter the finalPrice type attribute
        // Becomes: "72.95"
        const scrapedPrice = $priceElement
          .find('[data-price-type="finalPrice"]')
          .attr('data-price-amount');
        if (!scrapedPrice) {
          errors.push(`No price, skipping creatine #${index} url=${productUrl}`);
          continue; // skip this card
        }

        // Stock status
        const inStock = $card.find('button.action.tocart, #product-addtocart-button').length > 0;

        // Normalised fields
        // Search for brand in name using known brands list (from https://xplosiv.nz/brands)
        // If found, remove it from the name and use it as the brand field
        const { brand: detectedBrand } = splitBrandFromName(scrapedName, knownBrands);
        const brand = detectedBrand ?? 'Xplosiv';

        // Removes weight info (e.g., "- 1kg", "- 1000 g") and anything that follows it
        // Examples:
        //  "Creatine Monohydrate - 1kg"            -> "Creatine Monohydrate"
        //  "Creatine Monohydrate-1000 g"          -> "Creatine Monohydrate"
        //  "Creatine HCL - 500G"                  -> "Creatine HCL"
        // Captialises the resulting name
        const name = captialisation(scrapedName.replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

        const weight_g = weightGrams(scrapedName);

        // Pick the last price if it's a range like "$34.00 - $40.00" for no discount
        const priceRange = (
          scrapedPrice.match(/(?:NZ\$|\$)\s*\d[\d,]*(?:\.\d{1,2})?/g) ?? [scrapedPrice]
        ).pop()!;

        const price = normalisePrice(priceRange);

        const product: Product = {
          id: `${brand}:${name}:${weight_g ?? 'na'}`.toLowerCase().replace(/\s+/g, '_'), // brand:creatine_name:1000
          brand,
          name,
          price,
          inStock,
          url: productUrl,
          scrapedAt: new Date().toISOString(),
          retailer: 'Xplosiv',
          // include only when defined
          ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
          // For creatine we don't care about flavours; omit `flavours` so DB defaults to '{}'
        };
        products.push(product);
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }
  }

  console.log(`Xplosiv: scraped ${products.length} products`);

  return { products, errors };
};
