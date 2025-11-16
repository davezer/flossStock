// src/routes/api/wishlist/+server.js
import { json, error } from '@sveltejs/kit';
import { getLucia } from '$lib/server/auth/lucia.js';

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

/** GET /api/wishlist */
export async function GET(event) {
  const { platform } = event;
  const db = platform?.env?.DB;
  if (!db) return json({ user: null, items: [], message: 'No DB binding' });

  const user = await resolveUser(event);
  if (!user) return json({ user: null, items: [], message: 'Not signed in' });

  const rows = await db.prepare(`
    SELECT
      w.color_id                AS color_id,
      w.desired_qty             AS desired_qty,
      w.notes                   AS notes,
      w.created_at              AS created_at,
      c.code                    AS code,
      c.name                    AS name,
      c.hex                     AS hex
    FROM wishlist w
    JOIN color c ON c.id = w.color_id
    WHERE w.user_id = ?
    ORDER BY CAST(c.code AS INTEGER) ASC, c.code ASC
  `).bind(user.id).all();

  return json({
    user: { id: user.id },
    items: rows?.results || [],
    message: 'OK'
  });
}

/** POST /api/wishlist
 * Body: { color_id, desired_qty?, notes? } or { items: [...] }
 */
export async function POST(event) {
  const { platform, request, locals, cookies } = event;

  try {
    const user = await requireUser({ locals, platform, cookies });
    const db = platform?.env?.DB;
    if (!db) throw new Error('D1 binding missing');

    const body = await request.json().catch(() => ({}));
    const batch = Array.isArray(body?.items) ? body.items : [body];

    for (const it of batch) {
      const colorId = String(it?.color_id ?? it?.colorId ?? it?.id ?? '').trim();
      if (!colorId) throw new Error('color_id required');

      const rawQty = it.desired_qty ?? it.qty ?? 1;
      const desiredQty = Math.max(1, Math.trunc(Number(rawQty) || 1));
      const notes = typeof it?.notes === 'string' ? it.notes : null;

      await db.prepare(`
        INSERT INTO wishlist (user_id, color_id, desired_qty, notes, created_at)
        VALUES (?, ?, ?, ?, unixepoch())
        ON CONFLICT(user_id, color_id)
        DO UPDATE SET
          desired_qty = wishlist.desired_qty + excluded.desired_qty,
          notes       = COALESCE(excluded.notes, wishlist.notes)
      `).bind(user.id, colorId, desiredQty, notes).run();
    }

    return json({ ok: true, updated: batch.length, message: 'Wishlist updated' });
  } catch (err) {
    const msg = String(err?.message || err);
    const isAuth  = /unauthorized/i.test(msg);
    const isInput = /(color_id|required|number|desired_qty|qty)/i.test(msg);
    const status  = isAuth ? 401 : isInput ? 400 : 500;

    console.error('[api/wishlist][POST]', err);
    return json({ ok: false, error: msg, message: msg }, { status });
  }
}


/** DELETE /api/wishlist/:color_id */
export async function DELETE(event) {
  const { platform, params, locals, cookies, request } = event;

  try {
    const user = await requireUser({ locals, platform, cookies });
    const db = platform?.env?.DB;
    if (!db) throw new Error('D1 binding missing');

    // Try URL param first, then JSON body
    let colorId = String(params.color_id ?? '').trim();
    if (!colorId) {
      const body = await request.json().catch(() => ({}));
      colorId = String(body?.color_id ?? '').trim();
    }

    if (!colorId) throw new Error('color_id required');

    await db.prepare(`
      DELETE FROM wishlist
      WHERE user_id = ? AND color_id = ?
    `).bind(user.id, colorId).run();

    return json({ ok: true, message: 'Wishlist item removed' });
  } catch (err) {
    const msg = String(err?.message || err);
    const isAuth  = /unauthorized/i.test(msg);
    const isInput = /(color_id|required)/i.test(msg);
    const status  = isAuth ? 401 : isInput ? 400 : 500;

    console.error('[api/wishlist][DELETE]', err);
    return json({ ok: false, error: msg, message: msg }, { status });
  }
}

