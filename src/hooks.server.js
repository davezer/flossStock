// src/hooks.server.js
import { getLucia } from '$lib/server/auth/lucia.js';

export async function handle({ event, resolve }) {
  const DB = event.platform?.env?.DB ?? null;
  event.locals.DB = DB;

  const lucia = DB ? getLucia(DB) : null;
  event.locals.lucia = lucia;

  event.locals.user = null;
  event.locals.session = null;

  if (!lucia) {
    console.warn('[auth] No DB or Lucia instance; auth disabled');
    return resolve(event);
  }

  const sessionId = event.cookies.get('auth_session') ?? null;

  // 👉 IMPORTANT: if there is no session cookie yet,
  // just continue. DO NOT set a blank cookie here.
  if (!sessionId) {
    return resolve(event);
  }

  try {
    const { session, user } = await lucia.validateSession(sessionId);

    event.locals.session = session;
    event.locals.user = user ?? null;

    const response = await resolve(event);

    // Sliding expiration: refresh cookie if session is fresh
    if (session && session.fresh) {
      const sessionCookie = lucia.createSessionCookie(session.id);
      response.headers.append('Set-Cookie', sessionCookie.serialize());
    }

    // If session is gone/expired, clear cookie
    if (!session) {
      const blank = lucia.createBlankSessionCookie();
      response.headers.append('Set-Cookie', blank.serialize());
    }

    return response;
  } catch (err) {
    console.warn('[auth] validateSession error, clearing cookie:', err?.message || err);
    const response = await resolve(event);
    const blank = lucia.createBlankSessionCookie();
    response.headers.append('Set-Cookie', blank.serialize());
    return response;
  }
}
