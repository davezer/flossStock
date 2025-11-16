// src/routes/api/projects/[project_id]/file/+server.js
import { error } from '@sveltejs/kit';
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

export async function GET(event) {
  const { params, locals, cookies, platform } = event;
  const db = platform?.env?.DB;
  const bucket = platform?.env?.flossstock_projects;

  if (!db) throw error(500, 'Database not available');
  if (!bucket) throw error(500, 'Storage not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Not authenticated');

  const id = params.project_id;

  const project = await db
    .prepare(
      'SELECT id, user_id, name, pdf_path FROM project WHERE id = ? AND user_id = ?'
    )
    .bind(id, user.id)
    .first();

  if (!project) throw error(404, 'Project not found');

  const tried = [];
  const candidates = [];

  // 1) Whatever we have stored in the DB, unless it's a "pending:" placeholder
  if (project.pdf_path && !project.pdf_path.startsWith('pending:')) {
    candidates.push(project.pdf_path);
  }

  // 2) Deterministic fallback for new uploads
  candidates.push(`projects/${project.user_id}/${project.id}.pdf`);

  // Try each candidate in order
  for (const key of candidates) {
    if (!key) continue;
    tried.push(key);

    const obj = await bucket.get(key);
    if (obj) {
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Cache-Control', 'public, max-age=3600');
      return new Response(obj.body, { headers });
    }
  }

  console.error('[project file] PDF missing in R2', {
    projectId: project.id,
    userId: project.user_id,
    tried
  });

  throw error(404, 'PDF missing from storage');
}
