#!/usr/bin/env node
/**
 * Build db/seed.sql from colors.csv or colors.json
 * Usage:
 *   node scripts/build-seed.js data/colors.json
 *   node scripts/build-seed.js data/colors.csv
 */

const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('Usage: node scripts/build-seed.js <path-to-colors.(json|csv)>');
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), 'db');
const OUT_FILE = path.join(OUT_DIR, 'seed.sql');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/** --- helpers --- */
const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

const brandCode = (brand) => String(brand || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BRAND';

const sqlEscape = (v) => {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v);
  // Escape single quotes by doubling them; keep NULL literal unquoted
  return `'${s.replaceAll("'", "''")}'`;
};

const uniquePush = (map, key, value) => {
  if (!map.has(key)) map.set(key, value);
};

const parseCSV = (text) => {
  // Very simple CSV parser (handles commas in fields if quoted with ")
  // Assumes first line is headers.
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ''));
    rows.push(obj);
  }
  return rows;
};

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  // Unquote/trim
  return out.map((s) => s.replace(/^"(.*)"$/, '$1'));
}

/** --- load input --- */
let rows;
const ext = path.extname(INPUT).toLowerCase();
if (ext === '.json') {
  rows = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  if (!Array.isArray(rows)) {
    console.error('JSON must be an array of color objects.');
    process.exit(1);
  }
} else if (ext === '.csv') {
  const txt = fs.readFileSync(INPUT, 'utf8');
  rows = parseCSV(txt);
} else {
  console.error('Unsupported file type. Use .json or .csv');
  process.exit(1);
}

/** --- normalize --- */
const brands = new Map(); // key: brandSlug
const lines = new Map();  // key: `${brandSlug}:${lineSlug}`
const colors = [];        // array of { ... }

for (const r of rows) {
  const brand = r.brand ?? r.Brand ?? r.BRAND;
  const line = r.line ?? r.Line ?? r.LINE ?? '';
  const code = String(r.code ?? r.Code ?? r.CODE ?? '').trim();
  const name = r.name ?? r.Name ?? r.NAME ?? null;
  const hex = r.hex ?? r.Hex ?? r.HEX ?? null;
  const status = r.status ?? r.Status ?? r.STATUS ?? null;

  if (!brand || !code) continue; // skip incomplete

  const bSlug = slug(brand);
  const lSlug = slug(line || 'default');
  const bId = bSlug; // stable readable id
  const lId = `${bSlug}:${lSlug}`;
  const brand_code_prefix = brandCode(brand);
  const full_code = `${brand_code_prefix}-${code}`;

  uniquePush(brands, bSlug, {
    id: bId,
    slug: bSlug,
    name: String(brand).trim()
  });

  uniquePush(lines, `${bSlug}:${lSlug}`, {
    id: lId,
    brand_id: bId,
    slug: lSlug,
    name: line ? String(line).trim() : 'Default'
  });

  colors.push({
    id: `${lId}:${code}`,
    line_id: lId,
    code,
    full_code,
    name: name ? String(name).trim() : null,
    hex: hex ? String(hex).trim() : null,
    status: status ? String(status).trim() : null
  });
}

/** --- build SQL --- */
const chunks = [];
const push = (sql) => chunks.push(sql);

// Ensure foreign keys exist before children
push('-- === Brands ===\nBEGIN TRANSACTION;\n');
for (const b of brands.values()) {
  push(
    `INSERT OR IGNORE INTO brand (id, slug, name) VALUES (${sqlEscape(b.id)}, ${sqlEscape(
      b.slug
    )}, ${sqlEscape(b.name)});\n`
  );
}
push('COMMIT;\n\n');

push('-- === Lines ===\nBEGIN TRANSACTION;\n');
for (const l of lines.values()) {
  push(
    `INSERT OR IGNORE INTO line (id, brand_id, slug, name) VALUES (${sqlEscape(l.id)}, ${sqlEscape(
      l.brand_id
    )}, ${sqlEscape(l.slug)}, ${sqlEscape(l.name)});\n`
  );
}
push('COMMIT;\n\n');

push('-- === Colors ===\n');
const BATCH = 800; // keep batches modest for D1
for (let i = 0; i < colors.length; i += BATCH) {
  push('BEGIN TRANSACTION;\n');
  for (const c of colors.slice(i, i + BATCH)) {
    push(
      `INSERT OR IGNORE INTO color (id, line_id, code, full_code, name, hex, status) VALUES (` +
        [
          sqlEscape(c.id),
          sqlEscape(c.line_id),
          sqlEscape(c.code),
          sqlEscape(c.full_code),
          sqlEscape(c.name),
          sqlEscape(c.hex),
          sqlEscape(c.status)
        ].join(', ') +
        `);\n`
    );
  }
  push('COMMIT;\n\n');
}

// write file
fs.writeFileSync(OUT_FILE, chunks.join(''), 'utf8');

console.log(`Wrote ${OUT_FILE}`);
console.log(
  `Brands: ${brands.size} | Lines: ${lines.size} | Colors: ${colors.length}`
);
