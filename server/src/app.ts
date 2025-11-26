import express from 'express';
import cors from 'cors';
import { pool } from './db/index.js';

// Express app
// ├─ global middleware
// │  ├─ cors()
// │  └─ express.json()
// ├─ health check:        GET /health
// ├─ protein
// │  ├─ GET /api/protein
// │  ├─ GET /api/protein/suggest?q=...
// │  └─ GET /api/protein/:slug
// ├─ creatine
// │  ├─ GET /api/creatine
// │  ├─ GET /api/creatine/suggest?q=...
// │  └─ GET /api/creatine/:slug
// └─ global search
//    └─ GET /api/supplements/suggest?q=...

export const app = express();

// Middleware layer
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Helper to normalise ?q=
function getSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 100);
}

/* Protein */

// /api/protein:
//  Queries products_final for NZD rows
//  Orders by:
//   best value first (value_score DESC)
//  then lowest price
app.get('/api/protein', async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        pf.product_id,
        pf.brand,
        pf.name,
        pf.weight_grams,
        pf.flavours,
        pf.price,
        pf.currency,
        pf.url,
        pf.value_score,
        pf.slug
      FROM products_final pf
      WHERE pf.currency = 'NZD'
      ORDER BY
        pf.value_score DESC NULLS LAST,
        pf.price ASC
      `
    );

    console.log('Query Result:', result.rows);

    const rows = result.rows.map((r) => {
      const weightGrams = r.weight_grams as number | null;
      const weightKg = weightGrams != null ? weightGrams / 1000 : null;

      // Fallback core
      const core = `${r.product_id}-${weightGrams ?? 'na'}-${r.currency || 'NZD'}`;
      const slug = (r.slug as string | null) || core;

      const flavours: string[] = r.flavours
        ? String(r.flavours)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      return {
        id: slug, // frontend route /protein/:slug
        brand: r.brand,
        product: r.name,
        weightKg,
        flavours,
        priceCents: r.price,
        valueScore: r.value_score,
        visitUrl: r.url,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/protein', err);
    res.status(500).json({ error: 'Failed to load protein table' });
  }
});

// GET /api/protein/suggest?q=gold
//  Reads q from ?q=....
//  Returns JSON objects
app.get('/api/protein/suggest', async (req, res) => {
  try {
    const q = getSearchQuery(req.query.q);
    if (!q) {
      return res.json([]);
    }

    const pattern = `%${q}%`;
    const prefix = `${q}%`;

    const result = await pool.query(
      `
      SELECT
        pf.product_id,
        pf.brand,
        pf.name,
        pf.weight_grams
      FROM products_final pf
      WHERE pf.currency = 'NZD'
        AND (
          pf.name  ILIKE $1
          OR pf.brand ILIKE $1
        )
      ORDER BY
        CASE
          WHEN pf.name  ILIKE $2 THEN 0
          WHEN pf.brand ILIKE $2 THEN 1
          ELSE 2
        END,
        pf.value_score DESC NULLS LAST,
        pf.price ASC
      LIMIT 10
      `,
      [pattern, prefix]
    );

    res.json(
      result.rows.map((r) => ({
        product_id: r.product_id,
        brand: r.brand,
        name: r.name,
        weight_grams: r.weight_grams,
      }))
    );
  } catch (err) {
    console.error('Error in GET /api/protein/suggest', err);
    res.status(500).json({ error: 'Failed to load protein suggestions' });
  }
});

// /api/protein/:slug
//  eg: pack-nutrition-feral-whey-protein-2-27kg
//  Returns:
//   product info
//   current offers per retailer
//   history timeline
//   allTimeLow and currentLow summaries
app.get('/api/protein/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Look up product by slug in products_final
    const pfResult = await pool.query(
      `
      SELECT
        product_id,
        brand,
        name,
        weight_grams,
        currency
      FROM products_final
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (pfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const pf = pfResult.rows[0] as {
      product_id: number;
      brand: string;
      name: string;
      weight_grams: number | null;
      currency: string;
    };

    const productId = pf.product_id;
    const weightGrams = pf.weight_grams;
    const currency = pf.currency;

    // Current offers (one row per retailer)
    const offersResult = await pool.query(
      `
      SELECT
        po.product_id,
        po.brand,
        po.name,
        po.weight_grams,
        po.retailer,
        po.flavours,
        po.price,
        po.currency,
        po.url
      FROM products_offers po
      WHERE po.product_id = $1
        AND ($2::int IS NULL OR po.weight_grams = $2)
        AND po.currency = $3
      ORDER BY po.price ASC
      `,
      [productId, weightGrams, currency]
    );

    if (offersResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product offers not found' });
    }

    // History for that product/size across days + retailers
    const historyResult = await pool.query(
      `
      SELECT
        snapshot_date::date::text AS date,
        retailer,
        price AS price_cents
      FROM price_history
      WHERE category = 'protein'
        AND product_id = $1
        AND ($2::int IS NULL OR weight_grams = $2)
        AND currency = $3
      ORDER BY snapshot_date ASC, retailer ASC
      `,
      [productId, weightGrams, currency]
    );

    const historyRows = historyResult.rows as {
      date: string;
      retailer: string;
      price_cents: number;
    }[];

    // Compute all-time low + current low from history

    let allTimeLow: { priceCents: number; dateISO: string; store: string } | null = null;
    let currentLow: { priceCents: number; store: string } | null = null;

    if (historyRows.length > 0) {
      // All-time low
      const first = historyRows[0];
      if (first) {
        let minRow = first;
        for (const r of historyRows) {
          if (r.price_cents < minRow.price_cents) {
            minRow = r;
          }
        }
        allTimeLow = {
          priceCents: minRow.price_cents,
          dateISO: minRow.date,
          store: minRow.retailer,
        };
      }

      // Latest date low
      const latestDate = historyRows[historyRows.length - 1]?.date;
      if (latestDate) {
        const latestRows = historyRows.filter((r) => r.date === latestDate);

        if (latestRows.length > 0) {
          let currentMin = latestRows[0]!;
          for (const r of latestRows) {
            if (r.price_cents < currentMin.price_cents) {
              currentMin = r;
            }
          }
          currentLow = {
            priceCents: currentMin.price_cents,
            store: currentMin.retailer,
          };
        }
      }
    }

    // Response for frontend
    const offers = offersResult.rows.map((r) => ({
      retailer: r.retailer,
      subtitle: r.flavours || null,
      url: r.url,
      priceCents: r.price,
      currencySymbol: '$',
    }));

    const history = historyRows.map((r) => ({
      date: r.date,
      retailer: r.retailer,
      priceCents: r.price_cents,
    }));

    res.json({
      product: {
        productId: pf.product_id,
        brand: pf.brand,
        name: pf.name,
        weightGrams: pf.weight_grams,
        currency: pf.currency,
      },
      offers,
      history,
      allTimeLow,
      currentLow,
    });
  } catch (err) {
    console.error('Error in /api/protein/:slug', err);
    res.status(500).json({ error: 'Failed to load product detail' });
  }
});

/* Creatine */

// /api/creatine:
//  Queries creatine_final for NZD rows
//  Orders by:
//   best value first (value_score DESC)
//   then lowest price
app.get('/api/creatine', async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        cf.product_id,
        cf.brand,
        cf.name,
        cf.weight_grams,
        cf.price,
        cf.currency,
        cf.url,
        cf.value_score,
        cf.slug
      FROM creatine_final cf
      WHERE cf.currency = 'NZD'
      ORDER BY
        cf.value_score DESC NULLS LAST,
        cf.price ASC
      `
    );

    const rows = result.rows.map((r) => {
      const weightGrams = r.weight_grams as number | null;
      const weightKg = weightGrams != null ? weightGrams / 1000 : null;

      // Fallback core
      const core = `${r.product_id}-${weightGrams ?? 'na'}-${r.currency || 'NZD'}`;
      const slug = (r.slug as string | null) || core;

      return {
        id: slug, // frontend route /creatine/:slug
        brand: r.brand,
        product: r.name,
        weightKg,
        priceCents: r.price,
        valueScore: r.value_score,
        visitUrl: r.url,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/creatine', err);
    res.status(500).json({ error: 'Failed to load creatine table' });
  }
});

// GET /api/creatine/suggest?q=crea
//  Reads q from ?q=....
//  Returns JSON objects
app.get('/api/creatine/suggest', async (req, res) => {
  try {
    const q = getSearchQuery(req.query.q);
    if (!q) {
      return res.json([]);
    }

    const pattern = `%${q}%`;
    const prefix = `${q}%`;

    const result = await pool.query(
      `
      SELECT
        cf.product_id,
        cf.brand,
        cf.name,
        cf.weight_grams
      FROM creatine_final cf
      WHERE cf.currency = 'NZD'
        AND (
          cf.name  ILIKE $1
          OR cf.brand ILIKE $1
        )
      ORDER BY
        CASE
          WHEN cf.name  ILIKE $2 THEN 0
          WHEN cf.brand ILIKE $2 THEN 1
          ELSE 2
        END,
        cf.value_score DESC NULLS LAST,
        cf.price ASC
      LIMIT 10
      `,
      [pattern, prefix]
    );

    res.json(
      result.rows.map((r) => ({
        product_id: r.product_id,
        brand: r.brand,
        name: r.name,
        weight_grams: r.weight_grams,
      }))
    );
  } catch (err) {
    console.error('Error in GET /api/creatine/suggest', err);
    res.status(500).json({ error: 'Failed to load creatine suggestions' });
  }
});

// /api/creatine/:slug
//  Returns:
//   product info
//   current offers per retailer
//   history timeline
//   allTimeLow and currentLow summaries
app.get('/api/creatine/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Look up creatine product by slug in creatine_final
    const cfResult = await pool.query(
      `
      SELECT
        product_id,
        brand,
        name,
        weight_grams,
        currency
      FROM creatine_final
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (cfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creatine product not found' });
    }

    const cf = cfResult.rows[0] as {
      product_id: number;
      brand: string;
      name: string;
      weight_grams: number | null;
      currency: string;
    };

    const productId = cf.product_id;
    const weightGrams = cf.weight_grams;
    const currency = cf.currency;

    // Current creatine offers (one row per retailer)
    const offersResult = await pool.query(
      `
      SELECT
        co.product_id,
        co.brand,
        co.name,
        co.weight_grams,
        co.retailer,
        co.price,
        co.currency,
        co.url
      FROM creatine_offers co
      WHERE co.product_id = $1
        AND ($2::int IS NULL OR co.weight_grams = $2)
        AND co.currency = $3
      ORDER BY co.price ASC
      `,
      [productId, weightGrams, currency]
    );

    if (offersResult.rows.length === 0) {
      return res.status(404).json({ error: 'Creatine product offers not found' });
    }

    // History for that creatine product/size across days + retailers
    const historyResult = await pool.query(
      `
      SELECT
        snapshot_date::date::text AS date,
        retailer,
        price AS price_cents
      FROM price_history
      WHERE category = 'creatine'
        AND product_id = $1
        AND ($2::int IS NULL OR weight_grams = $2)
        AND currency = $3
      ORDER BY snapshot_date ASC, retailer ASC
      `,
      [productId, weightGrams, currency]
    );

    const historyRows = historyResult.rows as {
      date: string;
      retailer: string;
      price_cents: number;
    }[];

    // Compute all-time low + current low from history
    let allTimeLow: { priceCents: number; dateISO: string; store: string } | null = null;
    let currentLow: { priceCents: number; store: string } | null = null;

    if (historyRows.length > 0) {
      // All-time low
      const first = historyRows[0];
      if (first) {
        let minRow = first;
        for (const r of historyRows) {
          if (r.price_cents < minRow.price_cents) {
            minRow = r;
          }
        }
        allTimeLow = {
          priceCents: minRow.price_cents,
          dateISO: minRow.date,
          store: minRow.retailer,
        };
      }

      // Latest date low
      const latestDate = historyRows[historyRows.length - 1]?.date;
      if (latestDate) {
        const latestRows = historyRows.filter((r) => r.date === latestDate);

        if (latestRows.length > 0) {
          let currentMin = latestRows[0]!;
          for (const r of latestRows) {
            if (r.price_cents < currentMin.price_cents) {
              currentMin = r;
            }
          }
          currentLow = {
            priceCents: currentMin.price_cents,
            store: currentMin.retailer,
          };
        }
      }
    }

    // Response for frontend
    const offers = offersResult.rows.map((r) => ({
      retailer: r.retailer,
      subtitle: null, // no flavours in creatine_offers
      url: r.url,
      priceCents: r.price,
      currencySymbol: '$',
    }));

    const history = historyRows.map((r) => ({
      date: r.date,
      retailer: r.retailer,
      priceCents: r.price_cents,
    }));

    res.json({
      product: {
        productId: cf.product_id,
        brand: cf.brand,
        name: cf.name,
        weightGrams: cf.weight_grams,
        currency: cf.currency,
      },
      offers,
      history,
      allTimeLow,
      currentLow,
    });
  } catch (err) {
    console.error('Error in /api/creatine/:slug', err);
    res.status(500).json({ error: 'Failed to load creatine detail' });
  }
});

/* Global  */

// Global suggestions
//  Given a query search both protein and creatine tables to pick the best matching products
//  Returns suggestions
app.get('/api/supplements/suggest', async (req, res) => {
  try {
    const q = getSearchQuery(req.query.q);
    if (!q) {
      return res.json([]);
    }

    const pattern = `%${q}%`;
    const prefix = `${q}%`;

    const result = await pool.query(
      `
      WITH combined AS (
        SELECT
          'protein'::text AS category,
          pf.slug,
          pf.product_id,
          pf.brand,
          pf.name,
          pf.weight_grams,
          pf.value_score
        FROM products_final pf
        WHERE pf.currency = 'NZD'
          AND (pf.name ILIKE $1 OR pf.brand ILIKE $1)

        UNION ALL

        SELECT
          'creatine'::text AS category,
          cf.slug,
          cf.product_id,
          cf.brand,
          cf.name,
          cf.weight_grams,
          cf.value_score
        FROM creatine_final cf
        WHERE cf.currency = 'NZD'
          AND (cf.name ILIKE $1 OR cf.brand ILIKE $1)
      )
      SELECT
        category,
        slug,
        product_id,
        brand,
        name,
        weight_grams,
        value_score
      FROM combined
      ORDER BY
        CASE
          WHEN name  ILIKE $2 THEN 0
          WHEN brand ILIKE $2 THEN 1
          ELSE 2
        END,
        value_score DESC NULLS LAST
      LIMIT 10
      `,
      [pattern, prefix]
    );

    res.json(
      result.rows.map((r) => ({
        category: r.category as 'protein' | 'creatine',
        slug: r.slug as string | null,
        product_id: r.product_id,
        brand: r.brand,
        name: r.name,
        weight_grams: r.weight_grams,
      }))
    );
  } catch (err) {
    console.error('Error in GET /api/supplements/suggest', err);
    res.status(500).json({ error: 'Failed to load supplement suggestions' });
  }
});

export default app;
