import React, { useEffect, useMemo, useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [condition, setCondition] = useState('Any');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState('price');
  const [distributors, setDistributors] = useState([]);
  const [distributorSearch, setDistributorSearch] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [refreshingDistributor, setRefreshingDistributor] = useState('');
  const [refreshingAutomaticsMore, setRefreshingAutomaticsMore] = useState(false);
  const [refreshingConnected, setRefreshingConnected] = useState(false);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    loadDistributors();
    loadCatalog();
  }, []);

  async function loadDistributors() {
    const res = await fetch('/api/distributors');
    const data = await res.json();
    setDistributors(data.distributors || []);
  }

  async function loadCatalog(q = catalogSearch) {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const res = await fetch('/api/distributor-catalog?q=' + encodeURIComponent(q));
      const data = await res.json();
      setCatalogItems(data.items || []);
      setCatalogUpdatedAt(data.updatedAt || null);
    } catch (err) {
      setCatalogError('Catalog load failed: ' + err.message);
    }
    setCatalogLoading(false);
  }

  async function refreshDistributor(id) {
    setRefreshingDistributor(id);
    setCatalogError('');
    try {
      const res = await fetch('/api/distributors/' + encodeURIComponent(id) + '/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      await loadDistributors();
      await loadCatalog();
    } catch (err) {
      setCatalogError('Refresh failed: ' + err.message);
    }
    setRefreshingDistributor('');
  }

  async function refreshAutomaticsAndMore() {
    setRefreshingAutomaticsMore(true);
    setCatalogError('');
    try {
      const res = await fetch('/api/distributors/refresh-automatics-and-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      await loadDistributors();
      await loadCatalog();
      if (data.errors?.length) {
        setCatalogError(`Refresh completed with ${data.errors.length} category warning(s).`);
      }
    } catch (err) {
      setCatalogError('Automatics & More refresh failed: ' + err.message);
    }
    setRefreshingAutomaticsMore(false);
  }

  async function refreshConnectedDistributors() {
    setRefreshingConnected(true);
    setCatalogError('');
    try {
      const res = await fetch('/api/distributors/refresh-connected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      await loadDistributors();
      await loadCatalog();
      if (data.errors?.length) {
        setCatalogError(`Refresh completed with ${data.errors.length} source warning(s).`);
      }
    } catch (err) {
      setCatalogError('Connected source refresh failed: ' + err.message);
    }
    setRefreshingConnected(false);
  }

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

  const catalogStats = useMemo(() => {
    const byDistributor = {};
    catalogItems.forEach(item => {
      byDistributor[item.distributor] = (byDistributor[item.distributor] || 0) + 1;
    });
    return byDistributor;
  }, [catalogItems]);

  const filteredDistributors = useMemo(() => {
    const needle = distributorSearch.trim().toLowerCase();
    if (!needle) return distributors;
    return distributors.filter(d => [
      d.name,
      d.website,
      d.type,
      d.notes,
      ...(d.categories || []).map(c => c.name),
    ].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [distributors, distributorSearch]);

  const styles = {
    wrap: { maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#222' },
    header: { fontSize: 28, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.5px' },
    sub: { color: '#666', marginBottom: 24, fontSize: 14 },
    tabs: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e5e5' },
    tab: { padding: '10px 12px', border: 'none', borderBottom: '2px solid transparent', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    tabActive: { color: '#185FA5', borderBottomColor: '#185FA5' },
    card: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, marginBottom: 16 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    label: { display: 'block', fontSize: 12, color: '#666', marginBottom: 4 },
    input: { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
    button: { width: '100%', padding: 12, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
    secondaryButton: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#222', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    linkButton: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#222', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' },
    sortBar: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' },
    result: { background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, marginBottom: 10, display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 16, alignItems: 'start' },
    thumb: { width: 80, height: 80, objectFit: 'contain', background: '#f5f5f5', borderRadius: 8 },
    thumbPlaceholder: { width: 80, height: 80, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10 },
    title: { fontSize: 14, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 },
    source: { fontSize: 12, color: '#666', marginBottom: 4 },
    badge: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#E6F1FB', color: '#185FA5', marginRight: 6 },
    connectionBadge: { display: 'inline-block', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 800, marginTop: 6 },
    price: { fontSize: 20, fontWeight: 600, textAlign: 'right' },
    ship: { fontSize: 12, color: '#666', textAlign: 'right', marginBottom: 8 },
    viewBtn: { fontSize: 12, padding: '5px 12px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', textDecoration: 'none', color: '#222', cursor: 'pointer', display: 'inline-block' },
    error: { background: '#FCEBEB', color: '#A32D2D', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 },
    empty: { textAlign: 'center', padding: '3rem 1rem', color: '#999' },
    tableWrap: { overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: 12, background: '#fff' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e5e5', color: '#666', background: '#fafafa', whiteSpace: 'nowrap' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
    catalogThumb: { width: 64, height: 64, objectFit: 'contain', background: '#f7f7f7', border: '1px solid #eee', borderRadius: 8, display: 'block' },
    catalogThumbEmpty: { width: 64, height: 64, background: '#f7f7f7', border: '1px solid #eee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 10 },
    priceCell: { fontWeight: 800, color: '#185FA5', whiteSpace: 'nowrap' },
    priceNote: { fontSize: 11, color: '#777', marginTop: 3, whiteSpace: 'nowrap' },
  };

  const sortBtnStyle = (active) => ({ fontSize: 12, padding: '5px 12px', border: '1px solid #ddd', borderRadius: 20, background: active ? '#E6F1FB' : '#fff', color: active ? '#185FA5' : '#666', cursor: 'pointer' });
  const connectionBadgeStyle = (connection) => {
    const level = connection?.level || '';
    if (level === 'solid-catalog') return { ...styles.connectionBadge, background: '#E8F5EA', color: '#2F6F3E' };
    if (level === 'page-index' || level === 'category-index') return { ...styles.connectionBadge, background: '#FFF4D6', color: '#8A5A00' };
    return { ...styles.connectionBadge, background: '#FCEBEB', color: '#A32D2D' };
  };

  return (
    <div style={styles.wrap}>
      <h1 style={styles.header}>PartFinder</h1>
      <div style={styles.sub}>Search electronic parts and maintain distributor catalogs in one place.</div>

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(activeTab === 'search' ? styles.tabActive : {}) }} onClick={() => setActiveTab('search')}>Search</button>
        <button style={{ ...styles.tab, ...(activeTab === 'distributors' ? styles.tabActive : {}) }} onClick={() => setActiveTab('distributors')}>Distributors</button>
      </div>

      {activeTab === 'search' && (
        <>
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
                    {r.catalog?.addisonPart && <span style={styles.badge}>Part #{r.catalog.addisonPart}</span>}
                    {r.catalog?.manufacturerPart && <span style={styles.badge}>Mfg {r.catalog.manufacturerPart}</span>}
                    <span style={styles.badge}>{r.condition}</span>
                  </div>
                  <div>
                    <div style={styles.price}>{r.catalog?.priceLabel || (r.price > 0 ? '$' + r.price.toFixed(2) : 'Catalog')}</div>
                    <div style={styles.ship}>{r.shipping > 0 ? '+ $' + r.shipping.toFixed(2) + ' ship' : r.via === 'catalog' ? 'Saved source' : 'Free ship'}</div>
                    <a href={r.link} target="_blank" rel="noreferrer" style={styles.viewBtn}>View ↗</a>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {activeTab === 'distributors' && (
        <>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Managed distributor catalogs</div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  {catalogUpdatedAt ? 'Last refreshed ' + new Date(catalogUpdatedAt).toLocaleString() : 'No catalog refresh has been saved yet.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={styles.secondaryButton} onClick={refreshConnectedDistributors} disabled={refreshingConnected || refreshingAutomaticsMore || !!refreshingDistributor}>
                  {refreshingConnected ? 'Refreshing all...' : 'Refresh all connected'}
                </button>
                <button style={styles.secondaryButton} onClick={refreshAutomaticsAndMore} disabled={refreshingAutomaticsMore || !!refreshingDistributor}>
                  {refreshingAutomaticsMore ? 'Refreshing A&M...' : 'Refresh A&M categories'}
                </button>
                <button style={styles.secondaryButton} onClick={() => loadCatalog()} disabled={catalogLoading}>
                  {catalogLoading ? 'Loading...' : 'Reload table'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Search distributors</label>
              <input
                style={styles.input}
                value={distributorSearch}
                onChange={e => setDistributorSearch(e.target.value)}
                placeholder="e.g. Horton, BEA, Service Spring, door controls"
              />
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredDistributors.length === 0 ? (
                <div style={{ color: '#999', fontSize: 13, padding: '12px 2px' }}>No distributors match “{distributorSearch}”.</div>
              ) : filteredDistributors.map(d => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.name}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{d.website}</div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{d.itemCount || catalogStats[d.name] || 0} saved items · {d.categories?.length || 0} categories</div>
                    <span style={connectionBadgeStyle(d.connection)}>{d.connection?.label || (d.connected ? 'Connected' : 'Not connected')}</span>
                    <div style={{ color: d.connection?.needsStrongerConnection ? '#8A5A00' : '#2F6F3E', fontSize: 12, marginTop: 6 }}>{d.connection?.clue || d.notes}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <a href={d.searchUrl || d.website} target="_blank" rel="noreferrer" style={styles.linkButton}>Open source</a>
                    <button style={styles.secondaryButton} onClick={() => refreshDistributor(d.id)} disabled={!!refreshingDistributor || refreshingConnected}>
                      {refreshingDistributor === d.id ? 'Refreshing...' : 'Refresh catalog'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {catalogError && <div style={styles.error}>{catalogError}</div>}

          <div style={styles.card}>
            <div style={styles.row}>
              <div>
                <label style={styles.label}>Search saved catalog</label>
                <input
                  style={styles.input}
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadCatalog(catalogSearch)}
                  placeholder="e.g. Horton 2160, RC4160, BEA"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                <button style={{ ...styles.secondaryButton, height: 36 }} onClick={() => loadCatalog(catalogSearch)} disabled={catalogLoading}>Search table</button>
                <button style={{ ...styles.secondaryButton, height: 36 }} onClick={() => { setCatalogSearch(''); loadCatalog(''); }} disabled={catalogLoading}>Clear</button>
              </div>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Image</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Distributor</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Part #</th>
                  <th style={styles.th}>Mfg #</th>
                  <th style={styles.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.length === 0 ? (
                  <tr><td style={styles.td} colSpan="7">{catalogLoading ? 'Loading catalog...' : 'No saved catalog rows yet.'}</td></tr>
                ) : catalogItems.map(item => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      {item.thumbnail || item.image ? (
                        <a href={item.image || item.thumbnail} target="_blank" rel="noreferrer" title="Open full-size image">
                          <img src={item.thumbnail || item.image} alt={item.description || item.addisonPart} style={styles.catalogThumb} />
                        </a>
                      ) : (
                        <div style={styles.catalogThumbEmpty}>no image</div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.priceCell}>{item.price ? '$' + Number(item.price).toFixed(2) : item.priceLabel || '—'}</div>
                      {!item.price && item.priceLabel && <div style={styles.priceNote}>Addison login required</div>}
                    </td>
                    <td style={styles.td}>{item.distributor}</td>
                    <td style={styles.td}>{item.category}</td>
                    <td style={styles.td}><strong>{item.addisonPart}</strong></td>
                    <td style={styles.td}>{item.manufacturerPart || '—'}</td>
                    <td style={styles.td}>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
