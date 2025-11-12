import { verifyAnyPassword } from "$lib/server/auth/verify.js";  // from earlier step
import { hashPassword } from "$lib/server/auth/password.js";
import { readCreds } from "$lib/server/helpers/cred.js";
import { createSessionRow } from "$lib/server/auth/sessions.js";

export const POST = async ({ request, locals }) => {
  const DB = locals.DB;
  if (!DB) return new Response("Auth not initialized", { status: 500 });

  const { email, password } = await readCreds(request);
  if (!email || !password) return new Response("Missing credentials", { status: 400 });

  const { results } = await DB.prepare(`
    SELECT u.id AS user_id, uk.hashed_password AS hash
    FROM user u
    JOIN user_key uk ON uk.user_id = u.id
    WHERE uk.id = ? LIMIT 1
  `).bind(`email:${email}`).all();

  if (!results?.length) return new Response("Invalid credentials", { status: 401 });

  const row = results[0];
  const ok = await verifyAnyPassword(password, row.hash);
  if (!ok) return new Response("Invalid credentials", { status: 401 });

  // optional: migrate legacy "$scrypt$" → "scrypt:N,r,p:" on successful login
  if (row.hash.startsWith("$scrypt$")) {
    const newHash = await hashPassword(password);
    await DB.prepare(`UPDATE user_key SET hashed_password=? WHERE id=? AND user_id=?`)
      .bind(newHash, `email:${email}`, row.user_id).run();
  }

  // ⚠️ Manual session insert that matches your table
  const { cookieHeaderValue } = await createSessionRow(DB, row.user_id);

  return new Response(null, { status: 204, headers: { "Set-Cookie": cookieHeaderValue } });
};
