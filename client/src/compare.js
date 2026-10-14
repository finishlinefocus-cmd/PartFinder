// Price comparison for the Price Search rail (Drew, 2026-10-14: "a little side bar … a price
// comparison on a drop down menu, keeping it small and out of the way but allowing further
// exploration"). Pure: no React, no fetch, so `node --test client/src/compare.test.mjs` runs it.
//
// Rules worth keeping:
//  - A seller's figure is the LOWEST priced listing it has for this search, never an average —
//    an average of a $40 relay and a $900 operator from the same seller means nothing.
//  - A listing with no price (catalog "(login for price)", "(call for price)") is counted as a
//    listing but never as a price. "n/a" is not $0.
//  - Our own store is picked out so the rail can say where we sit against the market, and our
//    own listings are kept OUT of the market low/median — comparing us against ourselves is
//    not a comparison.
//  - Shipping is only added when the listing states it; "Free ship" in the UI is a guess the
//    result row already makes, so the total view says "incl. ship" only where shipping > 0.

export const OUR_SOURCE_PATTERN = /automatics\s*(&|and)\s*more/i;

export function isOurListing(r) {
  if (!r) return false;
  if (OUR_SOURCE_PATTERN.test(String(r.source || ''))) return true;
  const link = String(r.link || '');
  if (/automaticsandmore\.com/i.test(link)) return true;
  const did = String(r.catalog?.distributorId || '');
  return did.startsWith('am-');
}

export function listingPrice(r, withShipping = false) {
  const p = Number(r?.price);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (!withShipping) return p;
  const s = Number(r?.shipping);
  return p + (Number.isFinite(s) && s > 0 ? s : 0);
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Group results by seller.
 * @param {Array} results   the /api/search rows
 * @param {{withShipping?: boolean}} opts
 * @returns {{ sellers: Array, ours: object|null, market: object, counts: object }}
 */
export function buildComparison(results, opts = {}) {
  const withShipping = !!opts.withShipping;
  const groups = new Map();
  for (const r of results || []) {
    const name = String(r.source || 'Unknown').trim() || 'Unknown';
    const key = name.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { key, name, ours: isOurListing(r), listings: 0, priced: 0, low: null, lowListing: null, via: new Set() });
    }
    const g = groups.get(key);
    g.listings += 1;
    if (r.via) g.via.add(String(r.via));
    const p = listingPrice(r, withShipping);
    if (p != null) {
      g.priced += 1;
      if (g.low == null || p < g.low) { g.low = p; g.lowListing = r; }
    }
  }

  const sellers = [...groups.values()].map(g => ({ ...g, via: [...g.via] }));
  // Priced sellers first, cheapest first; unpriced sellers after, by listing count.
  sellers.sort((a, b) => {
    if (a.low != null && b.low != null) return a.low - b.low;
    if (a.low != null) return -1;
    if (b.low != null) return 1;
    return b.listings - a.listings;
  });

  const ours = sellers.find(s => s.ours) || null;
  const marketPrices = sellers.filter(s => !s.ours && s.low != null).map(s => s.low);
  const marketLow = marketPrices.length ? Math.min(...marketPrices) : null;
  const marketLowSeller = marketLow == null ? null : sellers.find(s => !s.ours && s.low === marketLow) || null;

  let position = 'unknown'; // 'cheapest' | 'above' | 'only' | 'unknown'
  let delta = null;         // ours.low - marketLow (positive = we are dearer)
  if (ours && ours.low != null) {
    if (marketLow == null) position = 'only';
    else { delta = ours.low - marketLow; position = delta <= 0 ? 'cheapest' : 'above'; }
  }

  return {
    withShipping,
    sellers,
    ours,
    market: {
      low: marketLow,
      lowSeller: marketLowSeller ? marketLowSeller.name : null,
      median: median(marketPrices),
      pricedSellers: marketPrices.length,
    },
    position,
    delta,
    counts: {
      listings: (results || []).length,
      sellers: sellers.length,
      pricedSellers: sellers.filter(s => s.low != null).length,
    },
  };
}

/**
 * The one-line summary for the collapsed rail pill.
 * e.g. "12 sellers · from $42.10 (Amazon)" or "3 sellers · no prices".
 */
export function compareSummary(cmp) {
  if (!cmp || !cmp.counts.sellers) return 'Compare';
  const n = cmp.counts.sellers;
  const sellers = `${n} seller${n === 1 ? '' : 's'}`;
  const lows = cmp.sellers.filter(s => s.low != null);
  if (!lows.length) return `${sellers} · no prices`;
  const best = lows[0];
  return `${sellers} · from ${money(best.low)}${best.ours ? ' (us)' : ''}`;
}

/**
 * Our price vs. our cost, when a cost is on file. `costItems` is the /api/cost `items` array.
 * Returns null when nothing can be said; never invents a margin from a missing number.
 */
export function marginView(cmp, costItems) {
  const cost = (costItems || []).map(c => Number(c?.unitCost)).find(n => Number.isFinite(n) && n > 0);
  if (!Number.isFinite(cost)) return null;
  const ourPrice = cmp?.ours?.low ?? null;
  const marketLow = cmp?.market?.low ?? null;
  const pct = (sell) => (sell && sell > 0 ? ((sell - cost) / sell) * 100 : null);
  return {
    cost,
    ourPrice,
    ourMarginPct: pct(ourPrice),
    marketLow,
    marketLowMarginPct: pct(marketLow),            // what margin we would have at the market low
    marketBelowCost: marketLow != null && marketLow < cost,
  };
}

export function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return '$' + Number(n).toFixed(2);
}
