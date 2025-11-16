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
  const itemsRaw = body?.items;

  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  // ---------- Helpers ----------

  const SPECIAL_CODES = new Set(["BLANC", "ECRU"]);
  const CODE_RE = /^D?(B?\d{3,4})$/; // D307, 307, B5200, 310, etc

  function extractFromColumns(items) {
    if (!Array.isArray(items) || !items.length) return [];

    const positioned = items
      .map((it) => ({
        text: String(it.str || "").trim(),
        upper: String(it.str || "").trim().toUpperCase(),
        x: typeof it.x === "number" ? it.x : Number(it?.transform?.[4] ?? 0),
        y: typeof it.y === "number" ? it.y : Number(it?.transform?.[5] ?? 0)
      }))
      .filter((it) => it.text);

    const dmcHeaders = positioned.filter((p) => p.upper === "DMC");
    const anchorHeaders = positioned.filter((p) =>
      p.upper.startsWith("ANCHOR")
    );

    if (!dmcHeaders.length || !anchorHeaders.length) return [];

    // Pair each DMC header with the nearest Anchor header on roughly same row
    const blocks = [];
    for (const d of dmcHeaders) {
      let best = null;
      let bestDy = Infinity;
      for (const a of anchorHeaders) {
        if (a.x <= d.x) continue; // anchor must be to the right
        const dy = Math.abs(a.y - d.y);
        if (dy < bestDy) {
          bestDy = dy;
          best = a;
        }
      }
      // y-threshold: headers on same line
      if (best && bestDy < 20) {
        blocks.push({
          dmcX: d.x,
          anchorX: best.x
        });
      }
    }

    if (!blocks.length) return [];

    const margin = 4;
    const codes = new Set();

    for (const item of positioned) {
      const t = item.upper;
      let code = null;

      if (SPECIAL_CODES.has(t)) {
        code = t;
      } else {
        const m = t.match(CODE_RE);
        if (!m) continue;
        code = m[1]; // stripped leading D if present
      }

      // If this token falls into any DMC column block, treat it as a DMC code
      for (const block of blocks) {
        const mid = (block.dmcX + block.anchorX) / 2;
        if (item.x >= block.dmcX - margin && item.x <= mid) {
          codes.add(code);
          break;
        }
      }
    }

    return Array.from(codes);
  }

  function extractFromText(text) {
    const rawTokens = text
      .split(/[^A-Za-z0-9]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const codeTokens = []; // { code, idx }

    for (let i = 0; i < rawTokens.length; i++) {
      const tok = rawTokens[i];
      if (SPECIAL_CODES.has(tok)) {
        codeTokens.push({ code: tok, idx: i });
        continue;
      }
      const m = tok.match(CODE_RE);
      if (!m) continue;
      codeTokens.push({ code: m[1], idx: i });
    }

    if (!codeTokens.length) return [];

    const WINDOW = 4;
    const nearDmc = new Set();

    for (const { code, idx } of codeTokens) {
      const start = Math.max(0, idx - WINDOW);
      const end = Math.min(rawTokens.length, idx + WINDOW + 1);
      const window = rawTokens.slice(start, end);
      if (window.includes("DMC")) {
        nearDmc.add(code);
      }
    }

    const set = nearDmc.size
      ? nearDmc
      : new Set(codeTokens.map((c) => c.code));

    return Array.from(set);
  }

  // ---------- Pick candidates ----------

  const columnCodes = extractFromColumns(itemsRaw || []);
  const fallbackCodes = extractFromText(text);

  let candidates = columnCodes.length
    ? columnCodes
    : fallbackCodes;

  // de-dup
  candidates = Array.from(new Set(candidates));

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

  // ---------- Query DB ----------

  const placeholders = candidates.map(() => "?").join(", ");

  const stmt = DB.prepare(
    `
    SELECT
      c.id   AS color_id,
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
  const seenCodes = new Set();

  for (const row of rows) {
    const quantity = row.quantity ?? 0;
    const entry = {
      // Always expose a canonical color_id
      color_id: row.color_id ?? row.id,
      // Keep these around too if you want, but not required
      id: row.color_id ?? row.id,
      colorId: row.color_id ?? row.id,

      code: row.code,
      name: row.name,
      quantity
    };


    seenCodes.add(row.code);

    if (quantity > 0) {
      have.push(entry);
    } else {
      missing.push(entry);
    }
  }

  const codesFound = Array.from(seenCodes);

  return json({
    codesFound,
    have,
    missing
  });
};
