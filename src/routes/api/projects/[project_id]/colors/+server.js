// src/routes/api/projects/[project_id]/colors/+server.js
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

// ---------- GET: project + its colors ----------
export async function GET(event) {
  const { params, platform, locals, cookies } = event;
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Unauthorized');

  const projectId = params.project_id;

  // Fetch the project and ensure it belongs to this user
  const project = await db
    .prepare('SELECT id, user_id, name, pdf_path, created_at FROM project WHERE id = ?')
    .bind(projectId)
    .first();

  if (!project) throw error(404, 'Project not found');
  if (project.user_id !== user.id) throw error(403, 'Forbidden');

  // Colors used in this project
  const rowsRes = await db
    .prepare(
      `
      SELECT
        pc.color_id,
        c.code,
        c.name,
        c.hex,
        COALESCE(i.qty, 0) AS quantity
      FROM project_color pc
      JOIN color c
        ON c.id = pc.color_id
      LEFT JOIN inventory i
        ON i.color_id = pc.color_id
       AND i.user_id = ?
      WHERE pc.project_id = ?
      ORDER BY CAST(c.code AS INTEGER) ASC, c.code ASC
    `
    )
    .bind(user.id, projectId)
    .all();

  const colors = rowsRes?.results ?? [];

  return json({
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      pdf_path: project.pdf_path,
      created_at: project.created_at
    },
    colors
  });
}

// ---------- POST: add one or many colors to project ----------
export async function POST(event) {
  const { params, platform, locals, cookies, request } = event;
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Unauthorized');

  const projectId = params.project_id;

  const project = await db
    .prepare('SELECT id, user_id FROM project WHERE id = ?')
    .bind(projectId)
    .first();

  if (!project) throw error(404, 'Project not found');
  if (project.user_id !== user.id) throw error(403, 'Forbidden');

  const body = await request.json().catch(() => ({}));
  let list = [];

  if (Array.isArray(body.color_ids)) {
    list = body.color_ids.map((id) => String(id).trim()).filter(Boolean);
  } else if (body.color_id) {
    list = [String(body.color_id).trim()];
  }

  if (!list.length) {
    return json({ ok: false, error: 'color_id or color_ids required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO project_color (project_id, color_id, created_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(project_id, color_id) DO NOTHING
  `);

  for (const colorId of list) {
    await stmt.bind(projectId, colorId).run();
  }

  return json({ ok: true, added: list.length });
}

// ---------- DELETE: remove a color from project ----------
export async function DELETE(event) {
  const { params, platform, locals, cookies, url, request } = event;
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Unauthorized');

  const projectId = params.project_id;

  const project = await db
    .prepare('SELECT id, user_id FROM project WHERE id = ?')
    .bind(projectId)
    .first();

  if (!project) throw error(404, 'Project not found');
  if (project.user_id !== user.id) throw error(403, 'Forbidden');

  // color_id can come from query (?color_id=...) OR JSON body
  let colorId = url.searchParams.get('color_id');
  if (!colorId) {
    const body = await request.json().catch(() => ({}));
    if (body?.color_id) colorId = String(body.color_id).trim();
  }

  if (!colorId) {
    return json({ ok: false, error: 'color_id required' }, { status: 400 });
  }

  await db
    .prepare('DELETE FROM project_color WHERE project_id = ? AND color_id = ?')
    .bind(projectId, colorId)
    .run();

  return json({ ok: true, deleted: 1 });
}
