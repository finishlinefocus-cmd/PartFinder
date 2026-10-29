// Does a listing match the PART that was searched? (2026-10-29, Shaun Farrell in Nexus: "when using the
// price search it is pulling up completely nothing relates to the part number i put in.")
//
// Pure: no React, no fetch, so the API (server.js) and the page (App.jsx) read the same rules and
// `node --test client/src/partMatch.test.mjs` runs them.
//
// What was wrong, measured against the office box's own catalogue (23,625 parts) on 2026-10-29:
//  - The catalogue was searched as ONE substring. "1601" matched 18 parts and every one was a stranger
//    that merely CONTAINED the digits — C.R. Laurence 20061601 (a 5-cent self-drilling screw), KP1601
//    (spray paint), D1601 (a glass-door roller). "1351" put CRL's CB13511 corner bar above Addison's 1351.
//  - Only the first 50 hits in FILE order were kept, before anything was ranked, so a number that occurs
//    in many descriptions could push the real part off the list entirely.
//  - Everything — catalogue hits and Google Shopping's guesses — was then sorted by PRICE alone, so the
//    cheapest stranger led the page: the 5-cent screw above everything for "1601".
//
// The rules now:
//  - A part number is a word of the query with a digit in it, 3+ characters once punctuation is ignored
//    ("41A5021-1", "R313443", "1601", "10LZR"). Case, dashes, dots and slashes never decide a match.
//  - A catalogue part whose OWN part number is the number is the part (498C on Addison's 498C). A listing
//    NAMES the part when the number stands as its own code in the title or description ("41A5021-1" in a
//    Google title, "STANLEY MC521 RESISTOR") — named, but maybe only something that fits it. A number
//    inside a longer one is a different part: 20061601, KP1601 and CB13511 are not 1601 or 1351. A code that
//    STARTS with the number and carries a suffix after a dash (498C-DR) is a VARIANT; one that runs straight
//    on (10LZRMICROSCANHUB, 16010) only STARTS with it.
//  - Rank: the part, then named, then variant, then starts-with, then the rest — and price only orders
//    listings of the same rank. Words in the query ("Stanley", "motor") break ties; they never hide a match.
//  - A listing that never mentions the number is not deleted — the page says it does not mention it and
//    folds it away, because a search engine's guess is not the part.

export const RANK = { part: 4, exact: 3, variant: 2, starts: 1, none: 0 };
const STOP = new Set(['and', 'the', 'for', 'with', 'of', 'a', 'an', 'to', 'in', 'on', 'or', 'part', 'parts', 'new', 'used', 'any']);

/** Upper-case letters and digits only: "41a5021-1" → "41A50211". */
export function normPart(s) {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The query's part numbers: words with a digit in them, 3+ characters once punctuation is dropped. */
export function partTokens(q) {
  const out = [];
  for (const w of String(q ?? '').split(/[\s,;|]+/)) {
    const n = normPart(w);
    if (n.length >= 3 && /\d/.test(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The same part numbers as the person typed them ("41A5021-1", not "41A50211") — for the page's words. */
export function partWords(q) {
  const out = [], seen = new Set();
  for (const w of String(q ?? '').split(/[\s,;|]+/)) {
    const n = normPart(w);
    if (n.length >= 3 && /\d/.test(n) && !seen.has(n)) { seen.add(n); out.push(w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')); }
  }
  return out;
}

/** The query's ordinary words (no digit), lower-case, two letters or more, filler left out. */
export function wordTokens(q) {
  const out = [];
  for (const w of String(q ?? '').toLowerCase().split(/[^a-z0-9&]+/)) {
    if (w.length >= 2 && !/\d/.test(w) && !STOP.has(w) && !out.includes(w)) out.push(w);
  }
  return out;
}

/** The codes in a piece of text: letter/digit runs, joined across - . / (never across a space). */
export function codesIn(text) {
  return String(text ?? '').match(/[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*/g) || [];
}

/**
 * How one code stands to one part number (both as written; compared normalized).
 * exact: the code IS the number. variant: the number, then a dash/dot/slash and more (498C-DR).
 * starts: the code runs straight on from the number (10LZRMICROSCANHUB). none: anything else —
 * including the number buried inside a longer code (20061601, KP1601).
 */
export function codeMatch(code, token) {
  const c = normPart(code);
  if (!c || !token) return 'none';
  if (c === token) return 'exact';
  if (!c.startsWith(token)) return 'none';
  // Where does the token end in the code as written? If a separator follows, it is a variant.
  let seen = 0, i = 0;
  const raw = String(code);
  for (; i < raw.length && seen < token.length; i++) if (/[A-Za-z0-9]/.test(raw[i])) seen++;
  return /[-./]/.test(raw[i] || '') ? 'variant' : 'starts';
}

/**
 * The best match of any part number against a listing. `partFields` are the listing's own part numbers (a
 * catalogue row's), where an exact match is the part itself; `texts` are words about it (a title, a
 * description), where an exact match only NAMES the part.
 */
export function bestPartMatch(texts, tokens, partFields = []) {
  for (const f of partFields) { const n = normPart(f); if (n && tokens.includes(n)) return 'part'; }
  let best = 'none';
  for (const t of [...partFields, ...texts]) {
    for (const code of codesIn(t)) {
      for (const tok of tokens) {
        const m = codeMatch(code, tok);
        if (RANK[m] > RANK[best]) best = m;
        if (best === 'exact') return best;
      }
    }
  }
  return best;
}

/** How many of the query's words a listing carries (as substrings, so "motors" carries "motor"). */
export function wordsCarried(texts, words) {
  const hay = texts.map(t => String(t ?? '').toLowerCase()).join(' \u0001 ');
  return words.filter(w => hay.includes(w)).length;
}

/** A listing's own part numbers (a catalogue row's; a web listing has none). */
export function listingParts(r) {
  const c = r?.catalog || {};
  return [c.addisonPart, c.manufacturerPart].filter(Boolean);
}
/** The words about a listing that may name the part. */
export function listingTexts(r) {
  return [r?.title, r?.catalog?.description];
}

/**
 * Judge one listing against a query: { match, rank, words }.
 * With part numbers in the query, `match` says how the listing stands to the part (part · exact · variant ·
 * starts · none). With none, a listing
 * is 'words' when it carries every word, else 'none'.
 */
export function judgeListing(r, q, tokens = partTokens(q), words = wordTokens(q)) {
  const texts = listingTexts(r), parts = listingParts(r);
  const carried = wordsCarried([...parts, ...texts, r?.source, r?.catalog?.distributor, r?.catalog?.category], words);
  if (tokens.length) {
    const match = bestPartMatch(texts, tokens, parts);
    return { match, rank: RANK[match], words: carried };
  }
  const all = words.length > 0 && carried === words.length;
  return { match: all ? 'words' : 'none', rank: all ? 1 : 0, words: carried };
}

/** Order listings best match first; price only orders listings of the same rank. Unpriced last in a rank. */
export function byBestMatch(a, b) {
  const ra = Number(a?.rank) || 0, rb = Number(b?.rank) || 0;
  if (rb !== ra) return rb - ra;
  const wa = Number(a?.words) || 0, wb = Number(b?.words) || 0;
  if (wb !== wa) return wb - wa;
  const pa = Number(a?.price) > 0 ? Number(a.price) : Infinity;
  const pb = Number(b?.price) > 0 ? Number(b.price) : Infinity;
  return pa - pb;
}

/**
 * The catalogue's answer to a price search, ranked before it is cut. With part numbers: every part that
 * names one (exact, variant or starts-with), best first. With words only: every part carrying all of them.
 * Fields searched for words also include the distributor and category, as the old search did.
 */
export function rankCatalog(items, q, limit = 50) {
  const tokens = partTokens(q), words = wordTokens(q);
  if (!tokens.length && !words.length) return [];
  const hits = [];
  for (const item of items || []) {
    const parts = [item.addisonPart, item.manufacturerPart].filter(Boolean);
    const texts = [...parts, item.description];
    let match, rank;
    if (tokens.length) {
      match = bestPartMatch([item.description], tokens, parts);
      rank = RANK[match];
      if (!rank) continue;
    } else {
      if (wordsCarried([...texts, item.distributor, item.category], words) < words.length) continue;
      match = 'words'; rank = 1;
    }
    hits.push({ item, match, rank, words: wordsCarried([...texts, item.distributor, item.category], words), price: Number(item.price) || 0 });
  }
  hits.sort(byBestMatch);
  return hits.slice(0, limit);
}

/** The words a row shows about its match, or '' when there is nothing worth saying. */
export function matchLabel(r, partNumbers) {
  const pn = (partNumbers && partNumbers[0]) || '';
  switch (r?.match) {
    case 'part': return 'Exact part #';
    case 'exact': return 'Names ' + pn;
    case 'variant': return 'Variant of ' + pn;
    case 'starts': return 'Starts with ' + pn;
    case 'none': return partNumbers && partNumbers.length ? 'Does not mention ' + pn : '';
    default: return '';
  }
}
