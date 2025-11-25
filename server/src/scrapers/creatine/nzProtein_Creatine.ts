import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';

export const scrapeNZProteinCreatine = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check

  const baseUrl = 'https://www.nzprotein.co.nz';
  const categoryUrl = `${baseUrl}/category/supplements`;

  const products: Product[] = [];
  const errors: string[] = [];

  const html = await fetchHtml(categoryUrl);

  // Loading HTML into cheerio
  const $ = cheerio.load(html);
  // console.log('HTML length:', html.length);
  // console.log('HTML preview:\n', html.slice(0, 1500));

  const $headings = $('h3').filter((_, el) => {
    const text = $(el).text().trim();
    return /creatine/i.test(text) || /creapure/i.test(text) || /mono\s*hydrate/i.test(text);
  });

  // Loop through matching headings
  for (const [index, element] of $headings.toArray().entries()) {
    // Testing runtime limit
    if (process.env.SCRAPE_TESTING === '1') {
      const maxRuntime = Number(process.env.MAX_MS || 0);
      if (maxRuntime && Date.now() - startTime > maxRuntime) break;
    }

    try {
      const $heading = $(element);
      const scrapedName = $heading.text().trim();
      if (!scrapedName) {
        errors.push(`Empty creatine title at index ${index}`);
        continue;
      }

      // Hard filter to creatine-ish products only
      if (
        !/creatine/i.test(scrapedName) &&
        !/creapure/i.test(scrapedName) &&
        !/mono\s*hydrate/i.test(scrapedName)
      ) {
        continue;
      }

      // Try to get the surrounding product card for this heading
      let $card = $heading.closest(
        'article, li, .productgrid--item, .productgrid__item, .ProductItem'
      );
      if (!$card.length) {
        // Fallback: just use the heading's parent as the card
        $card = $heading.parent();
      }

      // Find a product URL inside the card
      let href =
        $card.find('a[href*="creatine"]').first().attr('href') ??
        $heading.find('a[href]').attr('href') ??
        $card.find('a[href]').first().attr('href');

      if (!href) {
        errors.push(`No href for creatine #${index} (title="${scrapedName}")`);
        continue;
      }

      const productUrl = new URL(href, baseUrl).toString(); // absolute URL

      // Grab any price text from the card and extract the last dollar value
      const cardText = $card.text();
      const priceMatches = cardText.match(/(?:NZ\$|\$)\s*\d[\d,]*(?:\.\d{1,2})?/g);
      const scrapedPrice = priceMatches ? priceMatches[priceMatches.length - 1] : '';

      if (!scrapedPrice) {
        errors.push(`No price, skipping NZProtein creatine #${index} url=${productUrl}`);
        continue;
      }

      // Stock status – if there's a price block we assume it's in stock
      const inStock = !!scrapedPrice;

      // Normalised fields
      const brand = 'NZProtein';

      // Removes weight info (e.g., "- 1kg", "300g") and anything that follows it
      // Examples:
      //  "Creatine Monohydrate - 1kg"            -> "Creatine Monohydrate"
      //  "Creatine Monohydrate-1000 g"          -> "Creatine Monohydrate"
      //  "Creatine Monohydrate 300G"            -> "Creatine Monohydrate"
      //  "Creatine HCL - 500G"                  -> "Creatine HCL"
      // Capitalises the resulting name
      const name = captialisation(
        scrapedName
          .replace(/\s*[-–]?\s*\d+(\.\d+)?\s*(g|kg)\b.*/i, '') // strip weight with or without "-"
          .trim()
      );

      // Weight detection based on name, same helper as protein
      const weight_g = weightGrams(scrapedName);

      // Pick the last price if it's a range like "$25.00 - $28.00" for no discount
      const priceRange = (priceMatches ?? [scrapedPrice]).pop()!;
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
        // include only when defined
        ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
        // For creatine we don't care about flavours; omit `flavours` so DB defaults to '{}'
      };

      products.push(product);
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  console.log(`NZProtein: scraped ${products.length} products`);

  return { products, errors };
};
