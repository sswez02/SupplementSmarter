-- 03_filter_creatine.sql
-- Filter in-scope products (creatine only) before building final tables
-- View: scraped_creatine_only
-- ------------------------------------
-- Purpose:
--   Narrows scraped_in_stock down to only creatine products so that the
--   creatine build step only works with relevant products
--
--   - Excludes rows with missing weight
--   - Doesn't require any flavours (creatine scrapers don't collect them)
--   - Uses cleaned base name (name_cleaned) when available
--   - Includes only creatine products (creatine / creapure / monohydrate)
--
-- Source:
--   scraped_in_stock (raw scraped products that are in stock)
--   name_cleaned     (base name with brand/flavour/size removed, from 02_normalise.sql)
--
-- Output:
--   scraped_creatine_only – same columns as scraped_in_stock,
--   but only for in-scope creatine products
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
  -- Must have some sort of usable name
  AND COALESCE(name_cleaned::text, name_scraped::text) IS NOT NULL
  AND btrim(COALESCE(name_cleaned::text, name_scraped::text)) <> ''
  -- Inclusive: must look like a creatine product
  AND (COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%creatine%'
    OR COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%creapure%'
    OR COALESCE(name_cleaned::text, name_scraped::text)
    ILIKE '%monohydrate%');

