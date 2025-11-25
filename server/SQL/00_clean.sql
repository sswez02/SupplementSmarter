-- 00_clean.sql
-- Reset tables & derived views so you can rerun the pipeline cleanly
-- 00_clean.sql
DROP VIEW IF EXISTS product_best_rep, product_variant_counts, name_cleaned, flavour_best_rep, flavour_variant_counts, scraped_flavour_stocked, scraped_flavours_flags, scraped_in_stock, brand_best_rep, brand_variant_counts CASCADE;

DROP TABLE IF EXISTS products_final, product_alias, products_collection, flavours_alias, flavours_collection, brands_alias, brands_collection, scraped_products, price_history CASCADE;

