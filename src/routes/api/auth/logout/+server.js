// src/routes/api/auth/logout/+server.js
export const POST = async ({ locals, cookies }) => {
  const lucia = locals.lucia;
  const sid = cookies.get("auth_session");

  // Best-effort: invalidate server-side
  if (sid && lucia) {
    try {
      await lucia.invalidateSession(sid);
    } catch (e) {
      console.warn("[logout] invalidateSession:", e?.message || e);
    }
  }

  // 🔑 Clear the cookie using Lucia's own attributes (prevents ghost/stale cookies)
  if (lucia) {
    const blank = lucia.createBlankSessionCookie();
    cookies.set(blank.name, blank.value, blank.attributes);
  } else {
    // Fallback if lucia missing
    cookies.set("auth_session", "", { path: "/", maxAge: 0 });
  }

  // Force a new request so hooks run without a session
  return new Response(null, { status: 303, headers: { Location: "/" } });
};
