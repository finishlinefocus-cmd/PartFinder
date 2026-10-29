// node --test client/src/partMatch.test.mjs
// Price Search names the PART, not whatever shares its digits (2026-10-29; Shaun Farrell in Nexus: "when
// using the price search it is pulling up completely nothing relates to the part number i put in"). The
// catalogue rows below are the office box's own, read from its distributorCatalog.json that day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partTokens, partWords, wordTokens, codeMatch, rankCatalog, judgeListing, byBestMatch, matchLabel } from './partMatch.js';

const item = (distributor, part, description, price) => ({ distributor, category: distributor, addisonPart: part, manufacturerPart: part, description, price, id: part });
// What "1601" and "1351" found on the box: strangers that only CONTAIN the digits.
const CATALOG = [
  item('C.R. Laurence', '20061601', 'CRL 6-20 x 1/2" Pan Head Phillips Self-Drilling Screws', 0.05),
  item('C.R. Laurence', '20081601', 'CRL 8-18 x 1/2" Pan Head Phillips Self-Drilling Screws', 0.06),
  item('C.R. Laurence', 'KP1601', 'CRL Glossy Black KRYLON® Spray Paint', 25.99),
  item('C.R. Laurence', 'D1601', 'CRL 1-1/4" Steel Sliding Glass Door Roller with 21', 26.99),
  item('C.R. Laurence', 'CB13511', 'CRL Clear Anodized 135º Corner Division Bar with V', 170.6),
  item('Addison Automatics', '1351', 'DORMA ED400 CONTROL RBLT#', 348),
  item('Addison Automatics', '498C', 'STANLEY DURA N/S GBXMTR W/REV COUNTER RBLT#', 476.8),
  item('Addison Automatics', '498C-DR', 'STANLEY DURA MTRGEABX W/DUAL OUTPUT REV', 476.8),
  item('Addison Automatics', '1339', 'STANLEY MC521 RESISTOR FOR BODYGUARD', 10.4),
  item('BEA', '10LZRMICROSCANHUB', 'REPLACEMENT HUB UNIT "ONLY"', 149.38),
];

// The search as it was, kept here as the control.
function oldCatalogSearch(items, q) {
  const needle = q.trim().toLowerCase();
  return items.filter(it => [it.distributor, it.category, it.addisonPart, it.manufacturerPart, it.description].some(v => String(v || '').toLowerCase().includes(needle)))
    .slice(0, 50).sort((a, b) => a.price - b.price);
}

test('the control: the old search led "1601" with a 5-cent screw and found nothing that is 1601', () => {
  const old = oldCatalogSearch(CATALOG, '1601');
  assert.equal(old.length, 4);
  assert.equal(old[0].addisonPart, '20061601');
  assert.ok(old.every(it => it.addisonPart !== '1601'));
  assert.equal(oldCatalogSearch(CATALOG, '1351')[0].addisonPart, 'CB13511', 'the corner bar led "1351"');
});

test('a part number is a word with a digit in it; punctuation and case never decide', () => {
  assert.deepEqual(partTokens('1601'), ['1601']);
  assert.deepEqual(partTokens('Horton motor 1601'), ['1601']);
  assert.deepEqual(partTokens('41a5021-1'), ['41A50211']);
  assert.deepEqual(partWords('  41A5021-1, R313443 '), ['41A5021-1', 'R313443']);
  assert.deepEqual(partTokens('LiftMaster circuit board'), []);
  assert.deepEqual(partTokens('a 12'), [], 'two characters is not a part number');
  assert.deepEqual(wordTokens('Stanley MC521 motor for the door'), ['stanley', 'motor', 'door']);
});

test('a number inside a longer code is a different part', () => {
  for (const code of ['20061601', 'KP1601', 'D1601', '216010']) assert.equal(codeMatch(code, '1601'), 'none', code);
  assert.equal(codeMatch('CB13511', '1351'), 'none');
  assert.equal(codeMatch('1351', '1351'), 'exact');
  assert.equal(codeMatch('41A5021-1', '41A50211'), 'exact', 'the dash is not part of the number');
  assert.equal(codeMatch('498C-DR', '498C'), 'variant');
  assert.equal(codeMatch('10LZRMICROSCANHUB', '10LZR'), 'starts');
  assert.equal(codeMatch('16010', '1601'), 'starts');
});

test('the catalogue answers the part, not the digits', () => {
  assert.deepEqual(rankCatalog(CATALOG, '1601').map(h => h.item.addisonPart), [], 'nothing on file is 1601 — no strangers instead');
  assert.deepEqual(rankCatalog(CATALOG, '1351').map(h => h.item.addisonPart), ['1351']);
  assert.deepEqual(rankCatalog(CATALOG, '498C').map(h => [h.item.addisonPart, h.match]), [['498C', 'part'], ['498C-DR', 'variant']]);
  assert.deepEqual(rankCatalog(CATALOG, 'MC521').map(h => [h.item.addisonPart, h.match]), [['1339', 'exact']], 'a number named in a description counts');
  assert.deepEqual(rankCatalog(CATALOG, '10LZR').map(h => h.match), ['starts']);
});

test('ranked BEFORE it is cut: the exact part survives however many descriptions name the number', () => {
  const many = Array.from({ length: 80 }, (_, i) => item('C.R. Laurence', 'X' + i, 'FITS MC521 BOARD ' + i, 1 + i));
  const items = [...many, item('Addison Automatics', 'MC521', 'STANLEY MC521 CONTROL BOARD', 900)];
  const top = rankCatalog(items, 'MC521', 50);
  assert.equal(top.length, 50);
  assert.equal(top[0].item.addisonPart, 'MC521', 'the $900 part itself leads, not the $1 parts that only name it');
  assert.equal(top[0].match, 'part');
});

test('words find parts when no number was typed, and every word must be there', () => {
  const hits = rankCatalog(CATALOG, 'stanley dura').map(h => h.item.addisonPart);
  assert.deepEqual(hits.sort(), ['498C', '498C-DR']);
  assert.deepEqual(rankCatalog(CATALOG, 'stanley paint'), []);
});

test('web listings are judged on their title; best match first, price only within a match', () => {
  const q = 'LiftMaster 41A5021-1';
  const rows = [
    { id: 1, title: 'Universal Garage Door Remote 3-Button', source: 'Walmart', price: 4.99 },
    { id: 2, title: 'LiftMaster 41A5021-1 Logic Board', source: 'eBay', price: 89 },
    { id: 3, title: 'Chamberlain 41A5021-1H Receiver Board', source: 'Amazon', price: 75 },
    { id: 4, title: 'LiftMaster 41A5021 1 board', source: 'Amazon', price: 60 },
    { id: 5, title: '41A5021-1 logic board', source: 'Repair Shop', price: 120 },
  ].map(r => ({ ...r, ...judgeListing(r, q) }));
  const order = [...rows].sort(byBestMatch).map(r => r.id);
  // Named (the one carrying "LiftMaster" too, then by price), then starts-with, then the strangers —
  // "41A5021 1" split by a space is not the number, and carries "LiftMaster", so it leads the strangers.
  assert.deepEqual(order, [2, 5, 3, 4, 1]);
  assert.equal(rows.find(r => r.id === 1).match, 'none');
  assert.equal(matchLabel(rows.find(r => r.id === 1), partWords(q)), 'Does not mention 41A5021-1');
  assert.equal(matchLabel(rows.find(r => r.id === 2), partWords(q)), 'Names 41A5021-1');
  const cat = { title: 'DORMA ED400 CONTROL RBLT#', catalog: { addisonPart: '1351', description: 'DORMA ED400 CONTROL RBLT#' }, price: 348 };
  assert.equal(matchLabel({ ...cat, ...judgeListing(cat, '1351') }, ['1351']), 'Exact part #', 'a catalogue row whose own number it is');
});

test('an unpriced listing comes last within its match, never first', () => {
  const rows = [{ rank: 3, price: 0 }, { rank: 3, price: 40 }, { rank: 0, price: 1 }].sort(byBestMatch);
  assert.deepEqual(rows.map(r => r.price), [40, 0, 1]);
});

test('the API and the page use these rules', () => {
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const server = strip(readFileSync(new URL('../../server.js', import.meta.url), 'utf8'));
  const route = server.slice(server.indexOf("app.get('/api/search'"), server.indexOf('const partfinderServer'));
  assert.ok(route.includes('rankCatalog('), '/api/search ranks the catalogue');
  assert.ok(!route.includes('filterCatalogItems('), '/api/search no longer takes the first 50 substring hits');
  assert.ok(route.includes('results.sort(byBestMatch)'), '/api/search sorts best match first');
  assert.ok(!/results\.sort\(\(a, b\) => a\.price - b\.price\)/.test(route), 'not by price alone');
  const app = strip(readFileSync(new URL('./App.jsx', import.meta.url), 'utf8'));
  assert.ok(app.includes("useState('best')"), 'the page opens on Best match');
  assert.ok(app.includes("r.match === 'none'"), 'the page folds listings that do not mention the number');
});
