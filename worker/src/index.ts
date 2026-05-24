import { neon } from '@neondatabase/serverless';

type Env = {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
};

function json(data: unknown, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': status >= 400 ? 'no-store' : 'public, max-age=300',
    },
  });
}

function getSearchQuery(url: URL): string {
  return (url.searchParams.get('q') ?? '').trim().slice(0, 100);
}

function dateOnly(value: unknown): string {
  return String(value).slice(0, 10);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);

    try {
      if (url.pathname === '/health') {
        return json({ status: 'ok' }, 200, origin);
      }

      if (url.pathname === '/api/protein') {
        const rows = await sql`
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
          ORDER BY pf.value_score DESC NULLS LAST, pf.price ASC
        `;

        return json(
          rows.map((r: any) => {
            const weightGrams = r.weight_grams as number | null;
            const weightKg = weightGrams != null ? weightGrams / 1000 : null;
            const core = `${r.product_id}-${weightGrams ?? 'na'}-${r.currency || 'NZD'}`;
            const slug = r.slug || core;

            const flavours = r.flavours
              ? String(r.flavours)
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];

            return {
              id: slug,
              brand: r.brand,
              product: r.name,
              weightKg,
              flavours,
              priceCents: r.price,
              valueScore: r.value_score,
              visitUrl: r.url,
            };
          }),
          200,
          origin,
        );
      }

      if (url.pathname === '/api/creatine') {
        const rows = await sql`
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
          ORDER BY cf.value_score DESC NULLS LAST, cf.price ASC
        `;

        return json(
          rows.map((r: any) => {
            const weightGrams = r.weight_grams as number | null;
            const weightKg = weightGrams != null ? weightGrams / 1000 : null;
            const core = `${r.product_id}-${weightGrams ?? 'na'}-${r.currency || 'NZD'}`;
            const slug = r.slug || core;

            return {
              id: slug,
              brand: r.brand,
              product: r.name,
              weightKg,
              priceCents: r.price,
              valueScore: r.value_score,
              visitUrl: r.url,
            };
          }),
          200,
          origin,
        );
      }

      if (url.pathname === '/api/protein/suggest') {
        const q = getSearchQuery(url);
        if (!q) return json([], 200, origin);

        const pattern = `%${q}%`;
        const prefix = `${q}%`;

        const rows = await sql`
          SELECT
            pf.product_id,
            pf.brand,
            pf.name,
            pf.weight_grams
          FROM products_final pf
          WHERE pf.currency = 'NZD'
            AND (pf.name ILIKE ${pattern} OR pf.brand ILIKE ${pattern})
          ORDER BY
            CASE
              WHEN pf.name ILIKE ${prefix} THEN 0
              WHEN pf.brand ILIKE ${prefix} THEN 1
              ELSE 2
            END,
            pf.value_score DESC NULLS LAST,
            pf.price ASC
          LIMIT 10
        `;

        return json(rows, 200, origin);
      }

      if (url.pathname === '/api/creatine/suggest') {
        const q = getSearchQuery(url);
        if (!q) return json([], 200, origin);

        const pattern = `%${q}%`;
        const prefix = `${q}%`;

        const rows = await sql`
          SELECT
            cf.product_id,
            cf.brand,
            cf.name,
            cf.weight_grams
          FROM creatine_final cf
          WHERE cf.currency = 'NZD'
            AND (cf.name ILIKE ${pattern} OR cf.brand ILIKE ${pattern})
          ORDER BY
            CASE
              WHEN cf.name ILIKE ${prefix} THEN 0
              WHEN cf.brand ILIKE ${prefix} THEN 1
              ELSE 2
            END,
            cf.value_score DESC NULLS LAST,
            cf.price ASC
          LIMIT 10
        `;

        return json(rows, 200, origin);
      }

      if (url.pathname === '/api/supplements/suggest') {
        const q = getSearchQuery(url);
        if (!q) return json([], 200, origin);

        const pattern = `%${q}%`;
        const prefix = `${q}%`;

        const rows = await sql`
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
              AND (pf.name ILIKE ${pattern} OR pf.brand ILIKE ${pattern})

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
              AND (cf.name ILIKE ${pattern} OR cf.brand ILIKE ${pattern})
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
              WHEN name ILIKE ${prefix} THEN 0
              WHEN brand ILIKE ${prefix} THEN 1
              ELSE 2
            END,
            value_score DESC NULLS LAST
          LIMIT 10
        `;

        return json(rows, 200, origin);
      }

      if (url.pathname.startsWith('/api/creatine/')) {
        const slug = decodeURIComponent(url.pathname.replace('/api/creatine/', ''));

        const productRows = await sql`
          SELECT
            cf.product_id,
            cf.brand,
            cf.name,
            cf.weight_grams,
            cf.currency,
            cf.slug
          FROM creatine_final cf
          WHERE cf.slug = ${slug}
          LIMIT 1
        `;

        const product = productRows[0] as any;

        if (!product) {
          return json({ error: 'Product not found' }, 404, origin);
        }

        const offers = await sql`
          SELECT
            co.retailer,
            co.url,
            co.price,
            co.currency
          FROM creatine_offers co
          WHERE co.product_id = ${product.product_id}
            AND co.weight_grams = ${product.weight_grams}
            AND co.currency = ${product.currency}
          ORDER BY co.price ASC
        `;

        const history = await sql`
          SELECT
            ph.snapshot_date,
            ph.retailer,
            ph.price
          FROM price_history ph
          WHERE ph.category = 'creatine'
            AND ph.product_id = ${product.product_id}
            AND ph.weight_grams = ${product.weight_grams}
            AND ph.currency = ${product.currency}
          ORDER BY ph.snapshot_date ASC
        `;

        const mappedHistory = history.map((r: any) => ({
          date: dateOnly(r.snapshot_date),
          retailer: r.retailer,
          priceCents: r.price,
        }));

        const mappedOffers = offers.map((r: any) => ({
          retailer: r.retailer,
          subtitle: null,
          url: r.url,
          priceCents: r.price,
          currencySymbol: '$',
        }));

        const currentLow =
          mappedOffers.length > 0
            ? {
                priceCents: mappedOffers[0].priceCents,
                currencySymbol: '$',
                retailer: mappedOffers[0].retailer,
                store: mappedOffers[0].retailer,
              }
            : null;

        const allTimeLow =
          mappedHistory.length > 0
            ? mappedHistory.reduce((best: any, row: any) =>
                row.priceCents < best.priceCents ? row : best,
              )
            : null;

        return json(
          {
            product: {
              productId: product.product_id,
              brand: product.brand,
              name: product.name,
              weightGrams: product.weight_grams,
              currency: product.currency,
            },
            offers: mappedOffers,
            history: mappedHistory,
            allTimeLow: allTimeLow
              ? {
                  priceCents: allTimeLow.priceCents,
                  currencySymbol: '$',
                  dateISO: allTimeLow.date,
                  retailer: allTimeLow.retailer,
                  store: allTimeLow.retailer,
                }
              : null,
            currentLow,
          },
          200,
          origin,
        );
      }

      if (url.pathname.startsWith('/api/protein/')) {
        const slug = decodeURIComponent(url.pathname.replace('/api/protein/', ''));

        const productRows = await sql`
          SELECT
            pf.product_id,
            pf.brand,
            pf.name,
            pf.weight_grams,
            pf.currency,
            pf.slug
          FROM products_final pf
          WHERE pf.slug = ${slug}
          LIMIT 1
        `;

        const product = productRows[0] as any;

        if (!product) {
          return json({ error: 'Product not found' }, 404, origin);
        }

        const offers = await sql`
          SELECT
            po.retailer,
            po.url,
            po.price,
            po.currency,
            po.flavours
          FROM products_offers po
          WHERE po.product_id = ${product.product_id}
            AND po.weight_grams = ${product.weight_grams}
            AND po.currency = ${product.currency}
          ORDER BY po.price ASC
        `;

        const history = await sql`
          SELECT
            ph.snapshot_date,
            ph.retailer,
            ph.price
          FROM price_history ph
          WHERE ph.category = 'protein'
            AND ph.product_id = ${product.product_id}
            AND ph.weight_grams = ${product.weight_grams}
            AND ph.currency = ${product.currency}
          ORDER BY ph.snapshot_date ASC
        `;

        const mappedHistory = history.map((r: any) => ({
          date: dateOnly(r.snapshot_date),
          retailer: r.retailer,
          priceCents: r.price,
        }));

        const mappedOffers = offers.map((r: any) => ({
          retailer: r.retailer,
          subtitle: r.flavours ? String(r.flavours) : null,
          url: r.url,
          priceCents: r.price,
          currencySymbol: '$',
        }));

        const currentLow =
          mappedOffers.length > 0
            ? {
                priceCents: mappedOffers[0].priceCents,
                currencySymbol: '$',
                retailer: mappedOffers[0].retailer,
                store: mappedOffers[0].retailer,
              }
            : null;

        const allTimeLow =
          mappedHistory.length > 0
            ? mappedHistory.reduce((best: any, row: any) =>
                row.priceCents < best.priceCents ? row : best,
              )
            : null;

        return json(
          {
            product: {
              productId: product.product_id,
              brand: product.brand,
              name: product.name,
              weightGrams: product.weight_grams,
              currency: product.currency,
            },
            offers: mappedOffers,
            history: mappedHistory,
            allTimeLow: allTimeLow
              ? {
                  priceCents: allTimeLow.priceCents,
                  currencySymbol: '$',
                  dateISO: allTimeLow.date,
                  retailer: allTimeLow.retailer,
                  store: allTimeLow.retailer,
                }
              : null,
            currentLow,
          },
          200,
          origin,
        );
      }

      return json({ error: 'Not found' }, 404, origin);
    } catch (err: any) {
      console.error(err);
      return json({ error: 'Internal server error' }, 500, origin);
    }
  },
};
