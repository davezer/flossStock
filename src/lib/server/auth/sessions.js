// src/lib/server/auth/sessions.js
// Manual session insert that matches your current `session` table.
// Columns: id, user_id, active_expires, idle_expires
// Returns { id, cookieHeaderValue }

function randId(bytes = 16) {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  // base64url without padding
  let s = btoa(String.fromCharCode(...u))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return s;
}

export async function createSessionRow(
  DB,
  userId,
  {
    activeSecs = 60 * 60 * 24 * 7, // 7 days
    idleSecs = 60 * 60 * 24 * 30   // 30 days
  } = {}
) {
  const id = randId(16);
  const now = Math.floor(Date.now() / 1000);

  const active_expires = now + activeSecs;
  const idle_expires = now + idleSecs;

  await DB.prepare(
    `INSERT INTO session (id, user_id, active_expires, idle_expires)
     VALUES (?, ?, ?, ?)`
  )
    .bind(id, userId, active_expires, idle_expires)
    .run();

  const cookie = [
    `auth_session=${id}`,
    "Path=/",
    "SameSite=Lax",
    "Secure"
  ].join("; ");

  return { id, cookieHeaderValue: cookie };
}
