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
//  - A part number is a word of the query with a digit in it ("41A5021-1", "R313443", "1601", "10LZR",
//    "E4"). Case, dashes (Unicode ones included), dots and slashes never decide a match. One of only two
//    characters ("E4", "M5", "10") must match EXACTLY — it is too short to be told apart from the inside of
//    another number. A SPECIFICATION is not a part number: 24V, 24VAC, 12VDC, 110V, 3/4", 10FT, 433MHZ and
//    "24 volt" are words, and "24V" matches "24 VOLT".
//  - A catalogue part whose OWN part number is the number is the part (498C on Addison's 498C). A listing
//    NAMES the part when the number stands as its own code in the title or description ("41A5021-1" in a
//    Google title, "STANLEY MC521 RESISTOR") — named, but maybe only something that fits it.
//  - The same number with something attached (2026-10-29 review: searching "1601" dropped R1601, DC-1601,
//    CRL1601 from the catalogue answer, and nothing brought them back):
//      rebuilt   R1601, R-1601 — A&M's R prefix is a rebuilt part (all 230 R+digit parts in the catalogue
//                say RBLT / REBUILT / CORE), so the page can say "Rebuilt 1601".
//      variant   498C-DR — the number, then a dash/dot/slash and more.
//      starts    10LZRMICROSCANHUB, 298C — the number, then letters straight on.
//      related   DC-1601, CRL1601, KP1601 — letters before it. A letter prefix cannot be told from a
//                vendor's own code (KP1601 is CRL spray paint), so these come last and say so.
//    What is NOT the same number: digits running on either side (16012, 11601, 20061601, CB13511), a
//    prefix holding digits (31-0945 is not 0945, 10PBS45B is not 45B), and letters running into a number
//    that starts with letters (AMC521 is not MC521).
//  - Rank: the part, named, rebuilt, variant, starts-with, related, then the rest — price only orders
//    listings of the same rank. Words in the query ("Stanley", "motor") break ties; they never hide a match.
//  - A listing that never mentions the number is not deleted — the page says it does not mention it and
//    folds it away, because a search engine's guess is not the part. The compare rail's market low reads
//    only listings of the SAME number (part, named, variant, starts-with): a rebuilt or a prefixed code is a
//    different price, and a stranger's price is not the market.

export const RANK = { part: 6, exact: 5, rebuilt: 4, variant: 3, starts: 2, related: 1, none: 0 };
/** A part number shorter than this matches exactly or not at all ("E4" is not inside "E45" or "SE4"). */
export const SHORT_PART = 3;
const STOP = new Set(['and', 'the', 'for', 'with', 'of', 'a', 'an', 'to', 'in', 'on', 'or', 'part', 'parts', 'new', 'used', 'any']);

/** Every dash and hyphen Unicode has, as "-" (en dash, em dash, minus, the hyphen U+2010 …); soft hyphens dropped. */
export function normDashes(s) {
  return String(s ?? '').replace(/\u00AD/g, '').replace(/[\u2010-\u2015\u2043\u2212\uFE58\uFE63\uFF0D]/g, '-');
}

/** Upper-case letters and digits only: "41a5021-1" → "41A50211". */
export function normPart(s) {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Specifications ────────────────────────────────────────────────────────────────────────────────
// Each unit: the canonical key, the words a person types for it, and how a listing may write it. Units that
// are also common part-number suffixes in the catalogue are left OUT of what a query may type glued to a
// number — A (1388A), W (272W), M (61M), K (50010130K), LB (1609LB) — so "1388A" stays a part number.
const UNITS = [
  { key: 'v', typed: /^(?:v|vac|vdc|vac\/dc|vac\/vdc|v\/ac|volt|volts)$/i, text: '(?:volts?(?:\\s*(?:ac|dc)(?:\\s*\\/\\s*dc)?)?|vac\\s*\\/\\s*v?dc|vac|vdc|v\\s*ac|v\\s*dc|v)', electrical: true },
  { key: 'a', typed: /^(?:amp|amps)$/i, text: '(?:amps?|a)', electrical: true },
  { key: 'ma', typed: /^(?:ma|milliamps?)$/i, text: '(?:ma|milliamps?)', electrical: true },
  { key: 'mah', typed: /^mah$/i, text: 'mah', electrical: true },
  { key: 'w', typed: /^(?:watt|watts)$/i, text: '(?:watts?|w)', electrical: true },
  { key: 'va', typed: /^va$/i, text: 'va', electrical: true },
  { key: 'hz', typed: /^hz$/i, text: 'hz', electrical: true },
  { key: 'khz', typed: /^khz$/i, text: 'khz', electrical: true },
  { key: 'mhz', typed: /^mhz$/i, text: 'mhz', electrical: true },
  { key: 'ghz', typed: /^ghz$/i, text: 'ghz', electrical: true },
  { key: 'ohm', typed: /^(?:ohm|ohms|Ω)$/i, text: '(?:ohms?|Ω)', electrical: true },
  { key: 'ft', typed: /^(?:ft|feet|foot|'|’|′)$/i, text: "(?:ft\\.?|feet|foot|'|’|′)" },
  { key: 'in', typed: /^(?:in|inch|inches|"|″|”|'')$/i, text: '(?:inch(?:es)?|in\\.?|"|″|”|\'\')' },
  { key: 'mm', typed: /^mm$/i, text: 'mm' },
  { key: 'cm', typed: /^cm$/i, text: 'cm' },
  { key: 'lb', typed: /^(?:lbs|pound|pounds)$/i, text: '(?:lbs?|pounds?)' },
  { key: 'oz', typed: /^(?:oz|ounce|ounces)$/i, text: '(?:oz|ounces?)' },
  { key: 'kg', typed: /^kg$/i, text: 'kg' },
  { key: 'awg', typed: /^awg$/i, text: 'awg' },
  { key: 'ga', typed: /^(?:ga|gauge)$/i, text: '(?:ga|gauge)' },
  { key: 'psi', typed: /^psi$/i, text: 'psi' },
  { key: 'rpm', typed: /^rpm$/i, text: 'rpm' },
  { key: 'deg', typed: /^(?:deg|degree|degrees|°|°f|°c)$/i, text: '(?:deg(?:rees?)?|°\\s*[fc]?)' },
];
// A number a spec may carry: 24, 1.5, a range 12/24 or 12-24 (each side short, so 537082-4FT stays a
// part number), a fraction 3/4 or 1-1/4.
const NUM = '(?:\\d{1,2}-\\d{1,2}\\/\\d{1,2}|\\d{1,2}\\/(?:2|4|8|16|32|64)|\\d{1,3}(?:\\.\\d+)?[-\\/]\\d{1,3}(?:\\.\\d+)?|\\d{1,4}(?:\\.\\d+)?)';
const NUM_ONLY = new RegExp('^' + NUM + '$');

function unitOf(word) {
  for (const u of UNITS) if (u.typed.test(word)) return u;
  return null;
}
function isFraction(num) {
  const m = String(num).match(/^(?:\d{1,2}-)?(\d{1,2})\/(\d{1,2})$/);
  return !!m && Number(m[1]) < Number(m[2]) && [2, 4, 8, 16, 32, 64].includes(Number(m[2]));
}
function canonNum(num) {
  return String(num).toLowerCase().replace(/\s+/g, '');
}

/**
 * Is this query word a specification? Returns its canonical word ("24v", "12/24v", "3/4in", "10ft", "3/4")
 * or null. `next` is the following query word, for a spec typed with a space ("24 volt"); `.pair` on the
 * answer says the next word was used.
 */
export function specOf(word, next) {
  const w = normDashes(word).trim();
  if (!w) return null;
  // "24 volt", "12 VDC", "3/4 inch" — but not "2 in" (too common a word to read as inches)
  if (NUM_ONLY.test(w) && next) {
    const u = unitOf(normDashes(next).trim());
    if (u && !/^in$/i.test(String(next).trim())) return { word: canonNum(w) + u.key, pair: true };
  }
  if (NUM_ONLY.test(w) && isFraction(w)) return { word: canonNum(w), pair: false };
  // "24VAC", "12/24V", "3/4\"", "10-FT": the longest number that leaves a unit behind it
  for (let k = w.length - 1; k > 0; k--) {
    const num = w.slice(0, k).replace(/-$/, ''), unit = unitOf(w.slice(k));
    if (unit && NUM_ONLY.test(num)) return { word: canonNum(num) + unit.key, pair: false };
  }
  return null;
}

/** The pattern a listing's text must hold for a canonical spec word, or null when the word is not one. */
const specPatternCache = new Map();
export function specPattern(word) {
  if (specPatternCache.has(word)) return specPatternCache.get(word);
  let re = null;
  const m = String(word).match(new RegExp('^(' + NUM + ')([a-z]*)$'));
  if (m) {
    const u = m[2] ? UNITS.find(x => x.key === m[2]) : null;
    if (!m[2] || u) {
      // A fraction keeps its slash, its whole part written "1-1/4" or "1 1/4"; a range 12/24 in the query
      // also matches 12-24 in a listing.
      const num = isFraction(m[1])
        ? m[1].replace(/^(\d{1,2})-/, '$1[-\\s]')
        : m[1].replace(/\./g, '\\.').replace(/(\d)[-/](\d)/g, (s, a, b) => a + '\\s*[-/]\\s*' + b);
      // An electrical spec may close a range ("24V" is in "12/24 VDC"); a length may not ("4in" is not "3/4 in").
      const lead = u && u.electrical ? '(?<![\\d.])' : '(?<![\\d./])';
      re = new RegExp(lead + num + (u ? '\\s*-?\\s*' + u.text + '(?![a-z0-9])' : '(?![\\d/])'), 'i');
    }
  }
  specPatternCache.set(word, re);
  return re;
}

// ── The query ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Read a query once: its part numbers ({ typed, norm, pieces }), its words (plain ones lower-case, specs
 * canonical) and `specCodes` — each spec as typed, normalized ("24VAC"), because some specs are also a
 * part's own number (BEA's 24VAC transformer) and that part should still lead its search. `pieces` are the part number's runs between dashes/dots/slashes as typed — "41A5021-1" →
 * ["41A5021", "1"] — because a listing may write the number with a SPACE where the query had a dash.
 */
export function parseQuery(q) {
  const raw = normDashes(q).split(/[\s,;|]+/).filter(Boolean);
  const parts = [], words = [], specCodes = [];
  const addWord = w => { if (!words.includes(w)) words.push(w); };
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const spec = specOf(w, raw[i + 1]);
    if (spec) {
      addWord(spec.word);
      specCodes.push(normPart(spec.pair ? w + raw[i + 1] : w));
      if (spec.pair) i++;
      continue;
    }
    const n = normPart(w);
    if (n.length >= 2 && /\d/.test(n)) {
      if (!parts.some(p => p.norm === n)) {
        const typed = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        parts.push({ typed, norm: n, pieces: typed.split(/[-./]+/).map(normPart).filter(Boolean) });
      }
      continue;
    }
    for (const sub of w.toLowerCase().split(/[^a-z0-9&]+/)) {
      if (sub.length >= 2 && !/\d/.test(sub) && !STOP.has(sub)) addWord(sub);
    }
  }
  return { parts, words, specCodes };
}

/** The query's part numbers, normalized: words with a digit in them, two characters or more, specs left out. */
export function partTokens(q) {
  return parseQuery(q).parts.map(p => p.norm);
}

/** The same part numbers as the person typed them ("41A5021-1", not "41A50211") — for the page's words. */
export function partWords(q) {
  return parseQuery(q).parts.map(p => p.typed);
}

/** The query's words: plain words (no digit) lower-case and two letters or more, filler left out; specs canonical ("24v"). */
export function wordTokens(q) {
  return parseQuery(q).words;
}

/** The part numbers of a query that were typed in pieces, as one joiner each (see joinSplit). */
export function splitJoins(q) {
  const out = [];
  for (const p of parseQuery(q).parts) {
    if (p.pieces.length < 2) continue;
    const pattern = p.pieces.join('(?:\\s*[-./]\\s*|\\s+)');
    out.push({ re: new RegExp(pattern, 'gi'), to: p.pieces.join('-') });
  }
  return out;
}

/**
 * Write a number the query typed with dashes the same way where a listing split it with spaces: for the
 * query "41A5021-1", "41A5021 1" in a title becomes "41A5021-1". Only at the query's own separators — for
 * "41A50211" (typed without a dash) a title's "41A5021 1" stays two codes.
 */
export function joinSplit(text, joins) {
  let t = normDashes(text);
  for (const j of joins || []) t = t.replace(j.re, j.to);
  return t;
}

/** The codes in a piece of text: letter/digit runs, joined across - . / (never across a space). */
export function codesIn(text) {
  return normDashes(text).match(/[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*/g) || [];
}

const isDigit = ch => ch >= '0' && ch <= '9';
const isLetter = ch => /[A-Za-z]/.test(ch || '');

/** How the token stands where it sits in the code: `at` is its index in the code's normalized form. */
function matchAt(raw, pos, at, token) {
  const before = raw.slice(0, pos[at]);
  const after = raw.slice(pos[at + token.length - 1] + 1);
  let suffix = '';
  if (after) {
    if (/^[-./]/.test(after)) suffix = 'sep';
    else if (isDigit(after[0]) && isDigit(token[token.length - 1])) return 'none'; // 16012: the digits run on
    else suffix = 'attached';
  }
  if (!before) return suffix === 'sep' ? 'variant' : 'starts';
  const letters = before.replace(/[-./]/g, '');
  if (!/^[A-Za-z]+$/.test(letters)) return 'none'; // 20061601, 11601, 31-0945: digits before it — a longer number
  const glued = !/[-./]$/.test(before);
  if (glued && isLetter(before[before.length - 1]) && isLetter(token[0])) return 'none'; // AMC521 is not MC521
  if (letters.toUpperCase() === 'R' && !suffix) return 'rebuilt';
  return 'related';
}

/**
 * How one code stands to one part number (code as written; token normalized).
 * exact: the code IS the number. rebuilt: R1601. variant: the number, then a dash/dot/slash and more
 * (498C-DR). starts: the number, then letters straight on (10LZRMICROSCANHUB). related: letters before it
 * (DC-1601, CRL1601). none: anything else — digits running on either side (16012, 11601, 20061601),
 * a prefix with digits in it, or a short token ("E4") that is not the whole code.
 */
export function codeMatch(code, token) {
  const raw = normDashes(code);
  const c = normPart(raw);
  if (!c || !token) return 'none';
  if (c === token) return 'exact';
  if (token.length < SHORT_PART) return 'none';
  const pos = [];
  for (let i = 0; i < raw.length; i++) if (/[A-Za-z0-9]/.test(raw[i])) pos.push(i);
  let best = 'none';
  for (let at = c.indexOf(token); at !== -1; at = c.indexOf(token, at + 1)) {
    const m = matchAt(raw, pos, at, token);
    if (RANK[m] > RANK[best]) best = m;
  }
  return best;
}

/**
 * The best match of any part number against a listing. `partFields` are the listing's own part numbers (a
 * catalogue row's), where an exact match is the part itself; `texts` are words about it (a title, a
 * description), where an exact match only NAMES the part. `joins` (splitJoins) lets a listing write the
 * number with a space where the query had a dash.
 */
export function bestPartMatch(texts, tokens, partFields = [], joins = []) {
  for (const f of partFields) { const n = normPart(f); if (n && tokens.includes(n)) return 'part'; }
  // Every kind of match has the number in the listing's letters and digits, so a listing without it is
  // done in one pass — most of a 23,000-part catalogue, on every search.
  const flat = normPart([...partFields, ...texts].join(' '));
  if (!tokens.some(t => flat.includes(t))) return 'none';
  let best = 'none';
  for (const t of [...partFields, ...texts]) {
    for (const code of codesIn(joinSplit(t, joins))) {
      for (const tok of tokens) {
        const m = codeMatch(code, tok);
        if (RANK[m] > RANK[best]) best = m;
        if (best === 'exact') return best;
      }
    }
  }
  return best;
}

/**
 * How many of the query's words a listing carries. A plain word as a substring ("motors" carries
 * "motor"); a spec by its pattern ("24v" is carried by "24 VOLT", "24VAC" and "12/24 VDC").
 */
export function wordsCarried(texts, words) {
  const hay = texts.map(t => normDashes(t).toLowerCase()).join(' \u0001 ');
  return words.filter(w => {
    const re = /\d/.test(w) ? specPattern(w) : null;
    return re ? re.test(hay) : hay.includes(w);
  }).length;
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

// What the last query judged needs besides its tokens and words — the API judges every listing of one
// search against one query, so it is read once.
let lastFacts = { q: null, joins: [], specCodes: [] };
function factsFor(q) {
  if (lastFacts.q !== q) lastFacts = { q, joins: splitJoins(q), specCodes: parseQuery(q).specCodes };
  return lastFacts;
}
/** With no part number in the query: a part whose own number is a spec as typed (24VAC) is the part. */
function wordsMatch(parts, specCodes) {
  return specCodes.length && parts.some(p => specCodes.includes(normPart(p))) ? 'part' : 'words';
}

/**
 * Judge one listing against a query: { match, rank, words }.
 * With part numbers in the query, `match` says how the listing stands to the part (part · exact · rebuilt ·
 * variant · starts · related · none). With none, a listing is 'words' when it carries every word, else 'none'.
 */
export function judgeListing(r, q, tokens = partTokens(q), words = wordTokens(q)) {
  const texts = listingTexts(r), parts = listingParts(r);
  const carried = wordsCarried([...parts, ...texts, r?.source, r?.catalog?.distributor, r?.catalog?.category], words);
  if (tokens.length) {
    const match = bestPartMatch(texts, tokens, parts, factsFor(String(q ?? '')).joins);
    return { match, rank: RANK[match], words: carried };
  }
  if (words.length > 0 && carried === words.length) {
    const match = wordsMatch(parts, factsFor(String(q ?? '')).specCodes);
    return { match, rank: match === 'part' ? RANK.part : 1, words: carried };
  }
  return { match: 'none', rank: 0, words: carried };
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
 * carries one — the part, then what names it, then the same number rebuilt, as a variant, run on, or with a
 * prefix — best first. With words only: every part carrying all of them.
 * Fields searched for words also include the distributor and category, as the old search did.
 */
export function rankCatalog(items, q, limit = 50) {
  const { parts: qp, words, specCodes } = parseQuery(q);
  const tokens = qp.map(p => p.norm);
  if (!tokens.length && !words.length) return [];
  const joins = splitJoins(q);
  const hits = [];
  for (const item of items || []) {
    const parts = [item.addisonPart, item.manufacturerPart].filter(Boolean);
    const texts = [...parts, item.description];
    let match, rank;
    if (tokens.length) {
      match = bestPartMatch([item.description], tokens, parts, joins);
      rank = RANK[match];
      if (!rank) continue;
    } else {
      if (wordsCarried([...texts, item.distributor, item.category], words) < words.length) continue;
      match = wordsMatch(parts, specCodes); rank = match === 'part' ? RANK.part : 1;
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
    case 'rebuilt': return 'Rebuilt ' + pn;
    case 'variant': return 'Variant of ' + pn;
    case 'starts': return 'Starts with ' + pn;
    case 'related': return 'Related part number';
    case 'none': return partNumbers && partNumbers.length ? 'Does not mention ' + pn : '';
    default: return '';
  }
}

const SAME_NUMBER = new Set(['part', 'exact', 'variant', 'starts']);
/**
 * Does a listing count toward the compare rail's market low? With part numbers in the search, only listings
 * of the same number: not one that never mentions it, and not a rebuilt or prefixed code — a rebuilt 1601 is
 * a different price, and KP1601 is spray paint. A row with no match at all (a server too old to judge) is
 * kept, as before.
 */
export function inMarketLow(r, partNumbers) {
  if (!partNumbers || !partNumbers.length) return true;
  if (r?.match == null) return true;
  return SAME_NUMBER.has(r.match);
}
