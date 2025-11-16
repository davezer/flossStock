// src/routes/api/inventory/[color_id]/+server.js
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

// ---------- PATCH: update qty and/or notes ----------
export async function PATCH(event) {
  const { platform, locals, cookies, params, request } = event;
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'No DB binding');

  const user = await requireUser({ locals, cookies, platform });
  const colorId = String(params.color_id ?? '').trim();
  if (!colorId) throw error(400, 'color_id required');

  const body = await request.json().catch(() => ({}));
  const hasQty = 'quantity' in body || 'qty' in body;
  const hasNotes = 'notes' in body;

  if (!hasQty && !hasNotes) {
    throw error(400, 'quantity/qty or notes required');
  }

  const sets = [];
  const binds = [];

  if (hasQty) {
    const raw = Number(body.quantity ?? body.qty);
    if (!Number.isFinite(raw)) throw error(400, 'quantity must be a number');
    const qty = Math.max(0, Math.trunc(raw));
    sets.push('qty = ?');
    binds.push(qty);
  }

  if (hasNotes) {
    sets.push('notes = ?');
    binds.push(body.notes ?? null);
  }

  sets.push('updated_at = unixepoch()');

  const sql = `
    UPDATE inventory
    SET ${sets.join(', ')}
    WHERE user_id = ? AND color_id = ?
  `;

  binds.push(user.id, colorId);

  await db.prepare(sql).bind(...binds).run();

  const { results } = await db
    .prepare(
      `
      SELECT i.user_id, i.color_id, i.qty, i.notes, i.updated_at,
             c.code, c.name, c.hex
      FROM inventory i
      JOIN color c ON c.id = i.color_id
      WHERE i.user_id = ? AND i.color_id = ?
      `
    )
    .bind(user.id, colorId)
    .all();

  return json({
    ok: true,
    item: results?.[0] ?? null
  });
}

// ---------- DELETE: remove a row from inventory ----------
export async function DELETE(event) {
  const { platform, locals, cookies, params } = event;
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'No DB binding');

  const user = await requireUser({ locals, cookies, platform });
  const colorId = String(params.color_id ?? '').trim();
  if (!colorId) throw error(400, 'color_id required');

  await db
    .prepare(
      `
      DELETE FROM inventory
      WHERE user_id = ? AND color_id = ?
      `
    )
    .bind(user.id, colorId)
    .run();

  return json({
    ok: true,
    color_id: colorId,
    message: 'Inventory row deleted'
  });
}
