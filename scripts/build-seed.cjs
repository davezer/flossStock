#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('▶ build-seed starting…');

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('❌ Usage: node scripts/build-seed.cjs <path-to-colors.json>');
  process.exit(1);
}

// Resolve paths relative to the project root (your current folder)
const projectRoot = process.cwd();
const inputAbs = path.isAbsolute(INPUT) ? INPUT : path.join(projectRoot, INPUT);
const outDir = path.join(projectRoot, 'db');
const outFile = path.join(outDir, 'seed.sql');

console.log('• cwd:', projectRoot);
console.log('• input:', inputAbs);
console.log('• outDir:', outDir);
console.log('• outFile:', outFile);

// Ensure db/ exists
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Read the JSON
let rows;
try {
  const json = fs.readFileSync(inputAbs, 'utf8');
  rows = JSON.parse(json);
} catch (e) {
  console.error('❌ Failed to read/parse JSON:', e.message);
  process.exit(1);
}
if (!Array.isArray(rows)) {
  console.error('❌ colors.json must be an array of objects');
  process.exit(1);
}
console.log('• colors loaded:', rows.length);

// One default brand/line
const brandId = 'generic';
const lineId = 'generic:default';
const esc = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const chunks = [];
const push = (s) => chunks.push(s);

push('-- Seed for brand/line/colors\n');
push('BEGIN TRANSACTION;\n');
push(`INSERT OR IGNORE INTO brand (id, slug, name) VALUES (${esc(brandId)}, 'generic', 'Generic');\n`);
push(`INSERT OR IGNORE INTO line (id, brand_id, slug, name) VALUES (${esc(lineId)}, ${esc(brandId)}, 'default', 'Default');\n`);
push('COMMIT;\n\n');

const BATCH = 800;
for (let i = 0; i < rows.length; i += BATCH) {
  push('BEGIN TRANSACTION;\n');
  for (const r of rows.slice(i, i + BATCH)) {
    const code = String(r.code ?? '').trim();
    if (!code) continue;
    const id = `${lineId}:${code}`;
    const full_code = code;
    push(
      `INSERT OR IGNORE INTO color (id, line_id, code, full_code, name, hex, status) VALUES (` +
        [
          esc(id),
          esc(lineId),
          esc(code),
          esc(full_code),
          esc(r.name ?? null),
          esc(r.hex ?? null),
          'NULL'
        ].join(', ') +
      `);\n`
    );
  }
  push('COMMIT;\n\n');
}

fs.writeFileSync(outFile, chunks.join(''), 'utf8');
console.log('✅ wrote', outFile);
