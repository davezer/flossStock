// Manual session insert that matches your current session table.
// Shape: id, user_id, active_expires, idle_expires, expires_at
// Returns { id, cookieHeaderValue }

function randId(bytes = 16) {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  // base64url without padding
  let s = btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
  return s;
}

export async function createSessionRow(DB, userId, {
  activeSecs = 60 * 60 * 24 * 7,   // 7 days "active"
  idleSecs   = 60 * 60 * 24 * 30   // 30 days "idle"
} = {}) {
  const id = randId();
  const now = Math.floor(Date.now() / 1000);
  const active_expires = now + activeSecs;
  const idle_expires   = now + idleSecs;
  const expires_at     = active_expires; // keep legacy column coherent

  await DB.prepare(
    `INSERT INTO session (id, user_id, active_expires, idle_expires, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, userId, active_expires, idle_expires, expires_at).run();

  // Build the cookie value exactly like your config (name: auth_session; SameSite=Lax; Secure; Path=/)
  const cookie = [
    `auth_session=${id}`,
    'Path=/',
    'SameSite=Lax',
    'HttpOnly',     // recommended
    'Secure'        // pages.dev is HTTPS
  ].join('; ');

  return { id, cookieHeaderValue: cookie };
}
