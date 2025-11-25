import { describe, it, expect } from 'vitest';
import { normalisePrice, weightGrams } from '@/scrapers/common/normalise.js';

describe('normalise', () => {
  it('normalisePrice', () => {
    expect(normalisePrice('$49.99').amountCents).toBe(4999);
  });

  describe('weightGrams', () => {
    it('parses kg', () => {
      expect(weightGrams('Whey Isolate 1.5 kg')).toBe(1500);
    });

    it('parses g', () => {
      expect(weightGrams('Casein 750 g')).toBe(750);
      expect(weightGrams('Mass Gainer 1,000 g')).toBe(1000);
    });

    it('parses lb/lbs', () => {
      expect(weightGrams('Pack 5lb')).toBe(2270); // 5 * 453.59237 = 2267.96 -> 2270 (rounded)
      expect(weightGrams('Bundle 2 lbs')).toBe(910); // 2 * 453.59237 = 907.18 -> 910 (rounded)
    });

    it('supports EU decimal comma', () => {
      expect(weightGrams('1,5 kg')).toBe(1500);
    });
    it('returns undefined when no weight is present', () => {
      expect(weightGrams('Protein Supreme')).toBeUndefined();
    });
  });
});
