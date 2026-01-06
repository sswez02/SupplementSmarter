## Normalisation & matching: turning noisy retailer listings into canonical products

Retailer listings vary heavily:

- Inconsistent naming and punctuation
- Pack size / unit formats (kg, g, lb, “2x1kg”)
- Flavour variants (“Chocolate”, “Choc”, “Double Choc”)
- Brand aliases (“Optimum Nutrition” vs “ON”)

SupplementSmarter solves this with a deterministic, rule-based normalisation + matching pipeline that produces stable canonical products and clean tables for the API

---

## Pipeline overview

1. **Scrape** retailer listings into a raw snapshot table
2. **Normalise** core fields (brand, name, units/weights, in-stock)
3. **Canonicalise** text (lowercase, unaccent, whitespace collapse)
4. **Apply aliases** for brand and flavour variants
5. **Derive a base product name** by stripping removable tokens (brand/flavour/weight phrases)
6. **Cluster + match** using similarity thresholds
7. **Write read-optimised tables** keyed by canonical identity + weight dimension

---

## What normalisation means here

Normalisation aims to make fields comparable across sources, so you can compare products across different name variants

### Brand normalisation

- Retailer brand strings are mapped to a stable `brand_normalised`
- Aliases handle common variants (e.g. abbreviations, punctuation differences)

### Name normalisation

- Listing titles are transformed into a normalised representation:
  - Lowercase
  - Remove accents (unaccent)
  - Collapse whitespace
  - Standardise separators
- Flavour and weight phrases are removed to derive a `product_base_name`

### Weight and unit normalisation

Weights are parsed into a single numeric field, typically `weight_g`:

- kg -> g
- lb/oz -> g

---

## Canonical product identity

Conceptually, a canonical product resolves to:

```text
(category, brand_normalised, product_normalised)
```

Weight is treated as a normalised dimension for history and comparisons:

Price history is tracked per canonical product and weight

Offers from multiple retailers aggregate up to the same canonical identity when they represent the same underlying product

## Matching strategy (deterministic + explainable)

Matching is rule-based and implemented directly in SQL, using:

- Text normalisation functions (`lower`, `unaccent`, whitespace cleanup)
- Alias tables (brand + flavour)
- Similarity where needed via `pg_trgm` (trigram similarity)

### Similarity use

After removing obvious variance (brand/flavour/weight tokens), similarity is used to decide whether two strings represent the same base product

---

## Best representative string selection

Within a matched cluster (variant group), a representative display name is chosen deterministically

The most popular in count among the cluster is selected as the representative string
