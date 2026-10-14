import { useState } from 'react';

// "Refine with Claude" (Sterling, 2026-10-14). One button on the sort bar; it is hidden when the
// server has no key, because a button that cannot work reads as a broken app. Pressing it sends
// the current listings to /api/refine ONCE (the server caches the answer), then the result list
// shows a match chip on each row, folds the unrelated ones under a count, and offers the better
// searches Claude suggested. The token count is printed, because somebody pays per press.

export const MATCH_LABEL = { exact: 'Match', likely: 'Likely', related: 'Related', unrelated: 'Unrelated' };
export const MATCH_STYLE = {
  exact: { background: '#E8F5EA', color: '#2F6F3E' },
  likely: { background: '#E6F1FB', color: '#185FA5' },
  related: { background: '#FFF4D6', color: '#8A5A00' },
  unrelated: { background: '#f0f0f0', color: '#777' },
};

export function MatchChip({ verdict }) {
  if (!verdict) return null;
  const st = MATCH_STYLE[verdict.match] || MATCH_STYLE.related;
  return (
    <span title={verdict.note || ''} style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginRight: 6, ...st }}>
      {MATCH_LABEL[verdict.match] || verdict.match}{verdict.note ? ' · ' + verdict.note : ''}
    </span>
  );
}

export default function RefineBar({ api, enabled, model, query, partNumber, manufacturer, condition, results, refine, setRefine, onSearch }) {
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;

  async function run() {
    setBusy(true);
    setRefine(r => ({ ...r, error: '' }));
    try {
      const res = await fetch(api + '/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, partNumber, manufacturer, condition, results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      const byId = {};
      for (const v of data.verdicts || []) byId[v.id] = v;
      setRefine({ result: data, byId, error: '', showUnrelated: false });
    } catch (err) {
      setRefine(r => ({ ...r, error: err.message }));
    }
    setBusy(false);
  }

  const r = refine.result;
  const u = r?.usage;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={run} disabled={busy || !results.length} title={`Ask Claude (${model}) which of these listings are the part you searched for. Costs tokens; runs only when pressed.`}
          style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', border: '1px solid #185FA5', borderRadius: 20, background: r ? '#fff' : '#185FA5', color: r ? '#185FA5' : '#fff', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Asking Claude…' : r ? 'Refine again' : '✦ Refine with Claude'}
        </button>
        {r && u && (
          <span style={{ fontSize: 11, color: '#777' }}>
            {r.cached ? 'cached answer' : `${(u.inputTokens ?? 0).toLocaleString()} in / ${(u.outputTokens ?? 0).toLocaleString()} out tokens`}
            {r.listingsSent < r.listingsTotal ? ` · judged the first ${r.listingsSent} of ${r.listingsTotal}` : ''}
          </span>
        )}
        {refine.error && <span style={{ fontSize: 12, color: '#A32D2D' }}>{refine.error}</span>}
      </div>
      {r?.interpretation && (
        <div style={{ fontSize: 13, background: '#F7F9FC', border: '1px solid #e5e5e5', borderRadius: 10, padding: '8px 12px' }}>
          <div><strong>Reading your search:</strong> {r.interpretation.summary}
            {r.interpretation.partNumber && <> · part <strong>{r.interpretation.partNumber}</strong></>}
            {r.interpretation.manufacturer && <> · {r.interpretation.manufacturer}</>}
            <span style={{ color: '#999', fontSize: 11 }}> · {r.interpretation.confidence} confidence</span>
          </div>
          {r.suggestedQueries?.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Try:</span>
              {r.suggestedQueries.map(q => (
                <button key={q} type="button" onClick={() => onSearch(q)} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>{q}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
