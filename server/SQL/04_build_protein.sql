-- 04_build.sql
-- Build denormalised comparison tables:
--   1) products_offers – all retailers, flavours compressed
--   2) products_final  – cheapest overall per product × size
--
-- Table 1: products_offers
-- ------------------------
-- One row per (representative product × size × retailer),
-- deduplicated across flavours for that retailer
--
-- Columns:
--  product_id   – representative product id from products_collection.product_id
--  brand        – representative brand name, Title Case (from brand_normalised)
--  name         – cleaned base product name, Title Case (no brand / flavour / size)
--  weight_grams – pack size in grams
--  retailer     – retailer name, as scraped
--  flavours     – comma-separated list of flavours available at that retailer, Title Case
--  price        – lowest price across all flavours at that retailer (cents)
--  currency     – e.g. 'NZD' (kept as-is)
--  url          – product page link for one of the cheapest offers at that retailer
--
-- Example output (products_offers):
-- product_id | brand              | name                     | weight_grams | retailer | flavours                       | price | currency | url
-- -----------+--------------------+--------------------------+-------------+----------+---------------------------------+-------+----------+-----
--     1      | Optimum Nutrition  | Gold Standard 100% Whey  |    2270      | Xplosiv  | Choc, Vanilla, Cookies & Cream |  8795 |  NZD     | ...
--     1      | Optimum Nutrition  | Gold Standard 100% Whey  |    2270      | NZProtein| Choc, Vanilla                  |  8995 |  NZD     | ...
--     2      | Musashi            | 100% Whey Protein        |     900      | Xplosiv  | Choc, Cookies & Cream          |  5995 |  NZD     | ...
--
--
-- Table 2: products_final
-- -----------------------
-- One row per (representative product × size),
-- deduplicated across flavours & retailers.
--
-- Columns:
--  product_id   – representative product id from products_collection.product_id
--  brand        – representative brand name, Title Case (from brand_normalised)
--  name         – cleaned base product name, Title Case (no brand / flavour / size)
--  weight_grams – pack size in grams
--  flavours     – comma-separated list of flavours across all retailers, Title Case
--  price        – lowest price found across all flavours/retailers (cents)
--  currency     – e.g. 'NZD' (kept as-is)
--  url          – product page link for one of the cheapest offers (any retailer)
--  value_score  – 0–100 scaled value score (higher = better grams per cent)
--
-- Example output (products_final):
-- product_id | brand              | name                     | weight_grams | flavours                       | price | value_score | currency | url
-- -----------+--------------------+--------------------------+-------------+---------------------------------+-------+-------------+----------+-----
--     1      | Optimum Nutrition  | Gold Standard 100% Whey  |    2270      | Choc, Vanilla, Cookies & Cream |  8795 |    100      |  NZD     | ...
--     2      | Musashi            | 100% Whey Protein        |     900      | Choc, Cookies & Cream          |  5995 |     72      |  NZD     | ...
DROP TABLE IF EXISTS products_offers CASCADE;

DROP TABLE IF EXISTS products_final CASCADE;

CREATE TABLE IF NOT EXISTS products_offers(
  product_id bigint NOT NULL,
  brand citext,
  name citext,
  weight_grams integer,
  retailer citext NOT NULL,
  flavours citext,
  price integer NOT NULL,
  currency citext NOT NULL,
  url citext NOT NULL
);

CREATE TABLE IF NOT EXISTS products_final(
  product_id bigint NOT NULL,
  brand citext,
  name citext,
  weight_grams integer,
  flavours citext,
  price integer NOT NULL,
  currency citext NOT NULL,
  retailer citext,
  url citext NOT NULL,
  value_score numeric, -- 0–100 scaled “value” (higher = better grams per cent)
  slug citext
);

TRUNCATE TABLE products_offers;

TRUNCATE TABLE products_final;

WITH flavours_prepared AS (
  -- Clean flavour strings to the same "variant" key used in flavour_variant_counts / flavours_alias
  SELECT
    sfs.product_id,
    sfs.flavour_scraped,
    sfs.price_add_cents,
    sfs.final_amount_cents,
    lower(btrim(unaccent(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(sfs.flavour_scraped, '\s*\+\s*\$\s*\d+(?:\.\d{1,2})?', '', 'gi' -- remove " +$37.00" / " +$3.04"
), '\s*-\s*dated:\s*\d{2}/\d{4}', '', 'gi' -- remove " - dated: 01/2026"
), '\s*\(\s*bb\s*\d{2}/\d{2}(?:/\d{2,4})?\s*\)', '', 'gi' -- remove "(bb 31/01/26)" / "(bb 31/01/2026)"
), '\s*&\s*', ' and ', 'gi' -- "&" -> " and "
), '\mn\M', ' and ', 'gi' -- standalone "n" -> "and"
)))) AS flavour_key
  FROM
    scraped_flavour_stocked sfs
),
raw AS (
  -- Step 1: build rows with one row per (product × flavour × size × retailer)
  SELECT
    pc.product_id AS product_id,
    initcap(bc.brand_normalised) AS brand,
    -- Use product_normalised / name_cleaned and strip "dated" phrases before initcap
    initcap(btrim(regexp_replace(regexp_replace(COALESCE(pc.product_normalised, lower(btrim(unaccent(nc.name_cleaned)))), '\s*[-–]?\s*dated\s*\d{1,2}/\d{2,4}', -- " - Dated 10/25" / "dated 01/2026"
            '', 'gi'), '\s{2,}', ' ', 'g'))) AS name,
    initcap(COALESCE(fc.flavour_normalised, fp.flavour_key)) AS flavour,
    sis.weight_grams AS weight_grams,
    FLOOR(sis.weight_grams::numeric / 100) AS weight_bucket,
    fp.final_amount_cents AS price,
    sis.currency_scraped AS currency,
    sis.retailer AS retailer,
    sis.url AS url,
    ROW_NUMBER() OVER (PARTITION BY pc.product_id,
      initcap(COALESCE(fc.flavour_normalised, fp.flavour_key)),
      FLOOR(sis.weight_grams::numeric / 100),
      sis.currency_scraped,
      sis.retailer ORDER BY fp.final_amount_cents ASC) AS rn
  FROM
    scraped_protein_only sis
    JOIN name_cleaned nc ON nc.product_id = sis.product_id
    LEFT JOIN brands_alias ba ON ba.brand_scraped = sis.brand_scraped
    LEFT JOIN brands_collection bc ON bc.brand_id = ba.brand_id
    LEFT JOIN products_collection pc ON pc.brand_id = bc.brand_id
      AND pc.product_normalised = lower(btrim(unaccent(nc.name_cleaned)))
    JOIN flavours_prepared fp ON fp.product_id = sis.product_id
    LEFT JOIN flavours_alias fa ON fa.flavour_scraped = fp.flavour_key
    LEFT JOIN flavours_collection fc ON fc.flavour_id = fa.flavour_id
  WHERE
    pc.product_id IS NOT NULL
),
cheapest AS (
  -- Step 2: keep only the cheapest row per (product × flavour × approx size × currency × retailer)
  SELECT
    product_id,
    brand,
    name,
    flavour,
    weight_grams,
    weight_bucket,
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
  -- Step 3a: per (product × size × currency × retailer): aggregate flavours and take lowest price
  SELECT
    product_id,
    brand,
    name,
    MIN(weight_grams) AS weight_grams,
    currency,
    retailer,
    string_agg(DISTINCT flavour, ', ' ORDER BY flavour) AS flavours,
    MIN(price) AS price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_bucket,
    currency,
    retailer
),
aggregated AS (
  -- Step 3b: per (product × size × currency): aggregate flavours across all retailers, take lowest price
  SELECT
    product_id,
    brand,
    name,
    MIN(weight_grams) AS weight_grams,
    currency,
    string_agg(DISTINCT flavour, ', ' ORDER BY flavour) AS flavours,
    MIN(price) AS min_price
  FROM
    cheapest
  GROUP BY
    product_id,
    brand,
    name,
    weight_bucket,
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
  -- Step 3d: attach value_score (0–100) to each product row
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
  -- Step 4a: insert into products_offers, picking a URL for the cheapest price per retailer
  INSERT INTO products_offers(product_id, brand, name, weight_grams, retailer, flavours, price, currency, url)
  SELECT
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.flavours,
    oa.price,
    oa.currency,
    MIN(c.url) AS url -- any URL among those with the min price for that retailer
  FROM
    offers_aggregated oa
    JOIN cheapest c ON c.product_id = oa.product_id
      AND c.currency = oa.currency
      AND c.retailer = oa.retailer
      AND c.price = oa.price
  GROUP BY
    oa.product_id,
    oa.brand,
    oa.name,
    oa.weight_grams,
    oa.retailer,
    oa.flavours,
    oa.price,
    oa.currency
  RETURNING
    1)
  -- Step 4b: insert into products_final, picking a URL for the global lowest price
  INSERT INTO products_final(product_id, brand, name, weight_grams, flavours, price, currency, retailer, url, value_score, slug)
  SELECT
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.flavours,
    s.min_price AS price,
    s.currency,
    s.retailer,
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
      AND c.currency = s.currency
      AND c.price = s.min_price
  GROUP BY
    s.product_id,
    s.brand,
    s.name,
    s.weight_grams,
    s.flavours,
    s.min_price,
    s.currency,
    s.retailer,
    s.value_score;

-- Step 5: snapshot today's prices into history (protein)
INSERT INTO price_history(category, product_id, weight_grams, retailer, price, currency, snapshot_date)
SELECT
  'protein'::citext AS category,
  product_id,
  weight_grams,
  retailer,
  price,
  currency,
  CURRENT_DATE AS snapshot_date
FROM
  products_offers
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

