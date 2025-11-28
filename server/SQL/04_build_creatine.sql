-- 04_build_creatine.sql
-- Build denormalised comparison tables:
--   1) creatine_offers – all retailers
--   2) creatine_final  – cheapest overall per product × size
--
-- Table 1: creatine_offers
-- ------------------------
-- One row per (representative creatine product × size × retailer),
-- deduplicated per retailer.
--
-- Columns:
--  product_id   – representative product id from products_collection.product_id
--  brand        – representative brand name, Title Case (from brand_normalised)
--  name         – cleaned base product name, Title Case (no brand / size)
--  weight_grams – pack size in grams
--  retailer     – retailer name, as scraped
--  price        – lowest price for that product/size at that retailer (cents)
--  currency     – e.g. 'NZD' (kept as-is)
--  url          – product page link for one of the cheapest offers at that retailer
--
-- Example output (creatine_offers):
-- product_id | brand              | name                 | weight_grams | retailer | price | currency | url
-- -----------+--------------------+----------------------+-------------+----------+-------+----------+-----
--     1      | Optimum Nutrition  | Creatine Monohydrate |    300       | Xplosiv  |  3995 |  NZD     | ...
--     1      | Optimum Nutrition  | Creatine Monohydrate |    300       | NZProtein|  4295 |  NZD     | ...
--
--
-- Table 2: creatine_final
-- -----------------------
-- One row per (representative creatine product × size),
-- deduplicated across retailers.
--
-- Columns:
--  product_id   – representative product id from products_collection.product_id
--  brand        – representative brand name, Title Case (from brand_normalised)
--  name         – cleaned base product name, Title Case (no brand / size)
--  weight_grams – pack size in grams
--  price        – lowest price found across all retailers (cents)
--  currency     – e.g. 'NZD' (kept as-is)
--  url          – product page link for one of the cheapest offers (any retailer)
--  value_score  – 0–100 scaled value score (higher = better grams per cent)
--
-- Example output (creatine_final):
-- product_id | brand              | name                 | weight_grams | price | value_score | currency | url
-- -----------+--------------------+----------------------+-------------+-------+-------------+----------+-----
--     1      | Optimum Nutrition  | Creatine Monohydrate |    300       |  3995 |    100      |  NZD     | ...
--     2      | Musashi            | Creatine Monohydrate |    500       |  4995 |     82      |  NZD     | ...
DROP TABLE IF EXISTS creatine_offers CASCADE;

DROP TABLE IF EXISTS creatine_final CASCADE;

CREATE TABLE IF NOT EXISTS creatine_offers(
  product_id bigint NOT NULL,
  brand citext,
  name citext,
  weight_grams integer,
  retailer citext NOT NULL,
  price integer NOT NULL,
  currency citext NOT NULL,
  url citext NOT NULL
);

CREATE TABLE IF NOT EXISTS creatine_final(
  product_id bigint NOT NULL,
  brand citext,
  name citext,
  weight_grams integer,
  price integer NOT NULL,
  currency citext NOT NULL,
  retailer citext,
  url citext NOT NULL,
  value_score numeric, -- 0–100 scaled “value” (higher = better grams per cent)
  slug citext
);

TRUNCATE TABLE creatine_offers;

TRUNCATE TABLE creatine_final;

------------------------------------------------------------
-- Step 1: populate creatine_offers from scraped_creatine_only
------------------------------------------------------------
WITH cleaned AS (
  SELECT
    sc.product_id,
    initcap(unaccent(sc.brand_scraped))::citext AS brand,
    initcap(btrim(regexp_replace(regexp_replace(lower(unaccent(sc.name_scraped::text)), '\s*[-–]?\s*dated\s*\d{1,2}/\d{2,4}', '', 'gi'), '\s{2,}', ' ', 'g')))::citext AS name,
    sc.weight_grams,
    sc.amount_cents AS price,
    sc.currency_scraped AS currency,
    sc.retailer,
    sc.url
  FROM
    scraped_creatine_only sc
  WHERE
    sc.weight_grams IS NOT NULL
    AND sc.weight_grams > 0
    AND sc.amount_cents IS NOT NULL
    AND sc.amount_cents > 0
),
dedup AS (
  -- one row per (product, brand, name, size, currency, retailer) with min price
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer,
    MIN(price) AS price,
    MIN(url) AS url
  FROM
    cleaned
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer)
INSERT INTO creatine_offers(product_id, brand, name, weight_grams, retailer, price, currency, url)
SELECT
  product_id,
  brand,
  name,
  weight_grams,
  retailer,
  price,
  currency,
  url
FROM
  dedup;

------------------------------------------------------------
-- Step 2: build creatine_final from creatine_offers
------------------------------------------------------------
WITH base AS (
  SELECT
    co.*,
    CASE WHEN co.price > 0
      AND co.weight_grams IS NOT NULL
      AND co.weight_grams > 0 THEN
      co.weight_grams::numeric / co.price
    ELSE
      NULL
    END AS raw_value,
    ROW_NUMBER() OVER (PARTITION BY co.brand,
      co.name,
      co.weight_grams,
      co.currency ORDER BY co.price ASC,
      co.retailer ASC) AS best_rank
  FROM
    creatine_offers co
  WHERE
    co.weight_grams IS NOT NULL
    AND co.weight_grams > 0
    AND co.price > 0
),
rng AS (
  SELECT
    b.*,
    MIN(raw_value) OVER () AS min_raw_value,
    MAX(raw_value) OVER () AS max_raw_value
  FROM
    base b)
INSERT INTO creatine_final(product_id, brand, name, weight_grams, price, currency, retailer, url, value_score, slug)
SELECT
  product_id,
  brand,
  name,
  weight_grams,
  price,
  currency,
  retailer,
  url,
  CASE WHEN raw_value IS NULL THEN
    NULL
  WHEN max_raw_value IS NULL
    OR max_raw_value = min_raw_value THEN
    100::numeric
  ELSE
    ROUND((raw_value - min_raw_value) / NULLIF(max_raw_value - min_raw_value, 0) * 100, 0)
  END AS value_score,
  slugify(COALESCE(brand::text, '') || ' ' || COALESCE(name::text, '') || ' ' || CASE WHEN weight_grams IS NULL THEN
      ''
    ELSE
      trim(TRAILING '0' FROM trim(TRAILING '.' FROM (ROUND(weight_grams::numeric / 1000, 2)::text))) || 'kg'
    END) AS slug
FROM
  rng
WHERE
  best_rank = 1;

------------------------------------------------------------
-- Step 3: snapshot today's prices into history (creatine)
------------------------------------------------------------
INSERT INTO price_history(category, product_id, weight_grams, retailer, price, currency, snapshot_date)
SELECT
  'creatine'::citext AS category,
  product_id,
  weight_grams,
  retailer,
  price,
  currency,
  CURRENT_DATE AS snapshot_date
FROM
  creatine_offers
ON CONFLICT (category,
  product_id,
  weight_grams,
  retailer,
  snapshot_date)
  DO UPDATE SET
    price = EXCLUDED.price,
    currency = EXCLUDED.currency;

------------------------------------------------------------
-- Helper: slugify "Brand Name 2.27kg" -> "brand-name-2-27kg"
------------------------------------------------------------
CREATE OR REPLACE FUNCTION slugify(input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    regexp_replace(regexp_replace(lower(unaccent(input)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
$$;

