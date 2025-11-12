import { hashPassword } from "$lib/server/auth/password.js";
import { readCreds } from "$lib/server/helpers/cred.js";     // from earlier message (JSON+Form support)
import { createSessionRow } from "$lib/server/auth/sessions.js";

export const POST = async ({ request, locals }) => {
  try {
    const DB = locals.DB;
    if (!DB) return new Response("Auth not initialized", { status: 500 });

    const { email, password } = await readCreds(request);
    if (!email || !password) return new Response("Missing credentials", { status: 400 });

    // ensure user row
    let userId = (await DB.prepare(`SELECT id FROM user WHERE email=? LIMIT 1`).bind(email).first())?.id;
    if (!userId) {
      userId = crypto.randomUUID();
      await DB.prepare(`INSERT INTO user (id,email,created_at) VALUES (?,?,unixepoch())`)
        .bind(userId, email).run();
    }

    // set password
    const hash = await hashPassword(password);
    await DB.prepare(`
      INSERT INTO user_key (id, user_id, hashed_password)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        hashed_password = excluded.hashed_password
    `).bind(`email:${email}`, userId, hash).run();

    // ⚠️ Manual session insert that matches your table
    const { cookieHeaderValue } = await createSessionRow(DB, userId);

    return new Response(null, { status: 204, headers: { "Set-Cookie": cookieHeaderValue } });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return new Response(`Register error: ${e?.message || e}`, { status: 500 });
  }
};
