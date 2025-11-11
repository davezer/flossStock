// src/routes/api/inventory/[id]/+server.js
import { json, error } from '@sveltejs/kit';
import { getLucia } from '$lib/server/auth/lucia.js';

// Reuse the same helpers as in /api/inventory
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

// PATCH /api/inventory/:id  -> update quantity and/or notes
export const PATCH = async (event) => {
  const { platform, params, request, locals, cookies } = event;
  const user = await requireUser({ locals, platform, cookies });

  const db = platform?.env?.DB;
  if (!db) throw error(500, 'No DB binding');

  const colorId = String(params.id || '').trim();
  if (!colorId) throw error(400, 'Missing id');

  const body = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];

  if (body.quantity !== undefined) {
    const qNum = Number(body.quantity);
    if (!Number.isFinite(qNum)) throw error(400, 'quantity must be a number');
    sets.push('quantity = ?');
    binds.push(Math.max(0, Math.trunc(qNum)));
  }

  if (body.notes !== undefined) {
    sets.push('notes = ?');
    binds.push(typeof body.notes === 'string' ? body.notes : null);
  }

  if (!sets.length) {
    return json({ ok: true, id: colorId, message: 'No changes' });
  }

  sets.push('updated_at = unixepoch()');

  const res = await db.prepare(`
    UPDATE inventory
    SET ${sets.join(', ')}
    WHERE user_id = ? AND color_id = ?
  `).bind(...binds, user.id, colorId).run();

  if (res?.success === false || res?.changes === 0) {
    throw error(404, 'Not found');
  }

  return json({ ok: true, id: colorId, message: 'Updated' });
};

// DELETE /api/inventory/:id  -> remove one item
export const DELETE = async (event) => {
  const { platform, params, locals, cookies } = event;
  const user = await requireUser({ locals, platform, cookies });

  const db = platform?.env?.DB;
  if (!db) throw error(500, 'No DB binding');

  const colorId = String(params.id || '').trim();
  if (!colorId) throw error(400, 'Missing id');

  const res = await db.prepare(`
    DELETE FROM inventory
    WHERE user_id = ? AND color_id = ?
  `).bind(user.id, colorId).run();

  if (res?.success === false || res?.changes === 0) {
    throw error(404, 'Not found');
  }

  return json({ ok: true, id: colorId, message: 'Deleted' });
};
