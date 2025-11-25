// Accepted currencies
export const CURRENCIES = ['NZD', 'AUD', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = { amountCents: number; currency: Currency };

// Accepted retailers
export const RETAILERS = [
  'NZProtein',
  'Xplosiv',
  'NoWhey',
  'SprintFit',
  'Chemist Warehouse',
] as const;
export type Retailer = (typeof RETAILERS)[number];

// Product fields
export interface Product {
  id: string; // (brand) + (name) + (size)
  brand: string;
  name: string;
  flavours?: string[]; // optional
  weight_grams?: number; // optional
  price: Money;
  inStock: boolean;
  url: string;
  scrapedAt: string;
  retailer: Retailer;
}

export interface ScrapeResult {
  products: Product[]; // successfully scraped products
  errors: string[]; // error messages encountered during scraping
}
