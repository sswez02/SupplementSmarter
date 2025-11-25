import { scrapeNoWheyProtein } from '../protein/noWhey_Protein.js';
import { scrapeNZProteinProtein } from '../protein/nzProtein_Protein.js';
import { scrapeSprintFitProtein } from '../protein/sprintFit_Protein.js';
import { scrapeXplosivProtein } from '../protein/xplosiv_Protein.js';
import { scrapeChemistWarehouseProtein } from '../protein/CW_Protein.js';

type ScraperKey = 'nzprotein' | 'xplosiv' | 'sprintfit' | 'nowhey' | 'chemistwarehouse';
type Result = { products: any[]; errors: string[] };

// Set number of products to print out
const PRODUCTS = 50;

async function run(scraper: ScraperKey): Promise<Result> {
  if (scraper === 'nzprotein') return scrapeNZProteinProtein();
  if (scraper === 'xplosiv') return scrapeXplosivProtein();
  if (scraper === 'sprintfit') return scrapeSprintFitProtein();
  if (scraper === 'nowhey') return scrapeNoWheyProtein();
  if (scraper === 'chemistwarehouse') return scrapeChemistWarehouseProtein();
  throw new Error(`Unknown scraper: ${scraper}`);
}

(async () => {
  const which = (process.argv[2]?.toLowerCase() as ScraperKey) ?? 'nzprotein';
  const result = await run(which);
  const { products, errors } = result;
  const n = products.length;
  const sample =
    n <= PRODUCTS
      ? products
      : products.slice(0, PRODUCTS / 2).concat(products.slice(-PRODUCTS / 2));
  console.log(JSON.stringify({ totalProducts: n, sample }, null, 2));
  if (result.errors.length) {
    console.error('Errors:', result.errors);
    process.exitCode = 2;
  }
})();
