#!/usr/bin/env node
// Push normalized vendor price lists into the running PartFinder API.
//
//   node scripts/price-lists/import.mjs              # every vendor in price-lists/normalized/manifest.json
//   node scripts/price-lists/import.mjs bea xcluder  # just these
//   DRY=1 node scripts/price-lists/import.mjs        # show what would be sent, send nothing
//
// Run `python3 scripts/price-lists/normalize.py` first. Each CSV goes through the same
// POST /api/distributors/:id/import the Price Lists tab uses, so the change report
// (added / price up / price down / discontinued) and priceHistory are recorded exactly
// as if the file had been uploaded by hand. Vendors whose list carries no MSRP get
// priceMode=net so their headline price is our cost instead of blank.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = resolve(root, 'price-lists', 'normalized', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('No price-lists/normalized/manifest.json — run: python3 scripts/price-lists/normalize.py');
  process.exit(1);
}

// Same port resolution as server.js (.env PORT, else 4810).
let port = process.env.PORT;
if (!port && existsSync(resolve(root, '.env'))) {
  const m = readFileSync(resolve(root, '.env'), 'utf-8').match(/^PORT=(\d+)/m);
  if (m) port = m[1];
}
const base = process.env.PARTFINDER_URL || `http://localhost:${port || 4810}`;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const wanted = process.argv.slice(2);
const vendors = Object.entries(manifest.vendors).filter(([id, v]) => !v.error && (!wanted.length || wanted.includes(id)));
const dry = !!process.env.DRY;

let failures = 0;
for (const [id, meta] of vendors) {
  const csv = readFileSync(resolve(root, meta.file), 'utf-8');
  const priceMode = meta.withList > 0 ? 'list' : 'net';
  process.stdout.write(`${id.padEnd(15)} ${String(meta.parts).padStart(5)} parts  mode=${priceMode}  ${meta.effective || ''} … `);
  if (dry) { console.log('(dry run)'); continue; }
  try {
    const res = await fetch(`${base}/api/distributors/${id}/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv, priceMode }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { failures++; console.log(`✗ ${res.status} ${body.error || ''}`); continue; }
    const changes = body.changes || {}; const c = changes;
    console.log(`✓ +${c.added ?? 0} new · ↑${c.priceUp ?? 0} · ↓${c.priceDown ?? 0} · =${c.unchanged ?? 0} · gone ${c.discontinued ?? 0}`
      + (body.warnings?.length ? `  ⚠ ${body.warnings.length} warning(s)` : ''));
    for (const w of changes.formatWarnings || body.formatWarnings || []) console.log(`    ⚠ ${w.msg || JSON.stringify(w)}`);
    const map = body.mapping || {};
    console.log(`    mapped: ${Object.entries(map).map(([f, h]) => `${f}←${typeof h === "object" ? h?.header ?? JSON.stringify(h) : h}`).join(", ")}`);
  } catch (e) {
    failures++;
    console.log(`✗ ${e.message} (is the API running on ${base}?)`);
  }
}
for (const [id, why] of Object.entries(manifest.skipped || {})) console.log(`– skipped ${id}: ${why}`);
process.exit(failures ? 1 : 0);
