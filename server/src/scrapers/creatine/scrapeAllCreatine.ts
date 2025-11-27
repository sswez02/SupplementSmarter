import { scrapeNoWheyCreatine } from './noWhey_Creatine.js';
import { scrapeNZProteinCreatine } from './nzProtein_Creatine.js';
import { scrapeSprintFitCreatine } from './sprintFit_Creatine.js';
import { scrapeXplosivCreatine } from './xplosiv_Creatine.js';
import { saveProducts } from '../common/save.js';

// Results from one scraper run only
type ResultsOne = () => Promise<{ products: any[]; errors: string[] }>;

const SCRAPERS = {
  nzprotein: scrapeNZProteinCreatine,
  xplosiv: scrapeXplosivCreatine,
  sprintfit: scrapeSprintFitCreatine,
  nowhey: scrapeNoWheyCreatine,
} as const satisfies Record<string, ResultsOne>;

(async () => {
  const order = [
    'nzprotein',
    'xplosiv',
    'sprintfit',
    'nowhey',
    'chemistwarehouse',
  ] as (keyof typeof SCRAPERS)[];
  const summary: Record<keyof typeof SCRAPERS, { products: number; errors: number }> = {} as any;

  const seen = new Set<string>();

  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`\n=== creatine:${key} ===`);
    const run = SCRAPERS[key];
    let out: Awaited<ReturnType<ResultsOne>>;

    try {
      out = await run();
    } catch (e: any) {
      out = { products: [], errors: [`${key} failed: ${e?.message || String(e)}`] };
    }

    const { products, errors } = out;

    // Save to database
    try {
      await saveProducts(products, 'creatine');
    } catch (e: any) {
      console.error(`[creatine:${key}] DB insert failed:`, e?.message || e);
    }

    summary[key] = { products: products.length, errors: errors.length };

    // Show a small products sample in testing
    // if (testing) {
    //   const sample = products.slice(0, 3);
    //   console.log(`[creatine:${key}] first 3 sample:`, sample);
    // }

    // Show a small errors sample in testing
    // if (testing && errors.length) {
    //   console.log(`[creatine:${key}] first 3 errors:`, errors.slice(0, 3));
    // }
  }

  // Summary
  console.log('\n=== CREATINE SUMMARY ===');
  for (const k of order) {
    const s = summary[k];
    console.log(`${k}: products=${s.products}, errors=${s.errors}`);
  }
})();
