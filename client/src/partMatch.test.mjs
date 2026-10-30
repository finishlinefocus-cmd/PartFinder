// node --test client/src/partMatch.test.mjs
// Price Search names the PART, not whatever shares its digits (2026-10-29; Shaun Farrell in Nexus: "when
// using the price search it is pulling up completely nothing relates to the part number i put in"). The
// catalogue rows below are the office box's own, read from its distributorCatalog.json that day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partTokens, partWords, wordTokens, parseQuery, codeMatch, rankCatalog, judgeListing, byBestMatch, matchLabel, inMarketLow, normDashes, normPart } from './partMatch.js';

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
  assert.deepEqual(partTokens('a 12'), ['12'], 'two characters with a digit is a part number (it must match exactly)');
  assert.deepEqual(partTokens('Stanley 2 pack'), [], 'one character is not');
  assert.deepEqual(wordTokens('Stanley MC521 motor for the door'), ['stanley', 'motor', 'door']);
});

test('a number inside a longer NUMBER is a different part', () => {
  // Digits running on either side make another number: 20061601, 216010, 16012, 11601, CB13511.
  for (const code of ['20061601', '20081601', '216010', '16010', '16012', '11601']) assert.equal(codeMatch(code, '1601'), 'none', code);
  assert.equal(codeMatch('CB13511', '1351'), 'none');
  assert.equal(codeMatch('31-0945', '0945'), 'none', 'a prefix of digits is a longer number, dash or not');
  assert.equal(codeMatch('10PBS45B', '45B'), 'none', 'a prefix holding digits is not a prefix');
  assert.equal(codeMatch('AMC521', 'MC521'), 'none', 'letters running into a number that starts with letters');
  assert.equal(codeMatch('1351', '1351'), 'exact');
  assert.equal(codeMatch('41A5021-1', '41A50211'), 'exact', 'the dash is not part of the number');
  assert.equal(codeMatch('41A5021-12', '41A50211'), 'none', '41A5021-12 is not 41A5021-1');
  assert.equal(codeMatch('498C-DR', '498C'), 'variant');
  assert.equal(codeMatch('1601-2', '1601'), 'variant', 'a dash then more digits is a variant, not a longer number');
  assert.equal(codeMatch('10LZRMICROSCANHUB', '10LZR'), 'starts');
  assert.equal(codeMatch('1601C', '1601'), 'starts');
});

test('the catalogue answers the part, not the digits', () => {
  // Nothing on file is 1601. The screws (20061601) stay out; KP1601 and D1601 carry the number behind a
  // letter prefix, which no rule can tell from a rebuilt R1601 — so they are listed, last, as "Related".
  assert.deepEqual(rankCatalog(CATALOG, '1601').map(h => [h.item.addisonPart, h.match]), [['KP1601', 'related'], ['D1601', 'related']]);
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
  // Named (those carrying "LiftMaster" too, then by price), then starts-with, then the stranger. "41A5021 1"
  // with a space is the number: the query has a dash at that point (2026-10-29 review).
  assert.deepEqual(order, [4, 2, 5, 3, 1]);
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

// ── The 2026-10-29 review of the ranking (PR #9) ──────────────────────────────────────────────────

test('review 1: R1601, DC-1601, CRL1601 are listed right after the part, labelled — 16012 and 11601 stay out', () => {
  const items = [
    item('C.R. Laurence', 'CRL1601', 'CRL GLASS CLAMP', 40),
    item('Addison Automatics', '16012', 'DORMA ARM', 1),
    item('Addison Automatics', '11601', 'NABCO BELT', 1),
    item('Addison Automatics', 'R1601', 'HORTON MOTOR RBLT#', 210),
    item('Door Controls', 'DC-1601', 'HORTON MOTOR', 250),
    item('Addison Automatics', '1601', 'HORTON MOTOR', 400),
    item('Addison Automatics', '1601-DR', 'HORTON MOTOR DUAL', 500),
    item('C.R. Laurence', '20061601', 'CRL Self-Drilling Screws', 0.05),
  ];
  const hits = rankCatalog(items, '1601');
  assert.deepEqual(hits.map(h => [h.item.addisonPart, h.match]), [
    ['1601', 'part'], ['R1601', 'rebuilt'], ['1601-DR', 'variant'], ['CRL1601', 'related'], ['DC-1601', 'related'],
  ]);
  const label = h => matchLabel(h, ['1601']);
  assert.equal(label(hits[1]), 'Rebuilt 1601', "A&M's R prefix says rebuilt, so the page says it plainly");
  assert.equal(label(hits[3]), 'Related part number');
  assert.equal(codeMatch('R-1601', '1601'), 'rebuilt');
  assert.equal(codeMatch('R1601-DR', '1601'), 'related', 'rebuilt AND a suffix is no longer plainly "rebuilt 1601"');
  // A web listing gets the same treatment.
  assert.equal(judgeListing({ title: 'Horton R1601 rebuilt motor' }, '1601').match, 'rebuilt');
  assert.equal(judgeListing({ title: 'DC-1601 operator' }, '1601').match, 'related');
  assert.equal(judgeListing({ title: 'Part 16012 kit' }, '1601').match, 'none');
});

test('review 1: a rebuilt or prefixed code is listed, but it is not the market low', () => {
  const pns = ['1601'];
  const keep = m => inMarketLow({ match: m }, pns);
  for (const m of ['part', 'exact', 'variant', 'starts']) assert.ok(keep(m), m);
  for (const m of ['rebuilt', 'related', 'none']) assert.ok(!keep(m), m);
  assert.ok(inMarketLow({ match: 'none' }, []), 'a words-only search has no part number to hold listings to');
  assert.ok(inMarketLow({ price: 5 }, pns), 'a row with no match (a server too old to judge) is kept, as before');
});

test('review 2: a part number under 3 characters with a digit is a part number, matched exactly', () => {
  assert.deepEqual(partTokens('E4'), ['E4']);
  assert.deepEqual(partTokens('Horton M5 board'), ['M5']);
  assert.deepEqual(partTokens('10'), ['10']);
  const items = [item('X', 'E4', 'BOARD', 20), item('X', 'E45', 'BOARD', 1), item('X', 'SE4', 'BOARD', 1), item('X', 'E4-1', 'BOARD', 1),
    item('X', 'M5', 'MOTOR', 30), item('X', '10', 'TEN', 3), item('X', '100', 'HUNDRED', 1), item('X', 'Q9', 'FITS E4 UNITS', 2)];
  assert.deepEqual(rankCatalog(items, 'E4').map(h => [h.item.addisonPart, h.match]), [['E4', 'part'], ['Q9', 'exact']], 'never E45, SE4 or even E4-1');
  assert.deepEqual(rankCatalog(items, 'M5').map(h => h.item.addisonPart), ['M5']);
  assert.deepEqual(rankCatalog(items, '10').map(h => h.item.addisonPart), ['10']);
  assert.equal(judgeListing({ title: 'LiftMaster E4 logic board' }, 'E4').match, 'exact');
  assert.equal(judgeListing({ title: 'E45 board' }, 'E4').match, 'none');
});

test('review 3: a number written with a Unicode dash, or a space where the query has a dash, is the same number', () => {
  const q = '41A5021-1';
  for (const dash of ['–', '‐', '‑', '−', '—', '－']) {
    const r = { title: `LiftMaster 41A5021${dash}1 logic board`, price: 50 };
    const j = judgeListing(r, q);
    assert.equal(j.match, 'exact', 'U+' + dash.codePointAt(0).toString(16));
    assert.ok(inMarketLow({ ...r, ...j }, [q]), 'so it counts toward the market low');
  }
  assert.equal(normDashes('41A5021­1'), '41A50211', 'a soft hyphen is not a separator');
  assert.deepEqual(partWords('41A5021–1'), ['41A5021-1'], 'the page says the number with a plain dash');
  assert.deepEqual(partTokens('41A5021–1'), ['41A50211']);
  // A space only counts where the QUERY had a separator.
  assert.equal(judgeListing({ title: 'LiftMaster 41A5021 1 board' }, '41A5021-1').match, 'exact');
  assert.equal(judgeListing({ title: 'LiftMaster 41A5021 - 1 board' }, '41A5021-1').match, 'exact');
  assert.equal(judgeListing({ title: 'LiftMaster 41A5021 1 board' }, '41A50211').match, 'none', 'no dash typed, so "41A5021 1" is two codes');
  assert.equal(judgeListing({ title: 'LiftMaster 41A5021 12 board' }, '41A5021-1').match, 'none', '41A5021-12 is another number');
  assert.equal(judgeListing({ title: 'Chamberlain 41A5021–1H board' }, '41A5021-1').match, 'starts');
  // The catalogue reads the same way.
  const items = [item('X', 'LB-1', 'LIFTMASTER 41A5021 1 LOGIC BOARD', 80), item('X', 'LB-2', 'LIFTMASTER 41A5021–1 LOGIC BOARD', 90)];
  assert.deepEqual(rankCatalog(items, q).map(h => [h.item.addisonPart, h.match]), [['LB-1', 'exact'], ['LB-2', 'exact']]);
});

test('review 4: a specification is a word, not a part number — and "24V" matches "24 VOLT"', () => {
  const specs = { '24V': '24v', '24VAC': '24v', '12VDC': '12v', '110V': '110v', '3/4"': '3/4in', '10FT': '10ft', '433MHZ': '433mhz', '12/24V': '12/24v', '1-1/4': '1-1/4', '3/4': '3/4' };
  for (const [typed, word] of Object.entries(specs)) {
    assert.deepEqual(partTokens(typed), [], typed + ' is not a part number');
    assert.deepEqual(wordTokens(typed), [word], typed);
  }
  assert.deepEqual(wordTokens('24 volt power supply'), ['24v', 'power', 'supply'], 'a spec typed with a space');
  assert.deepEqual(wordTokens('24 VAC/DC'), ['24v']);
  // Part numbers that only look like specs stay part numbers: the catalogue holds 1388A, 272W, 61M, 1609LB, 537082-4FT.
  for (const pn of ['1388A', '272W', '61M', '1609LB', '537082-4FT', '50010130K', '10LZR']) assert.deepEqual(partTokens(pn), [normPart(pn)], pn);
  const items = [
    item('X', 'PS24', '24 VOLT POWER SUPPLY', 60), item('X', 'PS12', '12 VOLT POWER SUPPLY', 40), item('X', 'PS124', '124V POWER SUPPLY', 1),
    item('X', '6062', '12/24 VDC POWER SUPPLY TIMER', 70),
    item('BEA', '24VAC', '24 VAC TRANSFORMER', 30), item('BEA', '12VAC', '12VAC TRANSFORMER', 30),
    item('X', 'BS34', '3/4" BRUSH SEAL', 9), item('X', 'BS14', '1/4" BRUSH SEAL', 8),
  ];
  assert.deepEqual(rankCatalog(items, '24V power supply').map(h => h.item.addisonPart), ['PS24', '6062'], '24 VOLT and 12/24 VDC, never 12 VOLT or 124V');
  assert.deepEqual(rankCatalog(items, '24 volt power supply').map(h => h.item.addisonPart), ['PS24', '6062']);
  assert.deepEqual(rankCatalog(items, '3/4" brush seal').map(h => h.item.addisonPart), ['BS34']);
  // A spec that is also a part's own number (BEA's 24VAC transformer) still leads its own search.
  const tx = rankCatalog(items, '24VAC');
  assert.deepEqual(tx[0] && [tx[0].item.addisonPart, tx[0].match], ['24VAC', 'part']);
  assert.ok(!tx.some(h => h.item.addisonPart === '12VAC'));
  // On the web: a spec never folds a listing away, because it is not a part number.
  const r = judgeListing({ title: '24 Volt Power Supply for gate operators' }, '24V power supply');
  assert.deepEqual([r.match, r.words], ['words', 3]);
});

test('kept: case, ASCII dashes, "#1601", "1601/1602", and one part number among words', () => {
  assert.equal(judgeListing({ title: 'horton 41a5021-1 board' }, '41A5021-1').match, 'exact', 'case never decides');
  assert.equal(judgeListing({ title: 'LiftMaster 41A50211 board' }, '41A5021-1').match, 'exact', 'nor does the dash');
  assert.deepEqual(partTokens('#1601'), ['1601']);
  assert.equal(judgeListing({ title: 'Horton #1601 motor' }, '1601').match, 'exact');
  assert.equal(judgeListing({ title: 'Horton 1601/1602 motor' }, '1601').match, 'variant');
  assert.equal(judgeListing({ title: 'Horton 1601.5 motor' }, '1601').match, 'variant');
  assert.deepEqual(parseQuery('Stanley 24V MC521 motor').parts.map(p => p.typed), ['MC521']);
  assert.deepEqual(wordTokens('Stanley 24V MC521 motor'), ['stanley', '24v', 'motor']);
});

test('kept: an old server and a new page — rows with no match or rank fall back to price, none folded', () => {
  // A server from before the ranking sends neither rank nor match nor partNumbers.
  const rows = [{ id: 'a', price: 30 }, { id: 'b', price: 0 }, { id: 'c', price: 10 }];
  assert.deepEqual([...rows].sort(byBestMatch).map(r => r.id), ['c', 'a', 'b'], 'cheapest first, unpriced last');
  assert.ok(rows.every(r => inMarketLow(r, [])));
  assert.equal(matchLabel(rows[0], []), '');
});

test('the compare rail reads only listings of the same number', () => {
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const app = strip(readFileSync(new URL('./App.jsx', import.meta.url), 'utf8'));
  const rail = app.slice(app.indexOf('<CompareRail'), app.indexOf('/>', app.indexOf('<CompareRail')));
  assert.ok(rail.includes('inMarketLow(r, searchMeta.partNumbers)'), 'the rail filters with inMarketLow');
});
