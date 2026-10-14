// "Refine with Claude" — Sterling 2026-10-14: "a token based claude agent to help get more
// precise results". A web price search returns everything that shares a word with the query;
// this asks Claude to read the listings against the part the person actually typed and say
// which are the part, which are probably the part, and which are strangers — plus what the
// part IS (manufacturer, number, what it fits) and better searches to run.
//
// Rules:
//  - It costs money per call, so it runs ONLY when somebody presses the button. Never per
//    keystroke, never on every search. The response carries the token count so the cost is
//    visible on the screen that spent it.
//  - OFF unless ANTHROPIC_API_KEY (or PARTFINDER_ANTHROPIC_KEY) is set. /api/refine/status says
//    which, and the client hides the button when it is off — a dead button reads as broken.
//  - Claude re-ranks and annotates; it never invents a listing or a price. Every verdict refers
//    to a listing id the server sent, and unknown ids are dropped on the way back.
//  - Listings are trimmed (title/source/price/condition/part numbers, 40 at most) before they
//    go out — a thumbnail URL or a 2 KB catalog blob is tokens for nothing.
//  - Answers are cached 10 minutes per (query, listing set) so a second press is free.

import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MAX_LISTINGS = 40;
const CACHE_MS = 10 * 60 * 1000;

export function refineKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.PARTFINDER_ANTHROPIC_KEY || '';
}

export function refineStatus() {
  const key = refineKey();
  return {
    enabled: !!key,
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    reason: key ? null : 'Set ANTHROPIC_API_KEY (or PARTFINDER_ANTHROPIC_KEY) in PartFinder\'s .env to turn this on.',
  };
}

/** Strip a search result down to what Claude needs to judge it. */
export function trimListing(r, i) {
  const cat = r.catalog || {};
  return {
    id: String(r.id ?? i),
    title: String(r.title || '').slice(0, 200),
    source: String(r.source || '').slice(0, 80),
    price: Number(r.price) > 0 ? Number(r.price) : null,
    priceLabel: cat.priceLabel || null,
    condition: r.condition || null,
    partNumber: cat.addisonPart || null,
    manufacturerPart: cat.manufacturerPart || null,
    via: r.via || null,
  };
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['interpretation', 'verdicts', 'suggestedQueries'],
  properties: {
    interpretation: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'manufacturer', 'partNumber', 'confidence'],
      properties: {
        summary: { type: 'string', description: 'One sentence: what the person is looking for, in plain words.' },
        manufacturer: { type: ['string', 'null'] },
        partNumber: { type: ['string', 'null'], description: 'The canonical part number if it can be read from the query or the listings.' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'match', 'note'],
        properties: {
          id: { type: 'string' },
          match: { type: 'string', enum: ['exact', 'likely', 'related', 'unrelated'] },
          note: { type: 'string', description: 'At most one short sentence. Empty string when nothing needs saying.' },
        },
      },
    },
    suggestedQueries: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
      description: 'Better searches to run next: the canonical part number, a superseding number, a known alias. Only ones you are reasonably sure of.',
    },
  },
};

export const SYSTEM_PROMPT = `You help a parts desk at Automatics & More, a distributor of automatic door and gate hardware (operators, controls, sensors, closers, springs, glass hardware). A person typed a search; a price search returned listings from shopping sites and distributor catalogs. Many listings share a word with the query but are not the part.

Judge each listing against the part the person is after:
- exact: this is the part (same manufacturer part number, or an unmistakable description of it).
- likely: almost certainly the part, but the listing leaves something unconfirmed.
- related: a compatible, superseding, or companion part (a kit it comes in, a replacement number) — worth seeing, not the thing itself.
- unrelated: a different part that happened to match a word.

Give every listing a verdict. Keep notes to one short sentence and leave them empty when the verdict speaks for itself. Never invent a listing, a price, or a part number you did not read in the input. Suggested queries are only numbers or names you are reasonably sure identify the same part.`;

export function buildUserMessage({ query, partNumber, manufacturer, condition, listings }) {
  const lines = [
    `Search typed by the person:`,
    `- description/name: ${query || '(blank)'}`,
    `- part number: ${partNumber || '(blank)'}`,
    `- manufacturer: ${manufacturer || '(blank)'}`,
    `- condition filter: ${condition || 'Any'}`,
    ``,
    `Listings (JSON, one per line):`,
    ...listings.map(l => JSON.stringify(l)),
  ];
  return lines.join('\n');
}

const cache = new Map(); // key -> { at, body }

export function cacheKeyFor(input, listings) {
  return JSON.stringify([input.query || '', input.partNumber || '', input.manufacturer || '', input.condition || '', listings.map(l => l.id)]);
}

/** Keep only verdicts that name a listing we sent; default the rest to 'related' so nothing is hidden by silence. */
export function reconcileVerdicts(verdicts, listings) {
  const known = new Map(listings.map(l => [l.id, l]));
  const out = new Map();
  for (const v of verdicts || []) {
    if (!v || !known.has(String(v.id))) continue;
    out.set(String(v.id), { id: String(v.id), match: v.match, note: String(v.note || '').slice(0, 200) });
  }
  for (const l of listings) {
    if (!out.has(l.id)) out.set(l.id, { id: l.id, match: 'related', note: '' });
  }
  return [...out.values()];
}

/**
 * @param {{query?:string, partNumber?:string, manufacturer?:string, condition?:string, results:Array}} input
 * @param {{client?: Anthropic, now?: () => number}} deps  injectable for tests
 */
export async function refineResults(input, deps = {}) {
  const status = refineStatus();
  if (!status.enabled) {
    const err = new Error(status.reason);
    err.status = 503;
    throw err;
  }
  const listings = (input.results || []).slice(0, MAX_LISTINGS).map(trimListing);
  if (!listings.length) {
    const err = new Error('Nothing to refine: the search returned no listings.');
    err.status = 400;
    throw err;
  }
  const now = deps.now || Date.now;
  const key = cacheKeyFor(input, listings);
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_MS) return { ...hit.body, cached: true };

  const client = deps.client || new Anthropic({ apiKey: refineKey() });
  const response = await client.messages.create({
    model: status.model,
    max_tokens: 4000,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: buildUserMessage({ ...input, listings }) }],
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('Claude declined this request' + (response.stop_details?.explanation ? ': ' + response.stop_details.explanation : '.'));
    err.status = 502;
    throw err;
  }
  const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    const err = new Error('Claude answered with something that was not the expected JSON.');
    err.status = 502;
    throw err;
  }

  const body = {
    model: response.model,
    interpretation: parsed.interpretation || null,
    verdicts: reconcileVerdicts(parsed.verdicts, listings),
    suggestedQueries: (parsed.suggestedQueries || []).filter(s => typeof s === 'string' && s.trim()).slice(0, 4),
    listingsSent: listings.length,
    listingsTotal: (input.results || []).length,
    usage: {
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      cacheReadInputTokens: response.usage?.cache_read_input_tokens ?? 0,
    },
    cached: false,
  };
  cache.set(key, { at: now(), body });
  return body;
}

/** For tests. */
export function _clearRefineCache() { cache.clear(); }
