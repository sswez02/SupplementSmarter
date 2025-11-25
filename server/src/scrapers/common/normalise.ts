import type { Money } from './types.js';

type Rule = [scraped: RegExp, canonical: string];

// Acronyms to keep uppercase
const ACRONYMS = new Set(['NZ', 'ISO', 'WPI', 'ON']);

// Cleaning helper
const clean = (s: string) =>
  s
    .trim() // remove whitespace
    .replace(/\s+/gu, ' '); // collapse gaps

// Apply rules helper
const applyRules = (raw: string, rules: Rule[]): string => {
  const cleaned = clean(raw);
  for (const [scraped, canonical] of rules) {
    if (scraped.test(cleaned)) return canonical; // stop at first match
  }
  return cleaned; // no rule match from cleaned input
};

// Captialisation helper
export function captialisation(s: string): string {
  return s
    .split(/\s+/) // Split on spaces
    .map((w) => {
      const plain = w.replace(/[^A-Za-z]/g, ''); // remove non-letters for acronym check
      if (ACRONYMS.has(plain.toUpperCase())) return plain.toUpperCase() + w.slice(plain.length); // Keep acronym uppercase
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); // capitalise first letter
    })
    .join(' ');
}

// Weight conversion helper
export function weightGrams(input: string): number | undefined {
  if (!input) return undefined;

  let number: string | undefined;
  let unit: string | undefined;

  // Matches for weight indicators, eg:
  //  1.5 kg, 1,5 kg, 750 g, 5lb, 5 lbs, 2 pounds, 1-kg, 1 - kg
  for (const match of input.matchAll(
    /(\d+(?:[.,]\d+)?)[\s-]*(kg|kilograms?|g|grams?|lb|lbs|pounds?)/gi
  )) {
    number = match[1]; // "5" or "750"
    unit = match[2]; // "lb" or "g"
  }

  if (!number || !unit) return undefined;

  number = number.trim();
  // Normalise number string:
  // - If there's only commas (no dots), decide if commas are thousands or decimal:
  //    1,000 -> 1000 (thousands)
  //    1,5   -> 1.5  (decimal)
  if (number.includes(',') && !number.includes('.')) {
    // Thousands commas like 1,000 or 12,345,678
    if (/^\d{1,3}(?:,\d{3})+$/.test(number)) {
      number = number.replace(/,/g, '');
    } else {
      // Likely decimal comma (e.g: 1,5)
      number = number.replace(',', '.');
    }
  } else {
    // Remove thousands commas; keep decimal dot
    number = number.replace(/,/g, '');
  }

  const value = Number(number);
  if (!Number.isFinite(value)) return undefined;

  let grams: number | undefined;

  // Unit conversion
  unit = unit.trim().toLowerCase();
  if (unit === 'g' || unit === 'gram' || unit === 'grams') grams = value;
  else if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') grams = value * 1000;
  else if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds')
    grams = value * 453.59237;

  return grams !== undefined ? Math.round(grams / 10) * 10 : undefined; // rounds to nearest 10g
}

/* Price */
export const normalisePrice = (raw: string): Money => {
  const cleaned = raw.replace(/\s+/g, ''); // "NZ$1,234.50"

  // Split:
  //  [0] full match, e.g. "NZ$1,234.50"
  //  [1] whole part (digits, optional thousands commas), e.g. "1,234"
  //  [2] cents part WITHOUT the dot (optional), e.g. "50"
  const split = cleaned.match(/^(?:NZ\$|\$)?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/i);

  if (!split) throw new Error(`price parse fail: ${raw}`); // no match

  const whole = split[1]!.replace(/,/g, ''); // remove commas
  const frac = (split[2] ?? '').padEnd(2, '0'); // convert to 2 decimals eg: "5" -> "50", "0" -> "00"
  const amountCents = Number(whole) * 100 + Number(frac);

  return { amountCents, currency: 'NZD' as const };
};
