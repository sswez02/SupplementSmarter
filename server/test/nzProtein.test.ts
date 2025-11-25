import { describe, it, expect } from 'vitest';
import { scrapeNZProteinProtein } from '@/scrapers/protein/nzProtein_Protein.js';
import { scrapeNZProteinCreatine } from '@/scrapers/creatine/nzProtein_Creatine.js';
import { CURRENCIES, RETAILERS, type Product } from '@/scrapers/common/types.js';

describe('NZ Protein scraper', () => {
  it('returns protein products within time budget and with valid fields', async () => {
    const { products, errors } = await scrapeNZProteinProtein();

    // Basic expectations
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    expect(Array.isArray(errors)).toBe(true);

    // Some optional fields (flavours, weight) should be present
    expect(
      products.some(
        (p) =>
          (Array.isArray(p.flavours) && p.flavours.length > 0) || typeof p.weight_grams === 'number'
      )
    ).toBe(true);

    // Validate each product
    for (const p of products as Product[]) {
      // required fields
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);

      expect(typeof p.brand).toBe('string');
      expect(p.brand.length).toBeGreaterThan(0);

      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);

      expect(p.price && typeof p.price === 'object').toBe(true);
      expect(typeof p.price.amountCents).toBe('number');
      expect(Number.isFinite(p.price.amountCents)).toBe(true);
      expect(p.price.amountCents).toBeGreaterThan(0);
      expect(CURRENCIES.includes(p.price.currency)).toBe(true);

      expect(typeof p.inStock).toBe('boolean');

      expect(typeof p.url).toBe('string');
      expect(p.url.startsWith('http')).toBe(true);

      expect(typeof p.scrapedAt).toBe('string');
      expect(Number.isFinite(Date.parse(p.scrapedAt))).toBe(true);

      expect(RETAILERS.includes(p.retailer)).toBe(true);

      // Optional fields (validate only if present)
      if ('flavours' in p && p.flavours !== undefined) {
        expect(Array.isArray(p.flavours)).toBe(true);
        for (const f of p.flavours) {
          expect(typeof f).toBe('string');
          expect(f.trim().length).toBeGreaterThan(0);
        }
      }

      if ('weight_grams' in p && p.weight_grams !== undefined) {
        expect(typeof p.weight_grams).toBe('number');
        expect(Number.isFinite(p.weight_grams)).toBe(true);
        expect(p.weight_grams).toBeGreaterThan(0);
      }
    }
  });

  it('returns creatine products within time budget and with valid fields', async () => {
    const { products, errors } = await scrapeNZProteinCreatine();

    // Basic expectations
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    expect(Array.isArray(errors)).toBe(true);

    // Some optional fields (flavours, weight) should be present
    expect(
      products.some(
        (p) =>
          (Array.isArray(p.flavours) && p.flavours.length > 0) || typeof p.weight_grams === 'number'
      )
    ).toBe(true);

    // Validate each product
    for (const p of products as Product[]) {
      // required fields
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);

      expect(typeof p.brand).toBe('string');
      expect(p.brand.length).toBeGreaterThan(0);

      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);

      expect(p.price && typeof p.price === 'object').toBe(true);
      expect(typeof p.price.amountCents).toBe('number');
      expect(Number.isFinite(p.price.amountCents)).toBe(true);
      expect(p.price.amountCents).toBeGreaterThan(0);
      expect(CURRENCIES.includes(p.price.currency)).toBe(true);

      expect(typeof p.inStock).toBe('boolean');

      expect(typeof p.url).toBe('string');
      expect(p.url.startsWith('http')).toBe(true);

      expect(typeof p.scrapedAt).toBe('string');
      expect(Number.isFinite(Date.parse(p.scrapedAt))).toBe(true);

      expect(RETAILERS.includes(p.retailer)).toBe(true);

      // Optional fields (validate only if present)
      if ('flavours' in p && p.flavours !== undefined) {
        expect(Array.isArray(p.flavours)).toBe(true);
        for (const f of p.flavours) {
          expect(typeof f).toBe('string');
          expect(f.trim().length).toBeGreaterThan(0);
        }
      }

      if ('weight_grams' in p && p.weight_grams !== undefined) {
        expect(typeof p.weight_grams).toBe('number');
        expect(Number.isFinite(p.weight_grams)).toBe(true);
        expect(p.weight_grams).toBeGreaterThan(0);
      }
    }
  });
});
