-- 02_normalise.sql
-- Views + normalisation + upserts into *_collection / *_alias
/* Flavour expansion and normalisation */
-----------------------------------------
-- Only process in stock PRODUCTS, there can be out of stock FLAVOURS
CREATE OR REPLACE VIEW scraped_in_stock AS
SELECT
  *
FROM
  scraped_products
WHERE
  in_stock = TRUE;

-- Parse scraped flavour strings and expands into rows to extract out of stock flags and price adjustments
-- e.g. "Chocolate +$2.00" -> amount_cents =+ 2.00
-- e.g. "Vanilla (Out of Stock) -> in_stock = FALSE
-- Input: flavours_scraped = ARRAY['Chocolate +$2.00', 'Vanilla (Out of Stock)', 'Strawberry']
--
-- Output:
-- +------------+------------------------+--------------+-----------+
-- | product_id | flavour_scraped        | out_of_stock | price_add |
-- +------------+------------------------+--------------+-----------+
-- | 10         | Chocolate +$2.00       | false        | 2.00      |
-- | 10         | Vanilla (Out of Stock) | true         | 0.00      |
-- | 10         | Strawberry             | false        | 0.00      |
-- +------------+------------------------+--------------+-----------+
CREATE OR REPLACE VIEW scraped_flavours_flags AS
SELECT
  sis.product_id,
  s_flavours_flags.flavour_scraped,
(unaccent(lower(s_flavours_flags.flavour_scraped))
    LIKE '%out of stock%'
    OR unaccent(lower(s_flavours_flags.flavour_scraped))
    LIKE '%not available for selected size%') AS out_of_stock,
  COALESCE(NULLIF((regexp_match(s_flavours_flags.flavour_scraped, '([+-]?)\s*\$\s*(\d+(?:\.\d{1,2})?)'))[2], '')::numeric * CASE WHEN (regexp_match(s_flavours_flags.flavour_scraped, '([+-]?)\s*\$\s*(\d+(?:\.\d{1,2})?)'))[1] = '-' THEN
    -1
  ELSE
    1
  END, 0) AS price_add
FROM
  scraped_in_stock sis
  CROSS JOIN LATERAL unnest(sis.flavours_scraped) AS s_flavours_flags(flavour_scraped);

-- Compute per-flavour surcharges (in cents) and final price for IN-STOCK flavours only
CREATE OR REPLACE VIEW scraped_flavour_stocked AS
SELECT
  s_flavours_flags.product_id,
  s_flavours_flags.flavour_scraped AS flavour_scraped,
  ROUND(s_flavours_flags.price_add * 100)::int AS price_add_cents, -- cents conversion
  sis.amount_cents + ROUND(s_flavours_flags.price_add * 100)::int AS final_amount_cents -- added price for flavour variant
FROM
  scraped_flavours_flags s_flavours_flags
  JOIN scraped_in_stock sis ON sis.product_id = s_flavours_flags.product_id
WHERE
  NOT s_flavours_flags.out_of_stock
  AND btrim(s_flavours_flags.flavour_scraped) <> '';

-- Produces a list of flavour variants and their usage counts, also applies some rules to clean up the strings
CREATE OR REPLACE VIEW flavour_variant_counts AS
SELECT
  lower(btrim(unaccent(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(flavour_scraped, '\s*\+\s*\$\s*\d+(?:\.\d{1,2})?', '', 'gi'), -- remove " +$37.00" / " +$3.04"
                '\s*-\s*dated:\s*\d{2}/\d{4}', '', 'gi'), -- remove " - dated: 01/2026"
              '\s*\(\s*bb\s*\d{2}/\d{2}(?:/\d{2,4})?\s*\)', '', 'gi'), -- remove "(bb 31/01/26)" / "(bb 31/01/2026)"
            '\s*&\s*', ' and ', 'gi'), -- "&" -> " and "
          '\mn\M', ' and ', 'gi') -- standalone "n" -> "and"
))) AS variant,
  COUNT(*) AS count
FROM
  scraped_flavour_stocked
WHERE
  flavour_scraped IS NOT NULL
  AND btrim(flavour_scraped) <> ''
GROUP BY
  1;

-- Picks a single best representative spelling for each scraped flavour variant from the candidates
CREATE OR REPLACE VIEW flavour_best_rep AS
WITH pairs AS (
  SELECT
    a.variant,
    b.variant rep,
    b.count AS rep_count
  FROM
    flavour_variant_counts a
    JOIN flavour_variant_counts b ON similarity(a.variant, b.variant) >= 0.7
),
best_rep AS (
  SELECT
    variant,
    rep,
    rep_count,
    ROW_NUMBER() OVER (PARTITION BY variant ORDER BY rep_count DESC,
      length(rep) ASC,
      rep ASC) AS rank
  FROM
    pairs
)
SELECT
  variant,
  rep,
  rep_count
FROM
  best_rep
WHERE
  rank = 1;


/* Brand normalisation (mirrors flavour flow) */
------------------------------------------------
CREATE OR REPLACE VIEW brand_variant_counts AS
SELECT
  lower(btrim(
      CASE WHEN brand_scraped ~* '^\s*r1\b' THEN
        'Rule 1'
      ELSE
        brand_scraped
      END)) AS variant,
  COUNT(*) AS count
FROM
  scraped_in_stock
WHERE
  brand_scraped IS NOT NULL
  AND btrim(brand_scraped) <> ''
GROUP BY
  1;

-- Top 50 variants by count
SELECT
  *
FROM
  brand_variant_counts
ORDER BY
  count DESC,
  variant
LIMIT 50;

-- Picks a single best representative spelling for each scraped brand variant from the candidates
CREATE OR REPLACE VIEW brand_best_rep AS
WITH pairs AS (
  SELECT
    a.variant,
    b.variant AS rep,
    b.count AS rep_count
  FROM
    brand_variant_counts a
    JOIN brand_variant_counts b ON similarity(a.variant, b.variant) >= 0.85
),
best_rep AS (
  SELECT
    variant,
    rep,
    rep_count,
    ROW_NUMBER() OVER (PARTITION BY variant ORDER BY rep_count DESC,
      length(rep) ASC,
      rep ASC) AS rank
  FROM
    pairs
)
SELECT
  variant,
  rep,
  rep_count
FROM
  best_rep
WHERE
  rank = 1;

-- Flavour normalisation upsert into flavours_collection + flavours_alias
WITH chosen AS (
  SELECT
    variant,
    rep
  FROM
    flavour_best_rep
),
upsert_fc AS (
INSERT INTO flavours_collection(flavour_normalised)
  SELECT DISTINCT
    rep
  FROM
    chosen
  ON CONFLICT (flavour_normalised)
    DO NOTHING)
INSERT INTO flavours_alias(flavour_scraped, flavour_id)
SELECT
  c.variant,
  fc.flavour_id
FROM
  chosen c
  JOIN flavours_collection fc ON fc.flavour_normalised = c.rep
ON CONFLICT (flavour_scraped)
  DO UPDATE SET
    flavour_id = EXCLUDED.flavour_id;

-- Chemist Warehouse: derive flavours from product name when placeholder is used
-- This runs after flavours_collection has been populated
UPDATE
  scraped_products sp
SET
  flavours_scraped = COALESCE((
    SELECT
      array_agg(fc.flavour_normalised::citext ORDER BY fc.flavour_normalised)
    FROM flavours_collection fc
    WHERE
      -- Match flavour as a whole word/phrase
      regexp_replace(unaccent(lower(sp.name_scraped)), '[^a-z0-9]+', ' ', 'g') ~('(^|\\s)' || regexp_replace(unaccent(lower(fc.flavour_normalised)), '[^a-z0-9]+', ' ', 'g') || '(\\s|$)')),
    -- if no flavour found, fall back to empty array instead of 'to be processed'
    '{}'::citext[])
WHERE
  sp.retailer = 'Chemist Warehouse'
  AND sp.flavours_scraped = ARRAY['to be processed']::citext[];

-- Brand normalisation upsert into brands_collection + brands_alias
INSERT INTO brands_collection(brand_normalised)
SELECT DISTINCT
  rep
FROM
  brand_best_rep
ON CONFLICT (brand_normalised)
  DO NOTHING;

INSERT INTO brands_alias(brand_scraped, brand_id)
SELECT
  b.variant AS brand_scraped,
  bc.brand_id
FROM
  brand_best_rep b
  JOIN brands_collection bc ON bc.brand_normalised = b.rep
ON CONFLICT (brand_scraped)
  DO UPDATE SET
    brand_id = EXCLUDED.brand_id;

-- Cleaned product base name (no brand / flavour / size)
CREATE OR REPLACE VIEW name_cleaned AS
WITH base AS (
  SELECT
    sis.product_id,
    sis.name_scraped
  FROM
    scraped_in_stock sis
),
removed_brand AS (
  SELECT
    b.product_id,
    -- Remove brand_scraped, brand_scraped(no spaces), brand_normalised, brand_normalised(no spaces)
    remove_phrases(b.name_scraped, ba.brand_scraped, regexp_replace(ba.brand_scraped, '\s+', '', 'g'), COALESCE(bc.brand_normalised, ''), regexp_replace(COALESCE(bc.brand_normalised, ''), '\s+', '', 'g')) AS name_no_brand FROM base b
    LEFT JOIN scraped_in_stock sis ON sis.product_id = b.product_id
    LEFT JOIN brands_alias ba ON ba.brand_scraped = sis.brand_scraped
    LEFT JOIN brands_collection bc ON bc.brand_id = ba.brand_id),
    collect_flavours AS (
      -- Collect all flavour phrases for each scraped product:
      --   scraped, scraped(no spaces), normalised, normalised(no spaces)
      SELECT
        s.product_id,
        array_remove(array_cat(array_cat(COALESCE(array_agg(DISTINCT s.flavour_scraped::text), '{}'), COALESCE(array_agg(DISTINCT regexp_replace(s.flavour_scraped::text, '\s+', '', 'g')), '{}')), array_cat(COALESCE(array_agg(DISTINCT fc.flavour_normalised::text), '{}'), COALESCE(array_agg(DISTINCT regexp_replace(fc.flavour_normalised::text, '\s+', '', 'g')), '{}'))), NULL) AS phrases
      FROM
        scraped_flavours_flags s
        LEFT JOIN flavours_alias fa ON fa.flavour_scraped = s.flavour_scraped
        LEFT JOIN flavours_collection fc ON fc.flavour_id = fa.flavour_id
      GROUP BY
        s.product_id),
      removed_flavour AS (
        -- Remove all flavour phrases collected above
        SELECT
          rb.product_id,
          btrim(regexp_replace(remove_phrases(rb.name_no_brand, VARIADIC COALESCE(cf.phrases, '{}')), '\s{2,}', ' ', 'g')) AS name_no_brand_flavour
        FROM
          removed_brand rb
        LEFT JOIN collect_flavours cf ON cf.product_id = rb.product_id),
      removed_weight AS (
        -- Remove weight phrases like '2.27kg / 5 lb / 910 g / 16 oz'
        SELECT
          product_id,
          trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(name_no_brand_flavour, '\y[0-9]+(\.[0-9]+)?\s*(kg|kilograms?)\y', '', 'gi'), '\y[0-9]+(\.[0-9]+)?\s*(g|grams?)\y', '', 'gi'), '\y[0-9]+(\.[0-9]+)?\s*(lb|lbs|pounds?)\y', '', 'gi'), '\y[0-9]+(\.[0-9]+)?\s*(oz|ounces?)\y', '', 'gi'), '\(\s*\)', '', 'g'))::citext AS name_cleaned FROM removed_flavour
)
          SELECT
            product_id,
            name_cleaned
          FROM
            removed_weight;


/* Product name normalisation (per brand) */
--------------------------------------------------------------
CREATE OR REPLACE VIEW product_variant_counts AS
SELECT
  bc.brand_id,
  bc.brand_normalised,
  lower(btrim(unaccent(pn.name_cleaned))) AS variant,
  COUNT(*) AS count
FROM
  name_cleaned pn
  JOIN scraped_in_stock sis ON sis.product_id = pn.product_id
  LEFT JOIN brands_alias ba ON ba.brand_scraped = sis.brand_scraped
  LEFT JOIN brands_collection bc ON bc.brand_id = ba.brand_id
WHERE
  bc.brand_id IS NOT NULL
  AND pn.name_cleaned IS NOT NULL
  AND btrim(pn.name_cleaned) <> ''
GROUP BY
  bc.brand_id,
  bc.brand_normalised,
  lower(btrim(unaccent(pn.name_cleaned)));

-- Top 50 variants by count
SELECT
  *
FROM
  product_variant_counts
ORDER BY
  count DESC,
  brand_normalised,
  variant
LIMIT 50;


/* Product best representative (per brand) */
---------------------------------------------
CREATE OR REPLACE VIEW product_best_rep AS
WITH pairs AS (
  SELECT
    a.brand_id,
    a.brand_normalised,
    a.variant,
    b.variant AS rep,
    b.count AS rep_count
  FROM
    product_variant_counts a
    JOIN product_variant_counts b ON a.brand_id = b.brand_id
      AND similarity(a.variant, b.variant) >= 0.7
),
best_rep AS (
  SELECT
    brand_id,
    brand_normalised,
    variant,
    rep,
    rep_count,
    ROW_NUMBER() OVER (PARTITION BY brand_id,
      variant ORDER BY rep_count DESC,
      length(rep) ASC,
      rep ASC) AS rank
  FROM
    pairs
)
SELECT
  brand_id,
  brand_normalised,
  variant,
  rep,
  rep_count
FROM
  best_rep
WHERE
  rank = 1;

-- Use product_best_rep view (assumed defined) to upsert into products_collection + product_alias
WITH chosen AS (
  SELECT
    brand_id,
    variant,
    rep
  FROM
    product_best_rep
),
upsert_pc AS (
INSERT INTO products_collection(brand_id, product_normalised)
  SELECT DISTINCT
    brand_id,
    rep
  FROM
    chosen
  ON CONFLICT (brand_id,
    product_normalised)
    DO NOTHING)
INSERT INTO product_alias(brand_id, name_normalised, name_id)
SELECT
  c.brand_id,
  c.variant,
  pc.product_id
FROM
  chosen c
  JOIN products_collection pc ON pc.brand_id = c.brand_id
    AND pc.product_normalised = c.rep
  ON CONFLICT (brand_id,
    name_normalised)
    DO UPDATE SET
      name_id = EXCLUDED.name_id;

