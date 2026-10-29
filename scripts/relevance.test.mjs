/**
 * SEARCH RELEVANCE GUARD — `npm run test:relevance`
 *
 * Shaun Farrell, 2026-10-29: "when using the price search it is pulling up completely nothing
 * relates to the part number i put in."
 *
 * The cause and the rules are written up in ../relevance.js. This holds them to the real part
 * numbers this office searches for, and FAILS on the old four-digit rule — the point of it is that
 * a guard which does not run is indistinguishable from no guard at all, and nothing said so.
 *
 * No server, no API key, no network: these are pure functions.
 */
import { partTokens, mentionsPart, isWebSource, byPrice, normalize } from '../relevance.js';

let pass = 0;
const failures = [];
const ok = (name, cond) => { if (cond) pass++; else failures.push(`✗ ${name}`); };

/* ── 1. What the office actually searches for is recognised as a part number ── */
// Every one of these returned NO token under the old /\d{4,}/ rule, so no guard ran.
for (const q of ['Q250-14', '498C', '255', '491', '572', 'SM32', 'SEC2-KIT-9W7T', '1503-2', '411624-GR', '314263']) {
  ok(`"${q}" is read as a part number`, partTokens(q).length > 0);
}
ok('the brand word is dropped, the number kept', JSON.stringify(partTokens('stanley 314263')) === JSON.stringify(['314263']));
ok('Dor-O-Matic 1503-2 → one token', JSON.stringify(partTokens('Dor-O-Matic 1503-2')) === JSON.stringify(['15032']));
ok('a repeated token is listed once', partTokens('1503 1503').length === 1);

/* ── 2. A query with no part number is left UNGUARDED, exactly as before ────── */
// This is the half that must not get greedy: start filtering on a bare word and the only results
// that pass are the brand-word matches the guard exists to remove.
for (const q of ['door closer', 'weather stripping', 'stanley', '', '   ', 'felt']) {
  ok(`"${q}" filters nothing`, partTokens(q).length === 0);
}
ok('a digit core under three characters is not a part number', partTokens('ADA 12').length === 0);
ok('…nor is a bare "2"', partTokens('2').length === 0);

/* ── 3. The match is lenient about punctuation and strict about the part ───── */
const t = partTokens('Q250-14');
ok('the part number as printed', mentionsPart(t, 'QuikServ Q250-14 drive-thru window'));
ok('spaced', mentionsPart(t, 'Q250 14 window'));
ok('extra hyphens', mentionsPart(t, 'Q-250-14'));
ok('prefix dropped by the seller', mentionsPart(t, 'Replacement 250-14 glass'));
ok('found in the link when the title does not say it', mentionsPart(t, 'Drive-thru window https://x.com/p/q250-14'));
ok('Stanley cups do not pass', !mentionsPart(partTokens('stanley 314263'), 'Stanley 40 oz Quencher Tumbler 2024'));
ok('an unrelated priced page does not pass', !mentionsPart(t, 'Cheap gadget $2.50 free shipping'));
ok('a different part does not pass', !mentionsPart(partTokens('1503-2'), 'Dor-O-Matic 1603-1 arm'));

/* ── 4. Only a web result is guessed at ────────────────────────────────────── */
ok('apify is a web source', isWebSource({ via: 'apify' }));
ok('serpapi is a web source', isWebSource({ via: 'serpapi' }));
ok('a catalog row is not', !isWebSource({ via: 'catalog' }));
ok('a BigQuery row is not', !isWebSource({ via: 'bigquery' }));
ok('a row with no via is not', !isWebSource({}) && !isWebSource(null));

/* ── 5. Cheapest first, and an UNKNOWN price is not $0 ─────────────────────── */
// Both the catalog rows and the web sources hand back 0 for a price nobody stated, and the old
// comparator put all of them above every real offer — so a price search could open on rows with no
// price in them, which is its own version of "nothing here relates to what I asked for".
{
  const rows = [{ id: 'n', price: 0 }, { id: 'b', price: 42 }, { id: 'a', price: 9.5 }, { id: 'm', price: null }];
  const order = [...rows].sort(byPrice).map(r => r.id);
  ok('priced rows come first, cheapest first', JSON.stringify(order.slice(0, 2)) === JSON.stringify(['a', 'b']));
  ok('unpriced rows go last', order.slice(2).sort().join() === 'm,n');
  ok('two unpriced rows keep their order', JSON.stringify([{ id: 'x', price: 0 }, { id: 'y', price: 0 }].sort(byPrice).map(r => r.id)) === JSON.stringify(['x', 'y']));
}

/* ── 6. normalize is one rule ──────────────────────────────────────────────── */
ok('normalize drops punctuation and case', normalize(' Q250-14 ') === 'q25014');
ok('normalize survives null', normalize(null) === '' && normalize(undefined) === '');

/* ── 7. The old rule would fail this file ──────────────────────────────────── */
// Written out so the regression is named rather than only counted: these are the queries that
// produced Shaun's report, and the old tokenizer found nothing in any of them.
{
  const oldTokens = (q) => (String(q).match(/[A-Za-z0-9-]*\d{4,}[A-Za-z0-9-]*/g) || [])
    .map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((x) => x.length >= 4);
  const unguardedBefore = ['Q250-14', '498C', '255', '491', '572', 'SM32', 'SEC2-KIT-9W7T'];
  ok('the old four-digit rule guarded none of the reported queries',
    unguardedBefore.every((q) => oldTokens(q).length === 0));
  ok('…and the new rule guards all of them',
    unguardedBefore.every((q) => partTokens(q).length > 0));
}

if (failures.length) {
  console.error(`\nSEARCH RELEVANCE GUARD FAILED — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`✓ search relevance guard: ${pass} checks passed (a part number is recognised however it is punctuated, a query with no part number filters nothing, and an unknown price is not $0)`);
