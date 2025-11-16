// src/routes/api/projects/+server.js
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

// ============ LIST PROJECTS (GET) ============
export async function GET({ locals, cookies, platform }) {
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) {
    return json({ ok: true, projects: [] });
  }

  const { results } = await db
    .prepare('SELECT * FROM project WHERE user_id = ? ORDER BY created_at DESC')
    .bind(user.id)
    .all();

  return json({
    ok: true,
    projects: results ?? []
  });
}

// ============ CREATE PROJECT (POST) ============
export async function POST({ request, locals, cookies, platform }) {
  const db = platform?.env?.DB;
  const bucket = platform?.env?.flossstock_projects; // 👈 replace with your actual binding name

  if (!db) throw error(500, 'Database not available');
  if (!bucket) throw error(500, 'R2 bucket binding missing');

  const user = await resolveUser({ locals, cookies, platform });
  if (!user) throw error(401, 'Not authenticated');

  const form = await request.formData();
  const nameRaw = form.get('name');
  const file = form.get('file');

  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';

  if (!name) {
    return json({ ok: false, error: 'Project name required' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return json({ ok: false, error: 'PDF file required' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const pdf_name = file.name ?? 'pattern.pdf';
  const pdf_size = file.size ?? 0;

  // ---------- upload to R2 ----------
  const ext = pdf_name.split('.').pop() || 'pdf';
  const key = `projects/${user.id}/${id}.${ext}`;

  await bucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/pdf',
      contentDisposition: `inline; filename="${pdf_name}"`
    }
  });

  // ---------- persist metadata in D1 ----------
  await db
    .prepare(
      `
      INSERT INTO project (id, user_id, name, pdf_name, pdf_size, pdf_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    `
    )
    .bind(id, user.id, name, pdf_name, pdf_size, key)
    .run();

  return json(
    {
      ok: true,
      project: {
        id,
        user_id: user.id,
        name,
        pdf_name,
        pdf_size,
        pdf_path: key
      }
    },
    { status: 201 }
  );
}
