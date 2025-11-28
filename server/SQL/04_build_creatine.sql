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

------------------------------------------------------------
-- Drop & recreate output tables
------------------------------------------------------------
DROP TABLE IF EXISTS creatine_offers CASCADE;

DROP TABLE IF EXISTS creatine_final CASCADE;

CREATE TABLE IF NOT EXISTS creatine_offers(
  product_id bigint NOT NULL, -- canonical id (per brand+base_name+size+currency)
  brand citext,
  name citext, -- base product name, no size
  weight_grams integer,
  retailer citext NOT NULL,
  price integer NOT NULL,
  currency citext NOT NULL,
  url citext NOT NULL
);

CREATE TABLE IF NOT EXISTS creatine_final(
  product_id bigint NOT NULL, -- canonical id (per brand+base_name+size+currency)
  brand citext,
  name citext, -- base product name, no size
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
-- Step 1: Clean scraped creatine and assign canonical IDs
------------------------------------------------------------
WITH cleaned AS (
  SELECT
    sc.product_id, -- scraped id, only used to derive canonical id
    initcap(unaccent(sc.brand_scraped))::citext AS brand,
    -- Base product name (no brand, no size):
    --  - lower + unaccent + trim
    --  - strip "dated 10/25" style phrases
    --  - strip size tokens like "250g", "2kg", "250 g", "2.27 kg"
    --  - strip leading brand name (e.g. "Athletech", "Muscletech")
    --  - collapse multiple spaces
    --  - initcap at the end
    initcap(btrim(regexp_replace(regexp_replace(regexp_replace(
              -- remove size: "250g", "2kg", "250 g", "2.27 kg"
              regexp_replace(
                -- remove " - dated 10/25" / "dated 01/2026"
                lower(btrim(unaccent(sc.name_scraped::text))), '\s*[-–]?\s*dated\s*\d{1,2}/\d{2,4}', '', 'gi'), '\s*\d+(?:\.\d+)?\s*(kg|g)\b', '', 'gi'),
            -- remove leading brand: "Athletech " / "Muscletech " etc.
            '^' || lower(unaccent(sc.brand_scraped::text)) || '\s+', '', 'i'), '\s{2,}', ' ', 'g')))::citext AS name,
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
canonical_ids AS (
  -- Stable canonical id per (brand, base_name, size, currency)
  SELECT
    MIN(product_id) AS canonical_product_id,
    brand,
    name,
    weight_grams,
    currency
  FROM
    cleaned
  GROUP BY
    brand,
    name,
    weight_grams,
    currency
),
dedup AS (
  -- One row per (canonical product × size × currency × retailer) with min price
  SELECT
    c.canonical_product_id AS product_id,
    c.brand,
    c.name,
    c.weight_grams,
    c.currency,
    cl.retailer,
    MIN(cl.price) AS price,
    MIN(cl.url) AS url
  FROM
    cleaned cl
    JOIN canonical_ids c ON c.brand = cl.brand
      AND c.name = cl.name
      AND c.weight_grams = cl.weight_grams
      AND c.currency = cl.currency
  GROUP BY
    c.canonical_product_id,
    c.brand,
    c.name,
    c.weight_grams,
    c.currency,
    cl.retailer)
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
-- Step 2: build creatine_final (one row per canonical product × size)
------------------------------------------------------------
WITH aggregated AS (
  -- Per (canonical product × size × currency), get the cheapest price
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    MIN(price) AS min_price
  FROM
    creatine_offers
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency
),
value_ranges AS (
  -- Compute min/max raw value (grams per cent) for scaling to 0–100
  SELECT
    MIN(weight_grams::numeric / NULLIF(min_price, 0)) AS min_raw_value,
    MAX(weight_grams::numeric / NULLIF(min_price, 0)) AS max_raw_value
  FROM
    aggregated
  WHERE
    min_price > 0
    AND weight_grams IS NOT NULL
    AND weight_grams > 0
),
scored AS (
  -- Attach value_score (0–100) to each product row
  SELECT
    a.*,
    CASE WHEN a.min_price <= 0 THEN
      NULL
    WHEN a.weight_grams IS NULL THEN
      NULL
    WHEN a.weight_grams <= 0 THEN
      NULL
    WHEN vr.max_raw_value IS NULL THEN
      100::numeric
    WHEN vr.max_raw_value = vr.min_raw_value THEN
      100::numeric
    ELSE
      ROUND(((a.weight_grams::numeric / a.min_price) - vr.min_raw_value) / NULLIF(vr.max_raw_value - vr.min_raw_value, 0) * 100, 0)
    END AS value_score
  FROM
    aggregated a
    CROSS JOIN value_ranges vr)
INSERT INTO creatine_final(product_id, brand, name, weight_grams, price, currency, retailer, url, value_score, slug)
SELECT
  s.product_id,
  s.brand,
  s.name,
  s.weight_grams,
  s.min_price AS price,
  s.currency,
  -- pick any retailer with the min price
(
    SELECT
      MIN(co.retailer)
    FROM creatine_offers co
    WHERE
      co.product_id = s.product_id
      AND co.weight_grams = s.weight_grams
      AND co.currency = s.currency
      AND co.price = s.min_price) AS retailer,
(
    SELECT
      MIN(co.url)
    FROM
      creatine_offers co
    WHERE
      co.product_id = s.product_id
      AND co.weight_grams = s.weight_grams
      AND co.currency = s.currency
      AND co.price = s.min_price) AS url,
  s.value_score,
  slugify(COALESCE(s.brand::text, '') || ' ' || COALESCE(s.name::text, '') || ' ' || CASE WHEN s.weight_grams IS NULL THEN
      ''
    ELSE
      trim(TRAILING '0' FROM trim(TRAILING '.' FROM (ROUND(s.weight_grams::numeric / 1000, 2)::text))) || 'kg'
    END) AS slug
FROM
  scored s;

------------------------------------------------------------
-- Step 3: snapshot today's prices into history (creatine)
------------------------------------------------------------
INSERT INTO price_history(category, product_id, weight_grams, retailer, price, currency, snapshot_date)
SELECT
  'creatine'::citext AS category,
  product_id, -- canonical id
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

