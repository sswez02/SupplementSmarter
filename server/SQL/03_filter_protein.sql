-- 03_filter.sql
-- Filter in-scope products (protein powders / isolates only) before building final tables
-- View: scraped_protein_only
-- ------------------------------------
-- Purpose:
--   Narrows scraped_in_stock down to only protein products so that the build step
--   only works with relevant products
--
--   - Excludes rows with missing weight or empty flavours array
--   - Uses cleaned base name (name_cleaned) when available
--   - Includes only protein-ish products (whey, protein, isolate, casein, mass, gainer)
--   - Excludes obvious non-protein / edge categories like bone broth, collagen, flavouring, protein water, etc.
--
-- Source:
--   scraped_in_stock (raw scraped products that are in stock)
--   name_cleaned     (base name with brand/flavour/size removed, from 02_normalise.sql)
--
-- Output:
--   scraped_protein_only – same columns as scraped_in_stock, but only for in-scope products
CREATE OR REPLACE VIEW scraped_protein_only AS
WITH base AS (
  SELECT
    sis.*,
    nc.name_cleaned
  FROM
    scraped_in_stock sis
    LEFT JOIN name_cleaned nc ON nc.product_id = sis.product_id
),
filtered AS (
  SELECT
    *
  FROM
    base
  WHERE
    -- Must have a real weight
    weight_grams IS NOT NULL
    AND weight_grams > 0
    -- Must have at least one flavour entry
    AND array_length(flavours_scraped, 1) IS NOT NULL
    AND array_length(flavours_scraped, 1) > 0
    -- Must have some sort of usable name
    AND COALESCE(name_cleaned::text, name_scraped::text) IS NOT NULL
    AND btrim(COALESCE(name_cleaned::text, name_scraped::text)) <> ''
    -- Inclusive: must look like a protein / whey / isolate / mass / gainer / casein
    AND (COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%protein%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%whey%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%isolate%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%iso-%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%casein%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%mass%'
      OR COALESCE(name_cleaned::text, name_scraped::text)
      ILIKE '%gainer%')
      -- Exclusive: filter out products that we don't want / edge categories
      AND NOT (
        -- Bone broth / collagen / flavour-only / waters
        COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%bone broth%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%broth%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%collagen%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%flavouring%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%flavour%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%protein water%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%water%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%truefruit%'
        -- Mass gainers
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE 'mass' -- plain "Mass"
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE 'massive%' -- "Massive ..."
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE 'mass %'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '% mass%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%gainer%'
        -- Plant / vegan proteins
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%plant protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%plant-based protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%plant based protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%plant based%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%vegan protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%vegan%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%pea protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%rice protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%hemp protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%faba bean%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%clean lean protein%'
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%power plant protein%'
        OR (COALESCE(name_cleaned::text, name_scraped::text)
          ILIKE '%plant%'
          AND COALESCE(name_cleaned::text, name_scraped::text)
          ILIKE '%protein%')
        -- Snacks: bars, cookies, wafers, biscuits
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '% bar%' -- "Protein Bar", "Wafer Bar", "Bar X 12"
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%cookie%' -- "Protein Cookie"
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%wafer%' -- "Protein Wafer"
        OR COALESCE(name_cleaned::text, name_scraped::text)
        ILIKE '%biscuit%'))
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
    filtered;

