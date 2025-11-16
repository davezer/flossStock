// src/routes/api/inventory/+server.js
import { json, error } from '@sveltejs/kit';
import { getLucia } from '$lib/server/auth/lucia.js';


/** Resolve the current user:
 *  Prefer locals.user (set by hooks). If missing, validate cookie here and backfill locals.
 */
async function resolveUser({ locals, cookies, platform }) {
  if (locals?.user) return locals.user;

  const db = platform?.env?.DB;
  if (!db) return null;

  const lucia = getLucia(db);
  const sid = cookies.get('auth_session') ?? null;
  if (!sid) return null;

  try {
    const { user, session } = await lucia.validateSession(sid);
    locals.user = user ?? null;
    locals.session = session ?? null;
    return user ?? null;
  } catch {
    return null;
  }
}

async function requireUser(ctx) {
  const user = await resolveUser(ctx);
  if (!user) throw error(401, 'Unauthorized');
  return user;
}

/** GET: list items (optional ?q=) */
// src/routes/api/inventory/+server.js

// src/routes/api/inventory/+server.js
export async function GET(event) {
  const { platform, url } = event;
  const db = platform?.env?.DB;
  if (!db) return json({ user: null, items: [], message: 'No DB binding' });

  const user = await resolveUser(event);
  if (!user) return json({ user: null, items: [], message: 'Not signed in' });

  const q = (url.searchParams.get('q') || '').trim();
  const where = q ? 'AND (c.code LIKE ? OR c.name LIKE ?)' : '';

  // bind order matches the SQL below:
  //   1) p.user_id in subquery
  //   2) i.user_id in main WHERE
  //   3–4) optional search params
  const binds = q
    ? [user.id, user.id, `%${q}%`, `%${q}%`]
    : [user.id, user.id];

  const sql = `
    SELECT
      i.color_id                         AS id,
      i.color_id,
      i.qty                              AS qty,
      i.notes,
      i.updated_at,
      c.code,
      c.name,
      c.hex,
      COALESCE(pc.project_count, 0)      AS used_in_projects
    FROM inventory i
    JOIN color c
      ON c.id = i.color_id
    LEFT JOIN (
      SELECT
        pc.color_id           AS color_id,
        COUNT(*)              AS project_count
      FROM project_color pc
      JOIN project p
        ON p.id = pc.project_id
      WHERE p.user_id = ?
      GROUP BY pc.color_id
    ) pc
      ON pc.color_id = i.color_id
    WHERE i.user_id = ?
    ${where}
    ORDER BY CAST(c.code AS INTEGER) ASC, c.code ASC
  `;

  const rows = await db.prepare(sql).bind(...binds).all();

  return json({
    user: { id: user.id },
    items: rows?.results || [],
    message: 'OK'
  });
}



/** POST: upsert single or batch
 * Accept one of:
 *  - { color_id|colorId, quantity, op? }   // kept for compatibility; maps to qty
 *  - { color_id|colorId, qty, op? }        // preferred
 *  - { color_id|colorId, delta }           // delta can be negative; result never < 0
 * Optional: notes
 */
export async function POST(event) {
  const { locals, platform, request, cookies } = event;

  try {
    const user = await requireUser({ locals, platform, cookies });
    const db = platform?.env?.DB;
    if (!db) throw new Error('D1 binding missing');

    const body = await request.json().catch(() => ({}));
    const batch = Array.isArray(body?.items) ? body.items : [body];

    for (const it of batch) {
      const colorId = String(it?.color_id ?? it?.colorId ?? '').trim();
      const hasQty    = it?.qty !== undefined || it?.quantity !== undefined; // compat
      const hasDelta  = it?.delta !== undefined;

      if (!colorId) throw new Error('color_id required');
      if (!hasQty && !hasDelta) throw new Error('Provide qty/quantity or delta');
      if (hasQty && hasDelta) throw new Error('Provide either qty/quantity OR delta, not both');

      const notes = typeof it?.notes === 'string' ? it.notes : null;

      if (hasDelta) {
        const deltaRaw = Number(it.delta);
        if (!Number.isFinite(deltaRaw)) throw new Error('delta must be a number');
        const delta = Math.trunc(deltaRaw);

        await db.prepare(`
          INSERT INTO inventory (user_id, color_id, quantity, notes, updated_at)
          VALUES (?, ?, ?, ?, unixepoch())
          ON CONFLICT(user_id, color_id)
          DO UPDATE SET
            quantity   = quantity + excluded.quantity,
            notes      = COALESCE(excluded.notes, notes),
            updated_at = unixepoch()
        `).bind(user.id, colorId, 1, notes, delta).run();
      } else {
        const raw = Number(it.qty ?? it.quantity); // accept old "quantity"
        if (!Number.isFinite(raw)) throw new Error('qty/quantity must be a number');
        const qty = Math.max(0, Math.trunc(raw));
        const op = String(it?.op || 'set').toLowerCase();

        if (op === 'add') {
          await db.prepare(`
            INSERT INTO inventory (user_id, color_id, qty, notes, updated_at)
            VALUES (?, ?, ?, ?, unixepoch())
            ON CONFLICT(user_id, color_id)
            DO UPDATE SET qty       = MAX(0, inventory.qty + excluded.qty),
                          notes     = COALESCE(excluded.notes, inventory.notes),
                          updated_at = unixepoch()
          `).bind(user.id, colorId, qty, notes).run();
        } else {
          await db.prepare(`
            INSERT INTO inventory (user_id, color_id, qty, notes, updated_at)
            VALUES (?, ?, ?, ?, unixepoch())
            ON CONFLICT(user_id, color_id)
            DO UPDATE SET qty       = excluded.qty,
                          notes     = COALESCE(excluded.notes, inventory.notes),
                          updated_at = unixepoch()
          `).bind(user.id, colorId, qty, notes).run();
        }
      }
    }

    // Return last item for UI convenience
    const last = batch[batch.length - 1];
    const lastColorId = String(last?.color_id ?? last?.colorId ?? '').trim();
    let item = null;
    if (lastColorId) {
      const row = await db.prepare(`
        SELECT i.color_id AS colorId, i.qty
        FROM inventory i
        WHERE i.user_id = ? AND i.color_id = ?
      `).bind(user.id, lastColorId).first();
      if (row) item = { colorId: row.colorId, qty: row.qty };
    }

    return json({ ok: true, updated: batch.length, item, message: 'Inventory updated' });
  } catch (err) {
    const msg = String(err?.message || err);
    const isAuth  = /unauthorized/i.test(msg);
    const isInput = /(provide|number|required|color_id|qty|quantity|delta)/i.test(msg);
    const status  = isAuth ? 401 : isInput ? 400 : 500;

    console.error('[api/inventory][POST]', err);
    return json({ ok: false, error: msg, message: msg }, { status });
  }
}
