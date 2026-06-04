import React, { useState } from 'react';

export default function App() {
  const [query, setQuery] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [condition, setCondition] = useState('Any');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState('price');

  async function runSearch(e) {
    if (e) e.preventDefault();
    if (!query && !partNumber) {
      setError('Enter a part name or number to search.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);
    const q = [manufacturer, query, partNumber].filter(Boolean).join(' ');
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&condition=' + condition);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError('Search failed: ' + err.message);
      setResults([]);
    }
    setLoading(false);
  }

  function sortedResults() {
    const copy = [...results];
    if (sortBy === 'price') return copy.sort((a, b) => a.price - b.price);
    if (sortBy === 'total') return copy.sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping));
    if (sortBy === 'source') return copy.sort((a, b) => a.source.localeCompare(b.source));
    return copy;
  }

  const styles = {
    wrap: { maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#222' },
    header: { fontSize: 28, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.5px' },
    sub: { color: '#666', marginBottom: 24, fontSize: 14 },
    card: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 16 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    label: { display: 'block', fontSize: 12, color: '#666', marginBottom: 4 },
    input: { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
    button: { width: '100%', padding: 12, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
    sortBar: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' },
    result: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, marginBottom: 10, display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, alignItems: 'start' },
    thumb: { width: 80, height: 80, objectFit: 'contain', background: '#f5f5f5', borderRadius: 8 },
    thumbPlaceholder: { width: 80, height: 80, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10 },
    title: { fontSize: 14, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 },
    source: { fontSize: 12, color: '#666', marginBottom: 4 },
    badge: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#E6F1FB', color: '#185FA5', marginRight: 6 },
    price: { fontSize: 20, fontWeight: 600, textAlign: 'right' },
    ship: { fontSize: 12, color: '#666', textAlign: 'right', marginBottom: 8 },
    viewBtn: { fontSize: 12, padding: '5px 12px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', textDecoration: 'none', color: '#222', cursor: 'pointer', display: 'inline-block' },
    error: { background: '#FCEBEB', color: '#A32D2D', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 },
    empty: { textAlign: 'center', padding: '3rem 1rem', color: '#999' },
  };

  const sortBtnStyle = (active) => ({ fontSize: 12, padding: '5px 12px', border: '1px solid #ddd', borderRadius: 20, background: active ? '#E6F1FB' : '#fff', color: active ? '#185FA5' : '#666', cursor: 'pointer' });

  return (
    <div style={styles.wrap}>
      <h1 style={styles.header}>PartFinder</h1>
      <div style={styles.sub}>Search electronic parts across multiple distributors at once.</div>

      <div style={styles.card}>
        <div style={styles.row}>
          <div>
            <label style={styles.label}>Part name or description</label>
            <input style={styles.input} value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. LiftMaster circuit board" />
          </div>
          <div>
            <label style={styles.label}>Part number</label>
            <input style={styles.input} value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="e.g. 41A5021-1" />
          </div>
        </div>
        <div style={styles.row}>
          <div>
            <label style={styles.label}>Manufacturer</label>
            <input style={styles.input} value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="e.g. LiftMaster, GRI" />
          </div>
          <div>
            <label style={styles.label}>Condition</label>
            <select style={styles.input} value={condition} onChange={e => setCondition(e.target.value)}>
              <option>Any</option>
              <option>New</option>
              <option>Used</option>
            </select>
          </div>
        </div>
        <button style={styles.button} onClick={runSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {searched && !loading && results.length === 0 && !error && (
        <div style={styles.empty}>No results found. Try a shorter or simpler search term.</div>
      )}

      {results.length > 0 && (
        <>
          <div style={styles.sortBar}>
            <span style={{ fontSize: 12, color: '#666' }}>{results.length} results — Sort:</span>
            <button style={sortBtnStyle(sortBy === 'price')} onClick={() => setSortBy('price')}>Price</button>
            <button style={sortBtnStyle(sortBy === 'total')} onClick={() => setSortBy('total')}>Total w/ shipping</button>
            <button style={sortBtnStyle(sortBy === 'source')} onClick={() => setSortBy('source')}>Source</button>
          </div>
          {sortedResults().map((r, i) => (
            <div key={i} style={styles.result}>
              {r.thumbnail ? <img src={r.thumbnail} style={styles.thumb} alt="" /> : <div style={styles.thumbPlaceholder}>no image</div>}
              <div>
                <div style={styles.title}>{r.title}</div>
                <div style={styles.source}>{r.source}</div>
                <span style={styles.badge}>{r.condition}</span>
              </div>
              <div>
                <div style={styles.price}>${r.price.toFixed(2)}</div>
                <div style={styles.ship}>{r.shipping > 0 ? '+ $' + r.shipping.toFixed(2) + ' ship' : 'Free ship'}</div>
                <a href={r.link} target="_blank" rel="noreferrer" style={styles.viewBtn}>View ↗</a>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}