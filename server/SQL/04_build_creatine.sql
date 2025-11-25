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
  url citext NOT NULL,
  value_score numeric -- 0–100 scaled “value” (higher = better grams per cent)
);

TRUNCATE TABLE creatine_offers;

TRUNCATE TABLE creatine_final;

WITH raw AS (
  -- Step 1: build rows with one row per (product × size × retailer)
  SELECT
    pc.product_id AS product_id,
    initcap(bc.brand_normalised) AS brand,
    -- Use product_normalised / name_cleaned and strip "dated" phrases before initcap
    initcap(btrim(regexp_replace(regexp_replace(COALESCE(pc.product_normalised, lower(btrim(unaccent(nc.name_cleaned)))), '\s*[-–]?\s*dated\s*\d{1,2}/\d{2,4}', '', 'gi'), '\s{2,}', ' ', 'g'))) AS name,
    sis.weight_grams AS weight_grams,
    sis.amount_cents AS price,
    sis.currency_scraped AS currency,
    sis.retailer AS retailer,
    sis.url AS url,
    ROW_NUMBER() OVER (PARTITION BY pc.product_id,
      sis.weight_grams,
      sis.currency_scraped,
      sis.retailer ORDER BY sis.amount_cents ASC) AS rn
  FROM
    scraped_creatine_only sis
    JOIN name_cleaned nc ON nc.product_id = sis.product_id
    LEFT JOIN brands_alias ba ON ba.brand_scraped = sis.brand_scraped
    LEFT JOIN brands_collection bc ON bc.brand_id = ba.brand_id
    LEFT JOIN products_collection pc ON pc.brand_id = bc.brand_id
      AND pc.product_normalised = lower(btrim(unaccent(nc.name_cleaned)))
  WHERE
    pc.product_id IS NOT NULL
),
cheapest AS (
  -- Step 2: keep only the cheapest row per (product × size × currency × retailer)
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    price,
    currency,
    retailer,
    url
  FROM
    raw
  WHERE
    rn = 1
),
offers_aggregated AS (
  -- Step 3a: per (product × size × currency × retailer): take lowest price (no flavours to aggregate)
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer,
    MIN(price) AS price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer
),
aggregated AS (
  -- Step 3b: per (product × size × currency): take lowest price across all retailers
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    MIN(price) AS min_price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency
),
value_ranges AS (
  -- Step 3c: compute min/max raw value (grams per cent) for scaling to 0–100
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
  -- Step 3d: attach value_score (0–100) to each creatine product row
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
    CROSS JOIN value_ranges vr
),
insert_offers AS (
  -- Step 4a: insert into creatine_offers, picking a URL for the cheapest price per retailer
  INSERT INTO creatine_offers(product_id, brand, name, weight_grams, retailer, price, currency, url)
  SELECT
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.price,
    oa.currency,
    MIN(c.url) AS url -- any URL among those with the min price for that retailer
  FROM
    offers_aggregated oa
    JOIN cheapest c ON c.product_id = oa.product_id
      AND c.weight_grams = oa.weight_grams
      AND c.currency = oa.currency
      AND c.retailer = oa.retailer
      AND c.price = oa.price
  GROUP BY
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.price,
    oa.currency
  RETURNING
    1)
  -- Step 4b: insert into creatine_final, picking a URL for the global lowest price
  INSERT INTO creatine_final(product_id, brand, name, weight_grams, price, currency, url, value_score)
  SELECT
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.min_price AS price,
    s.currency,
    MIN(c.url) AS url, -- any URL among those with the global min price
    s.value_score
  FROM
    scored s
    JOIN cheapest c ON c.product_id = s.product_id
      AND c.weight_grams = s.weight_grams
      AND c.currency = s.currency
      AND c.price = s.min_price
  GROUP BY
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.min_price,
    s.currency,
    s.value_score;

-- 04_build_creatine.sql
-- Build denormalised comparison tables for creatine:
--   1) creatine_offers – all retailers
--   2) creatine_final  – cheapest overall per product × size
--
-- This mirrors the protein 04_build pipeline but:
--   - Uses scraped_creatine_only instead of scraped_protein_only
--   - Does NOT use flavour expansion or flavour-based price adjustments
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
  url citext NOT NULL,
  value_score numeric, -- 0–100 scaled “value” (higher = better grams per cent)
  slug citext
);

TRUNCATE TABLE creatine_offers;

TRUNCATE TABLE creatine_final;

WITH raw AS (
  -- Step 1: build rows with one row per (product × size × retailer)
  SELECT
    pc.product_id AS product_id,
    initcap(bc.brand_normalised) AS brand,
    -- Use product_normalised / name_cleaned and strip "dated" phrases before initcap
    initcap(btrim(regexp_replace(regexp_replace(COALESCE(pc.product_normalised, lower(btrim(unaccent(nc.name_cleaned)))), '\s*[-–]?\s*dated\s*\d{1,2}/\d{2,4}', '', 'gi'), '\s{2,}', ' ', 'g'))) AS name,
    sis.weight_grams AS weight_grams,
    sis.amount_cents AS price,
    sis.currency_scraped AS currency,
    sis.retailer AS retailer,
    sis.url AS url,
    ROW_NUMBER() OVER (PARTITION BY pc.product_id,
      sis.weight_grams,
      sis.currency_scraped,
      sis.retailer ORDER BY sis.amount_cents ASC) AS rn
  FROM
    scraped_creatine_only sis
    JOIN name_cleaned nc ON nc.product_id = sis.product_id
    LEFT JOIN brands_alias ba ON ba.brand_scraped = sis.brand_scraped
    LEFT JOIN brands_collection bc ON bc.brand_id = ba.brand_id
    LEFT JOIN products_collection pc ON pc.brand_id = bc.brand_id
      AND pc.product_normalised = lower(btrim(unaccent(nc.name_cleaned)))
  WHERE
    pc.product_id IS NOT NULL
    AND sis.retailer <> 'Chemist Warehouse'
),
cheapest AS (
  -- Step 2: keep only the cheapest row per (product × size × currency × retailer)
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    price,
    currency,
    retailer,
    url
  FROM
    raw
  WHERE
    rn = 1
),
offers_aggregated AS (
  -- Step 3a: per (product × size × currency × retailer): take lowest price (no flavours to aggregate)
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer,
    MIN(price) AS price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    retailer
),
aggregated AS (
  -- Step 3b: per (product × size × currency): take lowest price across all retailers
  SELECT
    product_id,
    brand,
    name,
    weight_grams,
    currency,
    MIN(price) AS min_price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_grams,
    currency
),
value_ranges AS (
  -- Step 3c: compute min/max raw value (grams per cent) for scaling to 0–100
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
  -- Step 3d: attach value_score (0–100) to each creatine product row
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
    CROSS JOIN value_ranges vr
),
insert_offers AS (
  -- Step 4a: insert into creatine_offers, picking a URL for the cheapest price per retailer
  INSERT INTO creatine_offers(product_id, brand, name, weight_grams, retailer, price, currency, url)
  SELECT
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.price,
    oa.currency,
    MIN(c.url) AS url -- any URL among those with the min price for that retailer
  FROM
    offers_aggregated oa
    JOIN cheapest c ON c.product_id = oa.product_id
      AND c.weight_grams = oa.weight_grams
      AND c.currency = oa.currency
      AND c.retailer = oa.retailer
      AND c.price = oa.price
  GROUP BY
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.price,
    oa.currency
  RETURNING
    1)
  -- Step 4b: insert into creatine_final, picking a URL for the global lowest price
  INSERT INTO creatine_final(product_id, brand, name, weight_grams, price, currency, url, value_score, slug)
  SELECT
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.min_price AS price,
    s.currency,
    MIN(c.url) AS url, -- any URL among those with the global min price
    s.value_score,
    regexp_replace(regexp_replace(lower(unaccent(COALESCE(s.brand, '') || ' ' || COALESCE(s.name, '') || ' ' || CASE WHEN s.weight_grams IS NULL THEN
              ''
            ELSE
              trim(TRAILING '0' FROM trim(TRAILING '.' FROM (ROUND(s.weight_grams::numeric / 1000, 2)::text))) || 'kg'
            END)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g') AS slug
  FROM
    scored s
    JOIN cheapest c ON c.product_id = s.product_id
      AND c.weight_grams = s.weight_grams
      AND c.currency = s.currency
      AND c.price = s.min_price
  GROUP BY
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.min_price,
    s.currency,
    s.value_score;

-- Step 5: snapshot today's prices into history (creatine)
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

-- Helper: slugify "Brand Name 2.27kg" -> "brand-name-2-27kg"
CREATE OR REPLACE FUNCTION slugify(input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    regexp_replace(regexp_replace(lower(unaccent(input)), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
$$;

