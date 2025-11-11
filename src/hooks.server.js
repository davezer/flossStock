import { getLucia } from "$lib/server/auth/lucia.js";

export async function handle({ event, resolve }) {
  try {
    // Always stash DB and Lucia on locals (or null), never throw
    const DB = event.platform?.env?.DB ?? null;
    event.locals.DB = DB;

    const lucia = getLucia(DB);
    event.locals.lucia = lucia;

    // Try to recover session -> user, but do not throw on failure
    event.locals.user = null;
    event.locals.session = null;

    if (lucia) {
      const sid = event.cookies.get("auth_session");
      if (sid) {
        try {
          const { user, session } = await lucia.validateSession(sid);
          event.locals.user = user ?? null;
          event.locals.session = session ?? null;
        } catch (err) {
          // bad/expired cookie: clear it and continue
          event.cookies.delete("auth_session", { path: "/" });
          console.warn("[auth] validateSession error (cleared cookie):", err?.message || err);
        }
      }
    } else {
      // Useful when DB binding isn’t wired in Pages project
      console.warn("[auth] No DB binding; auth disabled for this request");
    }
  } catch (err) {
    // Absolutely never crash the request
    console.error("[hooks] fatal during auth bootstrap:", err);
  }

  return resolve(event);
}
