// src/lib/server/auth.js
import { Lucia } from 'lucia';
// Both v2 and v3 export from the same package name, but with different symbols.
// v2 -> { d1 } (function) ; v3 -> { D1Adapter } (class)
import * as sqlite from '@lucia-auth/adapter-sqlite';

let AUTH_SINGLETON = null;
let LAST_DB = null;

export function getLucia(db) {
  if (!db) throw new Error('D1 DB binding missing');
  if (AUTH_SINGLETON && LAST_DB === db) return AUTH_SINGLETON;

  const tables = { user: 'user', key: 'user_key', session: 'user_session' };

  // Build an adapter that works with either version
  const adapter = sqlite.D1Adapter
    ? new sqlite.D1Adapter(db, tables) // v3
    : sqlite.d1(db, tables);           // v2

  const auth = new Lucia(adapter, {
    sessionCookie: {
      name: 'auth_session',
      attributes: {
        secure: true,          // required on HTTPS (Pages)
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      }
    },
    getUserAttributes: (data) => ({
      email: data.email
    })
  });

  AUTH_SINGLETON = auth;
  LAST_DB = db;
  return auth;
}
