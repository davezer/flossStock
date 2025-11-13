// src/routes/api/scan-dmc/+server.js
import { json } from "@sveltejs/kit";

export const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const DB = locals.DB;
  if (!DB) {
    return new Response("DB not available", { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = body?.text;
  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  // 1) Tokenize text
  const tokens = text
  .split(/[^A-Za-z0-9]+/)
  .map(t => t.trim().toUpperCase())
  .filter(Boolean);

  // 2) Heuristic: things that look like DMC codes (e.g. "310", "5200", "B5200")
  const candidates = Array.from(
    new Set(
      tokens.filter((t) =>
        /^([B])?\d{3,4}$/.test(t) // tweak if you want more patterns
      )
    )
  );

  if (!candidates.length) {
    return json({
      codesFound: [],
      have: [],
      missing: []
    });
  }

  const userId = user.userId || user.id;
  if (!userId) {
    return new Response("User missing id", { status: 500 });
  }

  // 3) Query colors + inventory for this user
  const placeholders = candidates.map(() => "?").join(", ");

  const stmt = DB.prepare(
    `
    SELECT
      c.id,
      c.code,
      c.name,
      i.qty AS quantity
    FROM color c
    LEFT JOIN inventory i
      ON i.color_id = c.id AND i.user_id = ?
    WHERE c.code IN (${placeholders})
  `
  );

  const result = await stmt.bind(userId, ...candidates).all();

  const rows = result?.results || result?.rows || result || [];

  const have = [];
  const missing = [];

  for (const row of rows) {
    const quantity = row.quantity ?? 0;
    const entry = {
      code: row.code,
      name: row.name,
      quantity
    };

    if (quantity > 0) {
      have.push(entry);
    } else {
      missing.push(entry);
    }
  }

  return json({
    codesFound: candidates,
    have,
    missing
  });
};
