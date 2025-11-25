import { pool } from '../../db/index.js';

type ScrapedProduct = {
  retailer: string;
  brand: string; // maps to brand_scraped
  name: string; // maps to name_scraped
  url: string;
  inStock: boolean;
  price: { amountCents: number; currency: string };
  scrapedAt?: string; // optional
  weight_grams?: number | null;
  flavours?: string[]; // optional
  // anything else stays in json
};

type Category = 'protein' | 'creatine';

// Saves products to the database
export async function saveProducts(products: ScrapedProduct[], category: Category) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const text = `
      INSERT INTO scraped_products (
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
        category,
        json
      )
      VALUES (
        $1, $2, $3,
        $4::citext[],
        $5,
        $6, $7, $8, $9,
        COALESCE($10::timestamptz, now()),
        $11,
        $12::jsonb
      )
    `;

    for (const p of products) {
      const flavours = Array.isArray(p.flavours) ? p.flavours : [];
      const jsonPayload = {
        category,
        ...p,
      };

      const values = [
        p.retailer, // $1
        p.brand, // $2
        p.name, // $3
        flavours, // $4
        p.weight_grams ?? null, // $5
        p.price.amountCents, // $6
        p.price.currency, // $7
        p.url, // $8
        !!p.inStock, // $9
        p.scrapedAt ?? null, // $10
        category, // $11
        JSON.stringify(jsonPayload), // $12
      ];

      await client.query(text, values);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
