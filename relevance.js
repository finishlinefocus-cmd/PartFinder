/**
 * SEARCH RELEVANCE — what counts as "this is the part I asked for".
 *
 * Shaun Farrell, 2026-10-29: "when using the price search it is pulling up completely nothing
 * relates to the part number i put in."
 *
 * There WAS a guard in /api/search, and it was right about the problem: Google and Apify happily
 * match the brand word alone and bury the real part under Stanley cups. It was wrong about when to
 * run. It only recognised a part number when the query carried a run of FOUR OR MORE DIGITS:
 *
 *     a token match on [A-Za-z0-9-] runs around \d{4,}
 *
 * Most of what this office searches for is not shaped like that. Measured against real A&M part
 * numbers, the old rule found NO part token at all — so no guard ran and every web result passed —
 * for Q250-14, 498C, 1503 variants with short cores, 255, 491, 572, SM32, LZR-MICROSCAN and
 * SEC2-KIT-9W7T. That is the whole report: a search for Q250-14 was unfiltered, and because the
 * results are sorted by price ascending, the cheapest unrelated thing on the internet came first.
 *
 * Two rules, kept apart from server.js so they can be tested without a server, an API key or a
 * network: what in the query identifies a part, and whether a result mentions it.
 */

/** Letters and digits only, lower case — "Q250-14" and "q250 14" are one string. */
export const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** Digits only — the part of a part number that survives however a site punctuates it. */
const digitsOf = (s) => String(s || '').replace(/\D/g, '');

/** Three characters is the floor for identifying anything: "2" or "12" matches every page with a
 *  price, a date or a quantity on it, and "ADA 12" is a standard, not a part. */
const MIN_TOKEN = 3;
/** The same floor applied to the digits-only match below, for the same reason. */
const MIN_DIGIT_CORE = 3;

/**
 * The tokens in a query that look like a part number rather than a word: a word carrying at least
 * one digit, at least MIN_TOKEN characters once punctuation is dropped. "255", "SM32", "Q250-14"
 * and "SEC2-KIT-9W7T" all qualify; "12" and "2" do not.
 *
 * A word with no digits is never a part token — a bare "stanley" or "closer" must not start
 * filtering, because then the one thing the guard is for (brand-word-only matches) becomes the
 * only thing that passes. A query with no part token is unguarded, exactly as before.
 */
export function partTokens(q) {
  const out = [];
  for (const word of String(q || '').split(/[\s,;/]+/)) {
    const n = normalize(word);
    if (!n || n.length < MIN_TOKEN || !/\d/.test(n)) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Does this result mention one of the query's part tokens?
 *
 * Checked two ways, because a part number is punctuated differently everywhere it is printed and
 * the brittle half of the old rule was requiring one spelling. "Q250-14" is the token q25014:
 *   · the whole token against the letters-and-digits haystack — catches "Q250-14", "Q250 14", "q-250-14";
 *   · its DIGITS against the haystack's digits — catches a page that drops the prefix and lists
 *     "250-14", which is the same part.
 * Lenient on purpose. Dropping a real hit is the worse mistake of the two: noise is visible and a
 * person can scroll past it, while a part that was there and got filtered out looks like we do not
 * carry it.
 */
export function mentionsPart(tokens, haystack) {
  const n = normalize(haystack);
  const d = digitsOf(haystack);
  return tokens.some((t) => {
    if (n.includes(t)) return true;
    const td = digitsOf(t);
    return td.length >= MIN_DIGIT_CORE && d.includes(td);
  });
}

/** Only a result fetched off the open web is guessing; catalog and BigQuery rows matched upstream. */
export const isWebSource = (r) => r?.via === 'apify' || r?.via === 'serpapi';

/**
 * Cheapest first — but an UNKNOWN price is not $0.
 *
 * Both the catalog rows (`Number(item.price) || 0`) and the web sources hand back 0 for a price
 * nobody stated, and `(a, b) => a.price - b.price` put every one of them above the real offers. So
 * the top of a price search could be rows with no price in them at all, which reads as "nothing
 * here relates to what I asked for" even when the priced rows below are right. A row with a price
 * sorts by it; a row without one keeps its place and goes after them all.
 */
export function byPrice(a, b) {
  const pa = Number(a?.price) > 0 ? Number(a.price) : null;
  const pb = Number(b?.price) > 0 ? Number(b.price) : null;
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return pa - pb;
}
