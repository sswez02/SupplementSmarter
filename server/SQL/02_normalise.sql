-- 02_normalise.sql
-- Views + normalisation + upserts into *_collection / *_alias
/* Flavour expansion and normalisation */
-----------------------------------------
-- Only process in stock PRODUCTS, there can be out of stock FLAVOURS
CREATE OR REPLACE VIEW flavour_variant_counts AS
SELECT
  lower(btrim(
      CASE WHEN flavour_scraped ~* '^\s*r1\b' THEN
        'Rule 1'
      ELSE
        flavour_scraped
      END)) AS variant,
  COUNT(*) AS count
FROM
  scraped_in_stock
WHERE
  flavour_scraped IS NOT NULL
  AND btrim(flavour_scraped) <> ''
GROUP BY
  1;

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

-- Now proceed with other views and functions, ensuring the order is correct
CREATE OR REPLACE VIEW scraped_in_stock AS
SELECT
  *
FROM
  scraped_products
WHERE
  in_stock = TRUE;

-- Helper function for removing specific phrases from strings
CREATE OR REPLACE FUNCTION remove_phrases(src citext, phrase1 citext, variant1 text, phrase2 citext, variant2 text)
  RETURNS citext
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
  -- function code remains unchanged
$$;

-- Create views and perform normalisation logic for flavours and brands here...
-- Final views and insertions
WITH chosen AS (
  SELECT
    variant,
    rep
  FROM
    flavour_best_rep)
INSERT INTO flavours_collection(flavour_normalised)
SELECT DISTINCT
  rep
FROM
  chosen
ON CONFLICT (flavour_normalised)
  DO NOTHING;

-- 03_filter_creatine.sql
-- Filter in-scope products (creatine only before building final tables)
CREATE OR REPLACE VIEW scraped_creatine_only AS
WITH base AS (
  SELECT
    sis.*,
    nc.name_cleaned
  FROM
    scraped_in_stock sis
    LEFT JOIN name_cleaned nc ON nc.product_id = sis.product_id
)
SELECT
  product_id,
  retailer,
  brand_scraped,
  name_scraped,
  flavours_scraped,
  weight_grams,
  amount_cents,
  currency_scraped,
  url,
  in_stock,
  scraped_at,
  json
FROM
  base
WHERE
  -- Must have a real weight
  weight_grams IS NOT NULL
  AND weight_grams > 0
  -- Must have a usable name
  AND COALESCE(name_cleaned::text, name_scraped::text) IS NOT NULL
  AND btrim(COALESCE(name_cleaned::text, name_scraped::text)) <> ''
  -- Must look like a creatine product
  AND (COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%creatine%'
    OR COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%creapure%'
    OR COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%monohydrate%');

