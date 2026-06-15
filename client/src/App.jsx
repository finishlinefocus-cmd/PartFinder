import React, { useEffect, useMemo, useState } from 'react';

// Catalog category names follow a "<COMPANY> <TYPE>" pattern (e.g. "BESAM CONTROLS",
// "DORMA PARTS", "HORTON OPER/MTR", "STANLEY NEW"). Split a category into the company
// it belongs to and the part-type sub-category so the tree can nest one under the other.
const CATEGORY_TYPES = ['CONTROLS', 'OPER/MTR', 'PARTS', 'NEW'];
function splitCategory(rawName) {
  const name = String(rawName || '').trim();
  const upper = name.toUpperCase();
  for (const type of CATEGORY_TYPES) {
    if (upper.endsWith(' ' + type) && upper.length > type.length + 1) {
      return { company: name.slice(0, name.length - type.length - 1).trim(), sub: type };
    }
  }
  return { company: name || 'Uncategorized', sub: '' };
}

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
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorItemSearch, setVendorItemSearch] = useState('');
  const [openCats, setOpenCats] = useState(() => new Set());
  const [showEmptyVendors, setShowEmptyVendors] = useState(false);
  // Price-list import (any user can upload a distributor's updated parts/price list).
  const [importTarget, setImportTarget] = useState('');
  const [importCsvText, setImportCsvText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importDefaultCategory, setImportDefaultCategory] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

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

  function openImport(id) {
    setImportTarget(id);
    setImportCsvText('');
    setImportFileName('');
    setImportDefaultCategory('');
    setImportResult(null);
    setImportError('');
  }
  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError('');
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => setImportCsvText(String(reader.result || ''));
    reader.onerror = () => setImportError('Could not read that file.');
    reader.readAsText(file);
  }
  async function runImport() {
    if (!importTarget) return;
    if (!importCsvText.trim()) { setImportError('Choose a CSV file or paste rows first.'); return; }
    setImportBusy(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await fetch('/api/distributors/' + encodeURIComponent(importTarget) + '/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importCsvText, defaultCategory: importDefaultCategory.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || 'Import failed.'); setImportBusy(false); return; }
      setImportResult(data);
      await loadDistributors();
      await loadCatalog('');
      selectVendor(importTarget);
    } catch (err) {
      setImportError('Could not reach the server.');
    }
    setImportBusy(false);
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

  // Index every catalog item by distributor -> category, so a vendor's items
  // become a browsable set of category groups instead of one endless table.
  const vendorIndex = useMemo(() => {
    const map = {};
    for (const it of catalogItems) {
      const vid = it.distributorId || it.distributor || 'unknown';
      if (!map[vid]) map[vid] = { id: vid, name: it.distributor || vid, count: 0, categories: {} };
      map[vid].count += 1;
      const cat = (it.category && String(it.category).trim()) || 'Uncategorized';
      (map[vid].categories[cat] = map[vid].categories[cat] || []).push(it);
    }
    return map;
  }, [catalogItems]);

  // Master vendor list (from /api/distributors) split into "has data" vs "empty",
  // with live counts preferred from the loaded catalog. Data vendors sort by size.
  const vendorCount = (d) => vendorIndex[d.id]?.count ?? d.itemCount ?? 0;
  const dataVendors = useMemo(() => {
    const needle = distributorSearch.trim().toLowerCase();
    return distributors
      .filter(d => vendorCount(d) > 0)
      .filter(d => !needle || String(d.name || '').toLowerCase().includes(needle))
      .sort((a, b) => vendorCount(b) - vendorCount(a));
  }, [distributors, vendorIndex, distributorSearch]);
  const emptyVendors = useMemo(
    () => distributors.filter(d => vendorCount(d) === 0).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [distributors, vendorIndex]
  );

  const selectedVendor = useMemo(
    () => distributors.find(d => d.id === selectedVendorId) || null,
    [distributors, selectedVendorId]
  );

  // Categories of the selected vendor, sorted largest-first, filtered by the
  // within-vendor search box. When searching, only matching items/categories show.
  const selectedCategories = useMemo(() => {
    if (!selectedVendorId) return [];
    const entry = vendorIndex[selectedVendorId];
    if (!entry) return [];
    const needle = vendorItemSearch.trim().toLowerCase();
    const match = (it) => !needle || [it.description, it.addisonPart, it.manufacturerPart, it.category, it.condition]
      .some(v => String(v || '').toLowerCase().includes(needle));
    return Object.entries(entry.categories)
      .map(([name, items]) => ({ name, items: needle ? items.filter(match) : items }))
      .filter(g => g.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length);
  }, [selectedVendorId, vendorIndex, vendorItemSearch]);

  // Nest the flat categories under their company: Company → Sub-category (part type) → items.
  // A company with only a general (typeless) category renders its items directly.
  const selectedCompanies = useMemo(() => {
    const companies = {};
    for (const group of selectedCategories) {
      const { company, sub } = splitCategory(group.name);
      if (!companies[company]) companies[company] = { name: company, count: 0, subs: [] };
      companies[company].subs.push({ name: sub || company, isGeneral: !sub, items: group.items });
      companies[company].count += group.items.length;
    }
    return Object.values(companies)
      .map(c => ({ ...c, subs: c.subs.slice().sort((a, b) => b.items.length - a.items.length) }))
      .sort((a, b) => b.count - a.count);
  }, [selectedCategories]);

  function selectVendor(id) {
    setSelectedVendorId(id);
    setVendorItemSearch('');
    setOpenCats(new Set());
  }
  function toggleCat(name) {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

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
    vendorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 12 },
    vendorCard: { textAlign: 'left', border: '1px solid #e5e5e5', borderRadius: 10, padding: '12px 14px', background: '#fff', cursor: 'pointer', transition: 'all .12s' },
    vendorCardActive: { borderColor: '#185FA5', background: '#F2F8FE', boxShadow: '0 0 0 1px #185FA5 inset' },
    vendorName: { fontWeight: 700, fontSize: 14, marginBottom: 2 },
    vendorMeta: { fontSize: 12, color: '#777' },
    catHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 14px', border: '1px solid #e5e5e5', borderRadius: 10, background: '#fafafa', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginTop: 8 },
    subCatHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #eee', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginTop: 6 },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 1000, overflowY: 'auto' },
    modalCard: { background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    catCount: { fontSize: 12, fontWeight: 700, color: '#185FA5', background: '#E6F1FB', borderRadius: 20, padding: '2px 10px' },
    catItem: { display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 12, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f0f0f0' },
    catItemThumb: { width: 52, height: 52, objectFit: 'contain', background: '#f7f7f7', border: '1px solid #eee', borderRadius: 6 },
    pill: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' },
  };

  const sortBtnStyle = (active) => ({ fontSize: 12, padding: '5px 12px', border: '1px solid #ddd', borderRadius: 20, background: active ? '#E6F1FB' : '#fff', color: active ? '#185FA5' : '#666', cursor: 'pointer' });
  const connectionBadgeStyle = (connection) => {
    const level = connection?.level || '';
    if (level === 'solid-catalog') return { ...styles.connectionBadge, background: '#E8F5EA', color: '#2F6F3E' };
    if (level === 'page-index' || level === 'category-index') return { ...styles.connectionBadge, background: '#FFF4D6', color: '#8A5A00' };
    return { ...styles.connectionBadge, background: '#FCEBEB', color: '#A32D2D' };
  };

  // Shared renderer for a list of catalog item rows (used at company level when there
  // is only a general sub-category, and within each part-type sub-category otherwise).
  const renderItems = (items) => (
    <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
      {items.map(item => (
        <div key={item.id} style={styles.catItem}>
          {item.thumbnail || item.image ? (
            <a href={item.image || item.thumbnail} target="_blank" rel="noreferrer" title="Open full-size image">
              <img src={item.thumbnail || item.image} alt={item.description || item.addisonPart} style={styles.catItemThumb} />
            </a>
          ) : (
            <div style={{ ...styles.catItemThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10 }}>no image</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{item.description || '—'}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
              Part <strong>{item.addisonPart || '—'}</strong>{item.manufacturerPart ? ` · Mfg ${item.manufacturerPart}` : ''}{item.condition ? ` · ${item.condition}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.priceCell}>{item.price ? '$' + Number(item.price).toFixed(2) : (item.priceLabel || '—')}</div>
            {item.link && <a href={item.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#185FA5' }}>source ↗</a>}
          </div>
        </div>
      ))}
    </div>
  );

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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Distributor catalogs</div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  {catalogUpdatedAt ? 'Last refreshed ' + new Date(catalogUpdatedAt).toLocaleString() : 'No catalog refresh saved yet.'}
                  {' · '}{dataVendors.length} with data · {emptyVendors.length} empty
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={styles.secondaryButton} onClick={refreshConnectedDistributors} disabled={refreshingConnected || refreshingAutomaticsMore || !!refreshingDistributor}>
                  {refreshingConnected ? 'Refreshing all...' : 'Refresh all connected'}
                </button>
                <button style={styles.secondaryButton} onClick={refreshAutomaticsAndMore} disabled={refreshingAutomaticsMore || !!refreshingDistributor}>
                  {refreshingAutomaticsMore ? 'Refreshing A&M...' : 'Refresh A&M categories'}
                </button>
                <button style={styles.secondaryButton} onClick={() => loadCatalog('')} disabled={catalogLoading}>
                  {catalogLoading ? 'Loading...' : 'Reload'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label style={styles.label}>Jump to a distributor</label>
                <select style={styles.input} value={selectedVendorId} onChange={e => selectVendor(e.target.value)}>
                  <option value="">Select a distributor…</option>
                  {dataVendors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({vendorCount(d).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Filter distributors</label>
                <input style={styles.input} value={distributorSearch} onChange={e => setDistributorSearch(e.target.value)} placeholder="e.g. Addison, Stanley, BEA" />
              </div>
            </div>

            <div style={styles.vendorGrid}>
              {dataVendors.length === 0 ? (
                <div style={{ color: '#999', fontSize: 13 }}>No distributors with saved data{distributorSearch ? ' match your filter.' : ' yet — run a refresh.'}</div>
              ) : dataVendors.map(d => (
                <button key={d.id} onClick={() => selectVendor(d.id)} style={{ ...styles.vendorCard, ...(selectedVendorId === d.id ? styles.vendorCardActive : {}) }}>
                  <div style={styles.vendorName}>{d.name}</div>
                  <div style={styles.vendorMeta}>{vendorCount(d).toLocaleString()} items · {Object.keys(vendorIndex[d.id]?.categories || {}).length} categories</div>
                </button>
              ))}
            </div>

            {emptyVendors.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <button style={{ ...styles.pill, background: '#fafafa' }} onClick={() => setShowEmptyVendors(v => !v)}>
                  {showEmptyVendors ? '▾' : '▸'} Not yet populated ({emptyVendors.length})
                </button>
                {showEmptyVendors && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 10 }}>
                    {emptyVendors.map(d => (
                      <div key={d.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>no items yet</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button style={{ ...styles.pill, background: '#E6F1FB', color: '#185FA5', borderColor: '#BcdcF5' }} onClick={() => openImport(d.id)}>⬆ Price list</button>
                          <button style={styles.pill} onClick={() => refreshDistributor(d.id)} disabled={!!refreshingDistributor || refreshingConnected}>
                            {refreshingDistributor === d.id ? '…' : 'Refresh'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {catalogError && <div style={styles.error}>{catalogError}</div>}

          {selectedVendor && (
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedVendor.name}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{vendorCount(selectedVendor).toLocaleString()} items · {selectedCompanies.length} companies · {selectedCategories.length} categories{vendorItemSearch ? ' matching' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={{ ...styles.pill, background: '#E6F1FB', color: '#185FA5', borderColor: '#BcdcF5' }} onClick={() => openImport(selectedVendor.id)}>⬆ Update price list</button>
                  <button style={styles.pill} onClick={() => selectVendor('')}>✕ Close</button>
                </div>
              </div>
              <input style={styles.input} value={vendorItemSearch} onChange={e => setVendorItemSearch(e.target.value)} placeholder={`Search within ${selectedVendor.name}… (part #, description, category)`} />

              <div style={{ marginTop: 10 }}>
                {selectedCompanies.length === 0 ? (
                  <div style={{ color: '#999', fontSize: 13, padding: '10px 2px' }}>No items{vendorItemSearch ? ` match “${vendorItemSearch}”.` : '.'}</div>
                ) : selectedCompanies.map(company => {
                  const companyKey = 'co:' + company.name;
                  const companyOpen = openCats.has(companyKey) || !!vendorItemSearch;
                  const singleGeneral = company.subs.length === 1 && company.subs[0].isGeneral;
                  return (
                    <div key={company.name}>
                      <button style={styles.catHeader} onClick={() => toggleCat(companyKey)}>
                        <span>{companyOpen ? '▾' : '▸'} {company.name}</span>
                        <span style={styles.catCount}>{company.count}</span>
                      </button>
                      {companyOpen && (
                        singleGeneral ? (
                          renderItems(company.subs[0].items)
                        ) : (
                          <div style={{ paddingLeft: 16 }}>
                            {company.subs.map(sub => {
                              const subKey = 'sub:' + company.name + '|' + sub.name;
                              const subOpen = openCats.has(subKey) || !!vendorItemSearch;
                              return (
                                <div key={subKey}>
                                  <button style={styles.subCatHeader} onClick={() => toggleCat(subKey)}>
                                    <span>{subOpen ? '▾' : '▸'} {sub.name}</span>
                                    <span style={styles.catCount}>{sub.items.length}</span>
                                  </button>
                                  {subOpen && renderItems(sub.items)}
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!selectedVendor && dataVendors.length > 0 && (
            <div style={styles.empty}>Pick a distributor above to browse its catalog by category.</div>
          )}
        </>
      )}

      {importTarget && (
        <div style={styles.modalOverlay} onClick={() => !importBusy && setImportTarget('')}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Update price list</div>
              <button style={styles.pill} onClick={() => !importBusy && setImportTarget('')}>✕</button>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              {(distributors.find(d => d.id === importTarget) || {}).name || importTarget}
            </div>

            <div style={{ background: '#F7FAFE', border: '1px solid #E2EDF8', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#456', marginBottom: 14, lineHeight: 1.5 }}>
              Upload the CSV the distributor sent (Excel → <em>Save As → CSV</em>). The first row must be column headers.
              Recognized columns: <strong>Part Number</strong> (required), Description, Price, Category, Manufacturer&nbsp;Part, Condition, Image, Link.
              <br />Matching parts are <strong>updated</strong>, new parts are <strong>added</strong>, and anything already in our
              catalog that isn’t in this file <strong>stays</strong> — nothing is deleted.
            </div>

            <label style={styles.label}>Price list file (.csv, .tsv, .txt)</label>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onImportFile} style={{ marginBottom: 6 }} />
            {importFileName && <div style={{ fontSize: 12, color: '#185FA5', marginBottom: 8 }}>{importFileName} · {importCsvText ? importCsvText.split(/\r?\n/).filter(Boolean).length + ' lines' : 'reading…'}</div>}

            <label style={{ ...styles.label, marginTop: 6 }}>Or paste rows</label>
            <textarea
              style={{ ...styles.input, minHeight: 90, fontFamily: 'monospace', fontSize: 12 }}
              value={importCsvText}
              onChange={e => { setImportCsvText(e.target.value); setImportFileName(''); }}
              placeholder={'Part Number,Description,Price,Category\n1174,ADC 90 Swing Control,249.00,ADC CONTROLS'}
            />

            <label style={{ ...styles.label, marginTop: 10 }}>Default category for rows without one (optional)</label>
            <input style={styles.input} value={importDefaultCategory} onChange={e => setImportDefaultCategory(e.target.value)} placeholder="e.g. BESAM PARTS" />

            {importError && <div style={{ ...styles.error, marginTop: 12 }}>{importError}</div>}
            {importResult && (
              <div style={{ marginTop: 12, background: '#E8F5EA', border: '1px solid #CDE8D2', color: '#2F6F3E', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                Imported into <strong>{importResult.distributor}</strong>: {importResult.added} added · {importResult.updated} updated
                {importResult.skipped ? ` · ${importResult.skipped} skipped (no part #)` : ''}. {importResult.totalForDistributor.toLocaleString()} parts total.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={styles.pill} onClick={() => setImportTarget('')} disabled={importBusy}>Close</button>
              <button style={{ ...styles.button, opacity: importBusy ? 0.6 : 1 }} onClick={runImport} disabled={importBusy}>
                {importBusy ? 'Importing…' : 'Import price list'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
