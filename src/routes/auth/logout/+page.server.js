import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ locals, cookies }) => {
    const lucia = locals.lucia;
    const sid = cookies.get('auth_session');
    if (sid && lucia) {
      try { await lucia.invalidateSession(sid); } catch (e) { console.error("[logout] invalidateSession:", e?.message || e); }
      const blank = lucia.createBlankSessionCookie();
      cookies.set(blank.name, blank.value, blank.attributes);
    } else {
      cookies.set('auth_session', '', { path: '/', maxAge: 0 });
    }
    throw redirect(303, '/');
  }
};
