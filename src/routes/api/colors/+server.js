import { json } from '@sveltejs/kit';

export async function GET({ url, platform }) {
  const db = platform?.env?.DB;
  try {
    if (!db) throw new Error('D1 binding missing');

    // inputs
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 2000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
    const q = url.searchParams.get('q')?.trim() ?? '';

    // base SQL — matches your schema: brand → line → color
    let sql = `
      SELECT
        c.id, c.code, c.name, c.hex,
        c.line_id,
        l.slug AS line_slug, l.name AS line_name,
        b.slug AS brand_slug, b.name AS brand_name
      FROM color c
      JOIN line  l ON l.id = c.line_id
      JOIN brand b ON b.id = l.brand_id
    `;
    const binds = [];

    if (q) {
      sql += ` WHERE (c.code LIKE ? OR c.name LIKE ?) `;
      const like = `%${q}%`;
      binds.push(like, like);
    }

    sql += ` ORDER BY CAST(c.code AS INTEGER) ASC, c.code ASC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const stmt = db.prepare(sql);
    const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

    return json({ ok: true, count: rows.results.length, data: rows.results });
  } catch (err) {
    // Log full details server-side; return a safe message to client
    console.error('[api/colors] error:', err);
    return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
