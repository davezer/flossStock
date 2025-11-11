import { verifyPassword } from "$lib/server/auth/password.js";

export const POST = async ({ request, locals }) => {
  const lucia = locals.lucia;
  const DB = locals.DB;
  if (!DB || !lucia) return new Response("Auth not initialized", { status: 500 });

  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (!email || !password) return new Response("Missing credentials", { status: 400 });

  // fetch user + hash
  const { results } = await DB.prepare(
    `SELECT u.id AS user_id, uk.hashed_password AS hash
       FROM user u
       JOIN user_key uk ON uk.user_id = u.id
      WHERE uk.id = ? LIMIT 1`
  ).bind(`email:${email}`).all();

  if (!results?.length) return new Response("Invalid credentials", { status: 401 });

  const row = results[0];
  const ok = await verifyPassword(password, row.hash);
  if (!ok) return new Response("Invalid credentials", { status: 401 });

  const session = await lucia.createSession(row.user_id, {});
  const cookie = lucia.createSessionCookie(session.id);

  return new Response(null, { status: 204, headers: { Location: "/", "Set-Cookie": cookie.serialize() } });
};
