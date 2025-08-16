#!/usr/bin/env node
/**
 * build-dmc-from-maxxmint-standalone.mjs
 * Node 18+ only. No external deps.
 * Scrapes https://floss.maxxmint.com/dmc_to_rgb.php and writes ./dmc.json
 * Format: [{ code, name, hex, red, green, blue }]
 */

import { writeFile } from "node:fs/promises";

const SRC = "https://floss.maxxmint.com/dmc_to_rgb.php";

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function textify(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function toHex(n) {
  return Number(n).toString(16).padStart(2, "0").toUpperCase();
}

async function main() {
  console.log("Fetching:", SRC);
  const res = await fetch(SRC, { headers: { "user-agent": "Mozilla/5.0 (compatible; dmc-scraper/1.0)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();

  // Extract all <tr>...</tr> blocks
  const trs = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) trs.push(m[1]);

  const rows = [];
  for (const tr of trs) {
    const tds = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let mm;
    while ((mm = tdRe.exec(tr))) tds.push(mm[1]);
    // Expect at least 7 cells: [swatch] [DMC] [Name] [Hex] [R] [G] [B]
    if (tds.length >= 7) {
      const code = textify(tds[1]);
      const name = textify(tds[2]);
      let hex = textify(tds[3]).toUpperCase();
      const r = parseInt(textify(tds[4]), 10);
      const g = parseInt(textify(tds[5]), 10);
      const b = parseInt(textify(tds[6]), 10);

      if (!code || !name) continue;
      // Ensure hex
      if (!/^#[0-9A-F]{6}$/.test(hex)) {
        if (/^[0-9A-F]{6}$/.test(hex)) hex = "#" + hex;
        else if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          hex = "#" + toHex(r) + toHex(g) + toHex(b);
        } else continue;
      }
      // Guard RGB bounds
      if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) continue;

      rows.push({ code: code.trim(), name: name.trim(), hex, red: r, green: g, blue: b });
    }
  }

  // Filter header rows / duplicates
  const clean = [];
  const seen = new Set();
  for (const r of rows) {
    if (!/^#([0-9A-F]{6})$/.test(r.hex)) continue;
    const key = r.code;
    if (!seen.has(key)) {
      seen.add(key);
      clean.push(r);
    }
  }

  // Sort by numeric code when possible, keep alpha codes at end
  const asNum = (c) => {
    const n = parseInt(String(c).replace(/\D+/g, ""), 10);
    return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
  };
  clean.sort((a, b) => {
    const na = asNum(a.code), nb = asNum(b.code);
    if (na !== nb) return na - nb;
    return String(a.code).localeCompare(String(b.code));
  });

  console.log(`Parsed ${clean.length} colors`);
  if (clean.length < 450) {
    console.warn("Warning: fewer than expected (≈454). The page structure may have changed.");
  }

  await writeFile("dmc.json", JSON.stringify(clean, null, 2), "utf8");
  console.log("Wrote dmc.json");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
