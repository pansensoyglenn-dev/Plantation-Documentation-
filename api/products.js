import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id          INTEGER PRIMARY KEY DEFAULT 1,
      payload     JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureTable();

    const rows = await sql`SELECT payload FROM app_state WHERE id = 1`;
    if (rows.length === 0) {
      return res.status(200).json({ products: [] });
    }

    const state = rows[0].payload || {};
    const allProducts = Array.isArray(state.products) ? state.products : [];

    const visible = allProducts
      .filter(p => p && p.active === true)
      .filter(p => p.stock === undefined || p.stock > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
        description: p.description || '',
        photo: p.photo || null,
        plantation_type: p.plantation_type || null
      }));

    return res.status(200).json({ products: visible });
  } catch (err) {
    console.error('products.js error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
