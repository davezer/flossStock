// src/routes/api/auth/register/+server.js
import { hashPassword } from "$lib/server/auth/password.js";

export const POST = async ({ request, locals }) => {
  try {
    const DB = locals.DB;
    const lucia = locals.lucia;
    if (!DB || !lucia) return new Response("Auth not initialized", { status: 500 });

    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    if (!email || !password) return new Response("Missing credentials", { status: 400 });

    // ensure user row exists
    let userId = (await DB.prepare(`SELECT id FROM user WHERE email=? LIMIT 1`).bind(email).first())?.id;
    if (!userId) {
      userId = crypto.randomUUID();
      await DB.prepare(`INSERT INTO user (id,email,created_at) VALUES (?,?,unixepoch())`)
        .bind(userId, email)
        .run();
    }

    // set/reset password hash (match table: id,user_id,hashed_password)
    const hash = await hashPassword(password);
    await DB.prepare(`
      INSERT INTO user_key (id, user_id, hashed_password)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        hashed_password = excluded.hashed_password
    `)
      .bind(`email:${email}`, userId, hash)
      .run();

    // sign in immediately
    const session = await lucia.createSession(userId, {});
    const cookie = lucia.createSessionCookie(session.id);
    return new Response(null, { status: 204, headers: { "Set-Cookie": cookie.serialize() } });
  } catch (e) {
    // temporary verbose error helps while we stabilize; remove later
    return new Response(`Register error: ${e?.message || e}`, { status: 500 });
  }
};
