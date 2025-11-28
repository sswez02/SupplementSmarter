-- 02_normalise.sql
-- Views + normalisation + upserts into *_collection / *_alias
/* Flavour expansion and normalisation */
-----------------------------------------
-- Only process in-stock products
CREATE OR REPLACE VIEW scraped_in_stock AS
SELECT
  *
FROM
  scraped_products
WHERE
  in_stock = TRUE;

-- Flavour variant counting (counts distinct variants)
-- IMPORTANT: flavours_scraped is an ARRAY, so we must UNNEST it
CREATE OR REPLACE VIEW flavour_variant_counts AS
SELECT
  lower(btrim(
      CASE WHEN f.flavour_scraped ~* '^\s*r1\b' THEN
        'Rule 1'
      ELSE
        f.flavour_scraped
      END)) AS variant,
  COUNT(*) AS count
FROM
  scraped_in_stock sis
  CROSS JOIN LATERAL unnest(sis.flavours_scraped) AS f(flavour_scraped)
WHERE
  f.flavour_scraped IS NOT NULL
  AND btrim(f.flavour_scraped) <> ''
GROUP BY
  1;

-- Flavour best representative (selects a single best representative variant)
CREATE OR REPLACE VIEW flavour_best_rep AS
WITH pairs AS (
  SELECT
    a.variant,
    b.variant AS rep,
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

-- Helper function for removing specific phrases from strings
CREATE OR REPLACE FUNCTION remove_phrases(src citext, phrase1 citext, variant1 text, phrase2 citext, variant2 text)
  RETURNS citext
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  tmp text := src::text;
  pat text;
BEGIN
  IF phrase1 IS NOT NULL AND phrase1 <> '' THEN
    pat := regexp_replace(phrase1::text, '([.^$*+?(){}\[\]\|\\])', '\\\1', 'g');
    tmp := regexp_replace(tmp, pat, '', 'gi');
  END IF;
  IF variant1 IS NOT NULL AND variant1 <> '' THEN
    pat := regexp_replace(variant1, '([.^$*+?(){}\[\]\|\\])', '\\\1', 'g');
    tmp := regexp_replace(tmp, pat, '', 'gi');
  END IF;
  IF phrase2 IS NOT NULL AND phrase2 <> '' THEN
    pat := regexp_replace(phrase2::text, '([.^$*+?(){}\[\]\|\\])', '\\\1', 'g');
    tmp := regexp_replace(tmp, pat, '', 'gi');
  END IF;
  IF variant2 IS NOT NULL AND variant2 <> '' THEN
    pat := regexp_replace(variant2, '([.^$*+?(){}\[\]\|\\])', '\\\1', 'g');
    tmp := regexp_replace(tmp, pat, '', 'gi');
  END IF;
  tmp := btrim(regexp_replace(tmp, '\s{2,}', ' ', 'g'));
  RETURN tmp::citext;
END;
$$;

-- Expand flavours into one row per (product × flavour) with flags and price deltas
CREATE OR REPLACE VIEW scraped_flavours_flags AS
SELECT
  sis.product_id,
  f.flavour_scraped,
(unaccent(lower(f.flavour_scraped))
    LIKE '%out of stock%'
    OR unaccent(lower(f.flavour_scraped))
    LIKE '%not available for selected size%') AS out_of_stock,
  COALESCE(NULLIF((regexp_match(f.flavour_scraped, '([+-]?)\s*\$\s*(\d+(?:\.\d{1,2})?)'))[2], '')::numeric * CASE WHEN (regexp_match(f.flavour_scraped, '([+-]?)\s*\$\s*(\d+(?:\.\d{1,2})?)'))[1] = '-' THEN
    -1
  ELSE
    1
  END, 0) AS price_add
FROM
  scraped_in_stock sis
  CROSS JOIN LATERAL unnest(sis.flavours_scraped) AS f(flavour_scraped);

-- Compute per-flavour surcharges (in cents) and final price for IN-STOCK flavours only
CREATE OR REPLACE VIEW scraped_flavour_stocked AS
SELECT
  f.product_id,
  f.flavour_scraped,
  ROUND(f.price_add * 100)::int AS price_add_cents,
  sis.amount_cents + ROUND(f.price_add * 100)::int AS final_amount_cents
FROM
  scraped_flavours_flags f
  JOIN scraped_in_stock sis ON sis.product_id = f.product_id
WHERE
  NOT f.out_of_stock
  AND btrim(f.flavour_scraped) <> '';

