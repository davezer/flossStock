// No TS, pure JS
import { Lucia } from "lucia";
import { D1Adapter } from "@lucia-auth/adapter-sqlite";



export function getLucia(DB) {
  if (!DB) return null;

  try {
    // Use v3 adapter + v3 table names
    const adapter = new D1Adapter(DB, {
      user: "user",
      session: "session"
    });

    return new Lucia(adapter, {
      sessionCookie: {
        name: "auth_session",
        attributes: { sameSite: "lax", path: "/", secure: true }
      },
      getUserAttributes: (u) => ({ id: u.id, email: u.email })
    });
  } catch (e) {
    console.error("[auth] Lucia init failed:", e);
    return null;
  }
}
