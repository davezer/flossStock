// src/routes/auth/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';
import { readCreds } from '$lib/server/helpers/cred.js';
import { verifyAnyPassword } from '$lib/server/auth/verify.js';
import { hashPassword } from '$lib/server/auth/password.js';
import { createSessionRow } from '$lib/server/auth/sessions.js';

export const actions = {
  default: async ({ request, locals, cookies }) => {
    const DB = locals.DB;
    if (!DB) return fail(500, { message: 'Auth not initialized' });

    const { email, password } = await readCreds(request);
    if (!email || !password) return fail(400, { message: 'Missing credentials' });

    const { results } = await DB.prepare(`
      SELECT u.id AS user_id, uk.hashed_password AS hash
      FROM user u
      JOIN user_key uk ON uk.user_id = u.id
      WHERE uk.id = ? LIMIT 1
    `).bind(`email:${email}`).all();

    if (!results?.length) return fail(400, { message: 'Invalid credentials' });

    const row = results[0];
    const ok = await verifyAnyPassword(password, row.hash);
    if (!ok) return fail(400, { message: 'Invalid credentials' });

    // optional: migrate legacy "$scrypt$" to "scrypt:N,r,p:"
    if (row.hash?.startsWith('$scrypt$')) {
      const newHash = await hashPassword(password);
      await DB.prepare(`UPDATE user_key SET hashed_password=? WHERE id=? AND user_id=?`)
        .bind(newHash, `email:${email}`, row.user_id).run();
    }

    // Manual session insert that matches your current session table
    const { id } = await createSessionRow(DB, row.user_id);

    // Set cookie here (same attrs you use elsewhere)
    // +page.server.js (your Option 2 action)
cookies.set('auth_session', id, { path: '/', sameSite: 'lax', httpOnly: true, secure: true });
throw redirect(303, '/'); // important: throw, not return


  }
};
