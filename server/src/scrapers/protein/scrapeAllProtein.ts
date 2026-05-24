import { scrapeNoWheyProtein } from './noWhey_Protein.js';
import { scrapeNZProteinProtein } from './nzProtein_Protein.js';
import { scrapeSprintFitProtein } from './sprintFit_Protein.js';
import { scrapeXplosivProtein } from './xplosiv_Protein.js';
import { saveProducts } from '../common/save.js';

// Results from one scraper run only
type ResultsOne = () => Promise<{ products: any[]; errors: string[] }>;

const SCRAPERS = {
  nzprotein: scrapeNZProteinProtein,
  xplosiv: scrapeXplosivProtein,
  sprintfit: scrapeSprintFitProtein,
  nowhey: scrapeNoWheyProtein,
} as const satisfies Record<string, ResultsOne>;

type ScraperKey = keyof typeof SCRAPERS;

(async () => {
  const order: ScraperKey[] = ['nzprotein', 'xplosiv', 'sprintfit', 'nowhey'];

  const summary: Record<ScraperKey, { products: number; errors: number }> = {} as any;

  const seen = new Set<string>();

  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);

    console.log(`\n=== protein:${key} ===`);

    const run = SCRAPERS[key];
    let out: Awaited<ReturnType<ResultsOne>>;

    try {
      out = await run();
    } catch (e: any) {
      out = {
        products: [],
        errors: [`${key} failed: ${e?.message || String(e)}`],
      };
    }

    const { products, errors } = out;

    const productsToSave = products.map((p) => ({
      ...p,
      flavours: Array.isArray(p.flavours) && p.flavours.length > 0 ? p.flavours : ['Default'],
    }));

    // Show product sample
    if (products.length > 0) {
      console.log(`[${key}] first products sample:`);
      console.dir(products.slice(0, 3), { depth: null });
    }

    // Show error sample
    if (errors.length > 0) {
      console.log(`[${key}] first errors:`);
      console.dir(errors.slice(0, 10), { depth: null });
    }

    // Save to database
    try {
      await saveProducts(productsToSave, 'protein');
    } catch (e: any) {
      console.error(`[${key}] DB insert failed:`, e?.message || e);
    }

    summary[key] = { products: products.length, errors: errors.length };
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  for (const k of order) {
    const s = summary[k];
    console.log(`${k}: products=${s.products}, errors=${s.errors}`);
  }
})();
