// src/routes/auth/login/+page.server.js
import { redirect, fail } from '@sveltejs/kit';
import { verifyPassword } from '$lib/server/auth/password.js';

export const load = ({ locals }) => {
  if (locals.user) throw redirect(303, '/');
  return {};
};

export const actions = {
  default: async ({ request, locals, cookies }) => {
    const { lucia, DB } = locals;
    if (!DB || !lucia) return fail(500, { message: 'Auth not initialized' });

    const form = await request.formData();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    if (!email || !password) return fail(400, { message: 'Missing credentials' });

    const { results } = await DB.prepare(`
      SELECT u.id AS user_id, uk.hashed_password AS hash
      FROM user u
      JOIN user_key uk ON uk.user_id = u.id
      WHERE uk.id = ? LIMIT 1
    `).bind(`email:${email}`).all();

    if (!results?.length) return fail(401, { message: 'Invalid credentials' });

    const row = results[0];
    const ok = await verifyPassword(password, row.hash);
    if (!ok) return fail(401, { message: 'Invalid credentials' });

    const session = await lucia.createSession(row.user_id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    throw redirect(303, '/');
  }
};
