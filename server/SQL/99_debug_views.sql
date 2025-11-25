-- 99_debug_views.sql
--  Drop existing debug views
DROP VIEW IF EXISTS flavour_normalisation_gaps, flavour_families CASCADE;

-- 1) Delete old canonical + alias state
TRUNCATE TABLE
  flavour_alias,
  flavours_collection,
  brand_alias,
  brands_collection
RESTART IDENTITY;

-- 2) Rebuild flavours from flavour_best_rep
WITH chosen AS (
  SELECT
    variant,
    canonical
  FROM
    flavour_best_rep
),
upsert_fc AS (
INSERT INTO flavours_collection(flavour_normalised)
  SELECT DISTINCT
    canonical
  FROM
    chosen
  ON CONFLICT (flavour_normalised)
    DO NOTHING)
INSERT INTO flavour_alias(flavour_scraped, flavour_id)
SELECT
  c.variant,
  fc.id
FROM
  chosen c
  JOIN flavours_collection fc ON fc.flavour_normalised = c.canonical
ON CONFLICT (flavour_scraped)
  DO UPDATE SET
    flavour_id = EXCLUDED.flavour_id;

-- 3) Rebuild brands from brand_best_rep
WITH chosen AS (
  SELECT
    variant,
    canonical
  FROM
    brand_best_rep
),
upsert_bc AS (
INSERT INTO brands_collection(brand_normalised)
  SELECT DISTINCT
    canonical
  FROM
    chosen
  ON CONFLICT (brand_normalised)
    DO NOTHING)
INSERT INTO brand_alias(brand_scraped, brand_id)
SELECT
  c.variant,
  bc.id
FROM
  chosen c
  JOIN brands_collection bc ON bc.brand_normalised = c.canonical
ON CONFLICT (brand_scraped)
  DO UPDATE SET
    brand_id = EXCLUDED.brand_id;

-- 4) Debug view: flavour variants that aren't mapped yet
CREATE OR REPLACE VIEW flavour_normalisation_gaps AS
SELECT
  v.variant,
  v.count
FROM
  flavour_variant_counts v
  LEFT JOIN flavour_alias fa ON fa.flavour_scraped = v.variant
WHERE
  fa.flavour_scraped IS NULL
ORDER BY
  v.count DESC,
  v.variant;

-- 5) Debug view: canonical flavour -> all scraped variants
CREATE OR REPLACE VIEW flavour_families AS
SELECT
  fc.flavour_normalised AS canonical,
  array_agg(fa.flavour_scraped ORDER BY fa.flavour_scraped) AS variants,
  COUNT(*) AS variant_count
FROM
  flavours_collection fc
  JOIN flavour_alias fa ON fa.flavour_id = fc.id
GROUP BY
  fc.id;

