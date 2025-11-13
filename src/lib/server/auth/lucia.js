// src/lib/server/auth/lucia.js
import { Lucia } from "lucia";
import { D1Adapter } from "@lucia-auth/adapter-sqlite";

export function getLucia(DB) {
  if (!DB) return null;

  try {
    const adapter = new D1Adapter(DB, {
      user: "user",
      session: "session"
    });

    return new Lucia(adapter, {
      sessionCookie: {
        name: "auth_session",
        attributes: { sameSite: "lax", path: "/", secure: true }
      },
      getUserAttributes: (u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        avatarUrl: u.avatar_url
      })
    });
  } catch (e) {
    console.error("[auth] Lucia init failed:", e);
    return null;
  }
}
