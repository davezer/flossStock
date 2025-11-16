// src/routes/api/projects/[project_id]/+server.js
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

export async function DELETE(event) {
  const { params, locals, cookies, platform } = event;
  const db = platform?.env?.DB;
  const bucket = platform?.env?.flossstock_projects;

  if (!db) throw error(500, 'Database not available');
  if (!bucket) throw error(500, 'Storage not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Not authenticated');

  const id = params.project_id;

  // Fetch project row
  const project = await db
    .prepare(
      'SELECT id, user_id, pdf_path, name FROM project WHERE id = ? AND user_id = ?'
    )
    .bind(id, user.id)
    .first();

  if (!project) throw error(404, 'Project not found');

  // Work out which object key(s) we might have used in R2
  const keysToTry = [];

  if (project.pdf_path && !project.pdf_path.startsWith('pending:')) {
    keysToTry.push(project.pdf_path);
  }

  // deterministic fallback
  keysToTry.push(`projects/${project.user_id}/${project.id}.pdf`);

  // Best-effort delete in R2
  for (const key of keysToTry) {
    try {
      await bucket.delete(key);
    } catch {
      // ignore – if it's missing that's fine
    }
  }

  // Delete project_color links first (if FK isn't set to CASCADE this is still safe)
  try {
    await db
      .prepare('DELETE FROM project_color WHERE project_id = ?')
      .bind(project.id)
      .run();
  } catch (e) {
    console.warn('[project delete] could not clear project_color rows', e);
  }

  // Delete the project row itself
  await db
    .prepare('DELETE FROM project WHERE id = ? AND user_id = ?')
    .bind(project.id, user.id)
    .run();

  return json({ ok: true, deleted: project.id });
}
