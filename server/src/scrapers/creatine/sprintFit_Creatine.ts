import { fetchHtml } from '../common/fetch.js';
import { captialisation, normalisePrice, weightGrams } from '../common/normalise.js';
import type { Product, ScrapeResult } from '../common/types.js';
import * as cheerio from 'cheerio';

export const scrapeSprintFitCreatine = async (): Promise<ScrapeResult> => {
  const startTime = Date.now(); // testing runtime check
  const baseUrl = 'https://www.sprintfit.co.nz/products/category/315/creatine';
  const products: Product[] = [];
  const errors: string[] = [];

  const html = await fetchHtml(baseUrl);

  // Loading HTML into cheerio
  const $ = cheerio.load(html);
  // console.log('HTML length:', html.length);
  // console.log('HTML preview:\n', html.slice(0, 1500));

  const $cards = $('.product'); // cheerio collection of product cards
  console.log(`Product cards found: ${$cards.length}`);
  if ($cards.length === 0) {
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
      //         MICRONISED CREATINE POWDER<br>
      //         600G
      //     </strong>
      //  </div>
      const scrapedNameHtml = $card.find('.name').first().html() ?? '';

      // Turn "<br>"s into "\n", drop <strong> tags, then split
      // eg:
      //  OPTIMUM NUTRITION (lines[0])
      //  MICRONISED CREATINE POWDER (lines[1])
      //  600G (lines[2])
      const lines = scrapedNameHtml
        .replace(/<br\s*\/?>/gi, '\n') // <br> into \n
        .replace(/<\/?strong[^>]*>/gi, '') // Remove <strong> tags
        .split('\n') // Split by lines
        .map((s) => s.replace(/\s+/g, ' ').trim()) // Collapses gaps
        .filter(Boolean); // Filter out empty lines

      // Hard filter to creatine-ish products only (defensive)
      const combinedName = lines.join(' ');
      if (
        !/creatine/i.test(combinedName) &&
        !/creapure/i.test(combinedName) &&
        !/mono\s*hydrate/i.test(combinedName)
      ) {
        continue;
      }

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
        errors.push(`No price, skipping creatine #${index} url=${productUrl}`);
        continue; // skip this card
      }

      // Stock status
      const inStock = $card.find('.product-tag.tag-out-of-stock').length === 0;

      // Normalised fields
      const brand = lines[0] || '';

      // Removes weight info (e.g., "- 1kg", "- 1000 g") and anything that follows it
      // Examples:
      //  "Creatine Monohydrate - 1kg"            -> "Creatine Monohydrate"
      //  "Creatine Monohydrate-1000 g"          -> "Creatine Monohydrate"
      //  "Creatine HCL - 500G"                  -> "Creatine HCL"
      // Captialises the resulting name
      const name = captialisation((lines[1] || '').replace(/\s*-\s*\d+\s*(g|kg).*/i, '').trim());

      const weight_g = weightGrams(scrapedNameHtml);

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
        retailer: 'SprintFit',
        // include only when defined
        ...(weight_g !== undefined ? { weight_grams: weight_g } : {}),
        // For creatine we don't care about flavours; omit `flavours` so DB defaults to '{}'
      };
      products.push(product);
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  console.log(`SprintFit: scraped ${products.length} products`);

  return { products, errors };
};
