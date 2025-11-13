import { hashPassword } from "$lib/server/auth/password.js";
import { readCreds } from "$lib/server/helpers/cred.js";     // JSON+Form support
import { createSessionRow } from "$lib/server/auth/sessions.js";

export const POST = async ({ request, locals }) => {
  try {
    const DB = locals.DB;
    if (!DB) return new Response("Auth not initialized", { status: 500 });

    const { email, password, username } = await readCreds(request);

    if (!email || !password) {
      return new Response("Missing credentials", { status: 400 });
    }
    // If you want username to be required, uncomment this:
    // if (!username) {
    //   return new Response("Missing username", { status: 400 });
    // }

    // If a username was provided, make sure it's not already in use
    if (username) {
      const existing = await DB.prepare(
        `SELECT id FROM user WHERE username = ? LIMIT 1`
      ).bind(username).first();

      if (existing) {
        return new Response("Username already taken", { status: 409 });
      }
    }

    // ensure user row
    let userId = (await DB.prepare(
      `SELECT id FROM user WHERE email = ? LIMIT 1`
    ).bind(email).first())?.id;

    if (!userId) {
      // brand new user
      userId = crypto.randomUUID();
      await DB.prepare(
        `INSERT INTO user (id, email, username, created_at)
         VALUES (?, ?, ?, unixepoch())`
      )
        .bind(userId, email, username ?? null)
        .run();
    } else if (username) {
      // user exists (same email), optionally set username for them
      await DB.prepare(
        `UPDATE user SET username = ? WHERE id = ?`
      )
        .bind(username, userId)
        .run();
    }

    // set password (unchanged)
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

    // manual session insert (unchanged)
    const { cookieHeaderValue } = await createSessionRow(DB, userId);

    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": cookieHeaderValue }
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return new Response(`Register error: ${e?.message || e}`, { status: 500 });
  }
};
