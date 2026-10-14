import { useEffect, useMemo, useState } from 'react';
import { buildComparison, compareSummary, marginView, money } from './compare.js';

// The compare rail (Drew, 2026-10-14): a narrow panel beside the search results. Collapsed, it is
// one pill — "12 sellers · from $42.10" — and it stays collapsed until somebody opens it, so it is
// out of the way by default. Open, a drop-down picks the view (by seller · us vs. market · margin)
// and every seller row is a filter: click Amazon and the list shows only Amazon. The open/closed
// state and the chosen view are remembered per browser.
//
// The margin view asks /api/cost — but only when that view is chosen, so opening the rail spends
// nothing (the cost lookup can reach QuickBooks).

const VIEWS = [
  { id: 'sellers', label: 'By seller — lowest each' },
  { id: 'market', label: 'Us vs. market' },
  { id: 'margin', label: 'Our cost vs. market' },
];

const LS_OPEN = 'pf_compare_open';
const LS_VIEW = 'pf_compare_view';
const LS_SHIP = 'pf_compare_ship';

function readLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window */ }
}

export default function CompareRail({ results, api, query, sellerFilter, onSellerFilter, onSearch }) {
  const [open, setOpen] = useState(() => readLS(LS_OPEN, false));
  const [view, setView] = useState(() => readLS(LS_VIEW, 'sellers'));
  const [withShipping, setWithShipping] = useState(() => readLS(LS_SHIP, false));
  const [cost, setCost] = useState({ state: 'idle', items: [], error: '' }); // idle | loading | done | error

  useEffect(() => { writeLS(LS_OPEN, open); }, [open]);
  useEffect(() => { writeLS(LS_VIEW, view); }, [view]);
  useEffect(() => { writeLS(LS_SHIP, withShipping); }, [withShipping]);

  const cmp = useMemo(() => buildComparison(results, { withShipping }), [results, withShipping]);

  // The cost lookup is keyed on the query; a new search invalidates it.
  useEffect(() => { setCost({ state: 'idle', items: [], error: '' }); }, [query]);
  useEffect(() => {
    if (!open || view !== 'margin' || cost.state !== 'idle' || !query) return;
    let dead = false;
    setCost({ state: 'loading', items: [], error: '' });
    fetch(api + '/cost?q=' + encodeURIComponent(query))
      .then(r => r.json())
      .then(d => { if (!dead) setCost({ state: 'done', items: d.items || [], error: '' }); })
      .catch(e => { if (!dead) setCost({ state: 'error', items: [], error: e.message }); });
    return () => { dead = true; };
  }, [open, view, cost.state, query, api]);

  if (!results || results.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} title="Open the price comparison" style={s.pill}>
        <span style={s.pillIcon}>⇄</span> {compareSummary(cmp)}
        {sellerFilter && <span style={s.pillFilter}>· filtered</span>}
      </button>
    );
  }

  return (
    <aside style={s.rail} aria-label="Price comparison">
      <div style={s.head}>
        <select value={view} onChange={e => setView(e.target.value)} style={s.select} aria-label="Comparison view">
          {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(false)} style={s.close} title="Collapse">×</button>
      </div>

      {view !== 'margin' && (
        <label style={s.shipToggle}>
          <input type="checkbox" checked={withShipping} onChange={e => setWithShipping(e.target.checked)} /> include stated shipping
        </label>
      )}

      {view === 'sellers' && (
        <SellerList cmp={cmp} sellerFilter={sellerFilter} onSellerFilter={onSellerFilter} />
      )}
      {view === 'market' && <MarketView cmp={cmp} onSellerFilter={onSellerFilter} />}
      {view === 'margin' && <MarginView cmp={cmp} cost={cost} onRetry={() => setCost({ state: 'idle', items: [], error: '' })} onSearch={onSearch} query={query} />}

      <div style={s.foot}>
        {cmp.counts.listings} listings · {cmp.counts.pricedSellers} of {cmp.counts.sellers} sellers priced
        {sellerFilter && (
          <> · <button type="button" style={s.linkBtn} onClick={() => onSellerFilter(null)}>show all</button></>
        )}
      </div>
    </aside>
  );
}

function SellerList({ cmp, sellerFilter, onSellerFilter }) {
  return (
    <div>
      {cmp.sellers.map(sel => {
        const active = sellerFilter && sellerFilter === sel.key;
        return (
          <button
            key={sel.key}
            type="button"
            onClick={() => onSellerFilter(active ? null : sel.key)}
            title={active ? 'Show every seller' : `Show only ${sel.name}`}
            style={{ ...s.row, ...(active ? s.rowActive : {}), ...(sel.ours ? s.rowOurs : {}) }}
          >
            <span style={s.rowName}>
              {sel.ours && <span style={s.usTag}>us</span>}
              <span style={s.rowNameText}>{sel.name}</span>
              <span style={s.rowCount}>{sel.listings}</span>
            </span>
            <span style={s.rowPrice}>{sel.low == null ? <span style={s.muted}>no price</span> : money(sel.low)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MarketView({ cmp, onSellerFilter }) {
  const { ours, market, position, delta } = cmp;
  return (
    <div style={{ fontSize: 13 }}>
      <Stat label="Our price" value={ours?.low != null ? money(ours.low) : (ours ? 'listed, no price' : 'not in these results')} />
      <Stat label="Market low" value={market.low != null ? `${money(market.low)} · ${market.lowSeller}` : 'none priced'} />
      <Stat label="Market median" value={market.median != null ? `${money(market.median)} · ${market.pricedSellers} sellers` : '—'} />
      <div style={s.verdict}>
        {position === 'cheapest' && <span style={{ color: '#2F6F3E' }}>We are the cheapest listed{delta < 0 ? ` by ${money(-delta)}` : ''}.</span>}
        {position === 'above' && <span style={{ color: '#A32D2D' }}>We are {money(delta)} above the market low.</span>}
        {position === 'only' && <span>We are the only priced seller here.</span>}
        {position === 'unknown' && <span style={s.muted}>Our store is not in these results, so there is nothing to compare against.</span>}
      </div>
      {market.lowSeller && (
        <button type="button" style={s.secondary} onClick={() => onSellerFilter(market.lowSeller.toLowerCase())}>
          Show {market.lowSeller}'s listings
        </button>
      )}
    </div>
  );
}

function MarginView({ cmp, cost, onRetry, onSearch, query }) {
  if (cost.state === 'loading') return <div style={s.muted}>Looking up our cost…</div>;
  if (cost.state === 'error') return <div style={{ fontSize: 13 }}><span style={{ color: '#A32D2D' }}>Cost lookup failed: {cost.error}</span> <button type="button" style={s.linkBtn} onClick={onRetry}>try again</button></div>;
  const m = marginView(cmp, cost.items);
  if (cost.state === 'done' && !m) {
    return <div style={{ fontSize: 13, color: '#666' }}>No cost on file for “{query}”. The Pricing Engine tab says where costs come from.</div>;
  }
  if (!m) return null;
  const pct = (n) => (n == null ? '—' : `${n.toFixed(0)}%`);
  return (
    <div style={{ fontSize: 13 }}>
      <Stat label="Our cost" value={money(m.cost)} />
      <Stat label="Our price" value={m.ourPrice != null ? `${money(m.ourPrice)} · ${pct(m.ourMarginPct)} margin` : 'not listed here'} />
      <Stat label="Market low" value={m.marketLow != null ? `${money(m.marketLow)} · ${pct(m.marketLowMarginPct)} margin at that price` : 'none priced'} />
      {m.marketBelowCost && <div style={{ ...s.verdict, color: '#A32D2D' }}>The market low is below our cost — check the unit before matching it.</div>}
      {cost.items.length > 1 && <div style={s.muted}>Using the first of {cost.items.length} cost rows that matched.</div>}
      {onSearch && <button type="button" style={s.secondary} onClick={() => onSearch(query, 'pricing')}>Open in Pricing Engine</button>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const s = {
  pill: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', border: '1px solid #ddd', borderRadius: 20, background: '#fff', color: '#185FA5', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start' },
  pillIcon: { fontSize: 13 },
  pillFilter: { color: '#8A5A00', fontWeight: 700 },
  rail: { width: 260, flex: '0 0 260px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 12, position: 'sticky', top: 12, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', fontSize: 13 },
  head: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 },
  select: { flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#185FA5', background: '#fff' },
  close: { border: 'none', background: 'transparent', fontSize: 18, lineHeight: 1, color: '#999', cursor: 'pointer', padding: '0 4px' },
  shipToggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', marginBottom: 8 },
  row: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid transparent', borderRadius: 8, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13 },
  rowActive: { borderColor: '#185FA5', background: '#F2F8FE' },
  rowOurs: { background: '#F6FBF6' },
  rowName: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  rowNameText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowCount: { fontSize: 11, color: '#999' },
  rowPrice: { fontWeight: 700, whiteSpace: 'nowrap' },
  usTag: { fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#E8F5EA', color: '#2F6F3E', textTransform: 'uppercase' },
  muted: { color: '#999', fontSize: 12 },
  verdict: { padding: '8px 0', fontWeight: 600 },
  secondary: { marginTop: 6, width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#222', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  linkBtn: { border: 'none', background: 'transparent', color: '#185FA5', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' },
  foot: { marginTop: 10, paddingTop: 8, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#777' },
};
