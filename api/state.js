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
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const rows = await sql`SELECT payload, updated_at FROM app_state WHERE id = 1`;
      if (rows.length === 0) {
        return res.status(200).json({ state: null, updated_at: null });
      }
      return res.status(200).json({
        state: rows[0].payload,
        updated_at: rows[0].updated_at
      });
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object'
        ? req.body
        : JSON.parse(req.body || '{}');

      if (!body || typeof body.state !== 'object') {
        return res.status(400).json({ error: 'Missing "state" object in request body.' });
      }

      await sql`
        INSERT INTO app_state (id, payload, updated_at)
        VALUES (1, ${JSON.stringify(body.state)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
          SET payload = EXCLUDED.payload,
              updated_at = NOW()
      `;

      return res.status(200).json({ ok: true, updated_at: new Date().toISOString() });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('state.js error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
