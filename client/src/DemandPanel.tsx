/**
 * DEMAND — one part's Google search interest, beside its price or stock (Sterling 2026-10-25).
 *
 * ONE COMPONENT, TWO HOMES. This exact file is also PartFinder's client/src/DemandPanel.tsx; keep the two
 * byte-identical. It therefore imports nothing but React and styles itself inline (Nexus uses Tailwind,
 * PartFinder plain CSS). Each home passes `load` — how it asks for the answer:
 *   · Nexus (a Shortly part): GET /api/trends/demand
 *   · PartFinder: GET <base>api/trends/:term, which its server forwards to Nexus
 * Nexus owns the cache and the spend either way (src/trendsServer.ts); nothing here calls Google.
 *
 * What it shows: 12 months of US interest as a sparkline, Rising / Steady / Falling (the last 90 days
 * against the 90 before, ±15 %), and the top 3 rising related searches. A part number Google has never
 * heard of is retried as the words of the part's title, and "no search trend data" is an answer — this
 * panel never shows an error.
 *
 * `auto` (default true) looks the term up at once. With auto off it shows a saved answer when there is
 * one and otherwise a "Show search demand" button, so merely opening a part never spends a search.
 */
import { useEffect, useState, type CSSProperties } from 'react';

/** One flat shape (ok, or one of the reasons it is not) — this project's TS settings do not narrow unions on `ok`. */
export type DemandAnswer = {
  ok: boolean;
  term?: string; asked?: string; cleaned?: boolean;
  points?: Array<{ date: string; value: number; partial?: boolean }>;
  badge?: 'Rising' | 'Steady' | 'Falling' | null; changePct?: number | null;
  rising?: Array<{ query: string; label: string }>; asOf?: string; note?: string;
  noData?: boolean; notCached?: boolean; paused?: boolean; notConfigured?: boolean; message?: string; error?: string;
};

export type DemandLoader = (term: string, title: string, opts: { cachedOnly: boolean }) => Promise<DemandAnswer>;

const HINT = "Google's relative interest, 0–100 against the busiest week of the last 12 months in the US — not a count of searches.";
const BADGE: Record<string, { fg: string; bg: string }> = {
  Rising: { fg: '#15803d', bg: '#dcfce7' },
  Steady: { fg: '#3f3f46', bg: '#f4f4f5' },
  Falling: { fg: '#b91c1c', bg: '#fee2e2' },
};
const box: CSSProperties = { border: '1px solid #e4e4e7', borderRadius: 12, background: '#fff', padding: 12, fontFamily: 'inherit', fontSize: 13, color: '#27272a' };
const muted: CSSProperties = { color: '#71717a', fontSize: 12 };
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#1d4ed8', cursor: 'pointer', font: 'inherit', textAlign: 'left' };

function Sparkline({ points }: { points: Array<{ value: number; partial?: boolean }> }) {
  if (points.length < 2) return null;
  const W = 220, H = 44, n = points.length;
  const xy = points.map((p, i) => [(i / (n - 1)) * W, H - 3 - (Math.max(0, Math.min(100, p.value)) / 100) * (H - 6)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="12-month search interest">
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="#dbeafe" opacity={0.7} />
      <polyline points={line} fill="none" stroke="#2563eb" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export default function DemandPanel({ term, title = '', load, onSearch, auto = true }: {
  term: string;
  /** The part's title — its words are tried when the term itself (a bare part number) has no data. */
  title?: string;
  load: DemandLoader;
  /** Run a related search as a new search in the host; without it the panel shows that search itself. */
  onSearch?: (query: string) => void;
  auto?: boolean;
}) {
  const [asked, setAsked] = useState<{ term: string; title: string }>({ term, title });
  const [answer, setAnswer] = useState<DemandAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  useEffect(() => { setAsked({ term, title }); }, [term, title]);

  const run = async (t: string, ti: string, cachedOnly: boolean) => {
    if (!t.trim()) { setAnswer(null); return; }
    setLoading(true);
    try { setAnswer(await load(t, ti, { cachedOnly })); }
    catch { setAnswer({ ok: false, message: 'Search demand is not available right now.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let live = true;
    setAnswer(null);
    (async () => { if (live) await run(asked.term, asked.title, !auto); })();
    return () => { live = false; };
  }, [asked.term, asked.title, auto]); // eslint-disable-line react-hooks/exhaustive-deps

  const related = (q: string) => (onSearch ? onSearch(q) : setAsked({ term: q, title: '' }));

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <strong style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: '#52525b' }}>Demand</strong>
        <button type="button" onClick={() => setShowHint(v => !v)} title={HINT} aria-label="What is this?"
          style={{ width: 18, height: 18, borderRadius: 9, border: '1px solid #d4d4d8', background: '#fafafa', color: '#52525b', fontSize: 11, lineHeight: '16px', cursor: 'pointer', padding: 0 }}>?</button>
        {answer?.ok && answer.badge && (
          <span style={{ marginLeft: 'auto', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700, color: BADGE[answer.badge].fg, background: BADGE[answer.badge].bg }}>
            {answer.badge}{answer.changePct != null ? ` ${answer.changePct > 0 ? '+' : ''}${answer.changePct}%` : ''}
          </span>
        )}
      </div>
      {showHint && <p style={{ ...muted, margin: '0 0 8px' }}>{HINT}</p>}

      {loading ? <p style={{ ...muted, margin: 0 }}>Checking Google Trends…</p>
        : !answer ? null
        : answer.ok ? (
          <>
            <Sparkline points={answer.points || []} />
            <div style={{ ...muted, display: 'flex', justifyContent: 'space-between', margin: '2px 0 8px' }}>
              <span>12 months · US{answer.cleaned ? ` · searched as “${answer.term}”` : ''}</span>
              <span>as of {new Date(answer.asOf || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
            {(answer.rising || []).length > 0 ? (
              <div>
                <div style={{ ...muted, fontWeight: 700, marginBottom: 3 }}>Rising searches</div>
                {(answer.rising || []).map(r => (
                  <div key={r.query} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                    <button type="button" style={linkBtn} onClick={() => related(r.query)}>{r.query}</button>
                    <span style={{ color: '#15803d', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{r.label}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{ ...muted, margin: 0 }}>No rising related searches.</p>}
            {answer.note && <p style={{ ...muted, margin: '6px 0 0', color: '#92400e' }}>{answer.note}</p>}
          </>
        ) : answer.notCached ? (
          <button type="button" onClick={() => run(asked.term, asked.title, false)}
            style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '5px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Show search demand
          </button>
        ) : (
          <p style={{ ...muted, margin: 0, ...(answer.paused ? { color: '#92400e' } : {}) }}>
            {answer.noData ? 'No search trend data for this part.'
              : answer.notConfigured ? 'Search demand is not set up yet.'
              : answer.message || answer.error || 'Search demand is not available right now.'}
          </p>
        )}
      {asked.term !== term && !onSearch && (
        <button type="button" style={{ ...linkBtn, ...muted, marginTop: 6 }} onClick={() => setAsked({ term, title })}>← back to {term}</button>
      )}
    </div>
  );
}
