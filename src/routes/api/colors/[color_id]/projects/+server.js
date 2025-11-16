// src/routes/api/colors/[color_id]/projects/+server.js
import { json, error } from '@sveltejs/kit';
import { getLucia } from '$lib/server/auth/lucia.js';

// Re-use the same helper you have elsewhere
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

export async function GET({ params, locals, cookies, platform }) {
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) {
    // for the inventory page we just want "no projects" when logged out
    return json({ ok: true, projects: [] }, { status: 200 });
  }

  const colorId = params.color_id;
  if (!colorId) {
    return json({ ok: false, error: 'color_id required' }, { status: 400 });
  }

  // color_id will be something like "dmc:default:310"
  // project_color schema:
  //   project_id TEXT, color_id TEXT, created_at INTEGER ...
  const { results } = await db
    .prepare(
      `
      SELECT p.id, p.name
      FROM project_color AS pc
      JOIN project AS p ON p.id = pc.project_id
      WHERE pc.color_id = ? AND p.user_id = ?
      ORDER BY p.created_at DESC
    `
    )
    .bind(colorId, user.id)
    .all();

  return json({
    ok: true,
    projects: results ?? []
  });
}
