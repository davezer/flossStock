// // src/routes/auth/login/+page.server.js
// import { fail, redirect } from '@sveltejs/kit';
// import { readCreds } from '$lib/server/helpers/cred.js';
// import { verifyAnyPassword } from '$lib/server/auth/verify.js';
// import { hashPassword } from '$lib/server/auth/password.js'; // for legacy upgrade

// export const actions = {
//   default: async ({ request, locals, cookies }) => {
//     const DB = locals.DB;
//     const lucia = locals.lucia;

//     if (!DB || !lucia) {
//       console.error('[login] Missing DB or lucia in locals');
//       return fail(500, { message: 'Auth not initialized' });
//     }

//     const { email, password } = await readCreds(request);
//     if (!email || !password) {
//       return fail(400, { message: 'Missing credentials' });
//     }

//     // Find user + hash
//     const { results } = await DB.prepare(
//       `
//       SELECT u.id AS user_id, uk.hashed_password AS hash
//       FROM user u
//       JOIN user_key uk ON uk.user_id = u.id
//       WHERE u.email = ?
//       LIMIT 1
//       `
//     )
//       .bind(email)
//       .all();

//     const row = results?.[0];
//     if (!row || !row.hash) {
//       return fail(400, { message: 'Invalid email or password' });
//     }

//     const ok = await verifyAnyPassword(password, row.hash);
//     if (!ok) {
//       return fail(400, { message: 'Invalid email or password' });
//     }

//     // Optional: upgrade legacy "$scrypt$" hashes
//     if (row.hash.startsWith('$scrypt$')) {
//       const newHash = await hashPassword(password);
//       await DB.prepare(
//         `UPDATE user_key SET hashed_password = ? WHERE id = ? AND user_id = ?`
//       )
//         .bind(newHash, `email:${email}`, row.user_id)
//         .run();
//     }

//     // ✅ Create Lucia session
//     const session = await lucia.createSession(row.user_id, {});
//     const sessionCookie = lucia.createSessionCookie(session.id);

//     // ✅ Set auth_session cookie via SvelteKit
//     cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

//     // ✅ Redirect home
//     throw redirect(303, '/');
//   }
// };
