import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

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

// PartFinder lives under shared "tools", so every department can open every lane.
// A user's department only decides which lane Home surfaces first. Role is picked
// manually for now via the header switcher; later Nexus can pass it in on load.
const ROLES = {
  sales:      { label: 'Sales',      home: 'pricing',      blurb: 'margin and suggested retail price' },
  field:      { label: 'Field',      home: 'availability', blurb: 'what is in stock and where' },
  accounting: { label: 'Accounting', home: 'pricing',      blurb: 'our cost and margin health' },
};

// Human labels for each lane. Used by Home so the copy stays in sync with the nav.
const TAB_LABELS = {
  home: 'Home',
  search: 'Price Search',
  availability: 'Availability',
  pricing: 'Pricing Engine',
  distributors: 'Price Lists',
  changes: 'Changes & Alerts',
};

// Home dashboard tiles per department. The FIRST lane is the role's primary
// (rendered large); the rest are quick links. Everyone can reach every lane.
const HOME_TILES = {
  sales: ['pricing', 'search', 'availability', 'changes'],
  field: ['availability', 'search', 'pricing', 'changes'],
  accounting: ['pricing', 'changes', 'distributors', 'availability'],
};
const TILE_META = {
  search: { icon: '🔍', title: 'Price Search', desc: 'Live prices across Google, Amazon, eBay, Walmart.' },
  availability: { icon: '📦', title: 'Availability', desc: 'What is on our shelves right now.' },
  pricing: { icon: '💰', title: 'Pricing Engine', desc: 'Cost, margin, and a competitive retail price.' },
  changes: { icon: '🔔', title: 'Changes & Alerts', desc: 'Price moves and parts to watch.' },
  distributors: { icon: '📋', title: 'Price Lists', desc: 'Distributor catalogs and imports.' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [role, setRole] = useState('sales'); // department lens for the Home dashboard
  // ── ONE SEARCH (Sterling 2026-07-09): the landing is a single bar that fans out to
  //    every tool at once — web prices, our shelf, our cost/suggested retail, and the
  //    distributor catalogs — rendered like a shopping product page (hero + buying
  //    options cheapest-first + more options).
  const [uQ, setUQ] = useState('');
  const [uLoading, setULoading] = useState(false);
  const [uSearched, setUSearched] = useState(false);
  const [uWeb, setUWeb] = useState([]);
  const [uInv, setUInv] = useState([]);
  const [uCost, setUCost] = useState([]);
  const [uErr, setUErr] = useState('');
  async function runUnified(e) {
    if (e) e.preventDefault();
    const q = uQ.trim();
    if (!q) return;
    setULoading(true); setUErr(''); setUSearched(true);
    const grab = (url) => fetch(url).then(r => r.json()).catch(() => null);
    const [web, inv, cost] = await Promise.all([
      grab('/api/search?q=' + encodeURIComponent(q) + '&condition=Any'),
      grab('/api/inventory?q=' + encodeURIComponent(q)),
      grab('/api/cost?q=' + encodeURIComponent(q)),
    ]);
    if (!web && !inv && !cost) setUErr('Search failed — is the PartFinder API up?');
    setUWeb((web && web.results) || []);
    setUInv((inv && inv.items) || []);
    setUCost((cost && cost.items) || []);
    setULoading(false);
  }
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
  // Per-vendor mapping editor: each vendor formats consistently, so a one-time correction sticks.
  const [mapEdit, setMapEdit] = useState(null);       // { field: "Header Text" | "" }
  const [priceMode, setPriceMode] = useState('list'); // 'list' | 'net' — which price is the headline
  // Changes & Alerts tab: global recent import events + currently unavailable parts.
  const [changeEvents, setChangeEvents] = useState([]);
  const [availability, setAvailability] = useState(null); // { total, available, unavailable: [] }
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  // Availability lane: "do we already have this on the shelf?" (Sortly, mock for now).
  const [invQuery, setInvQuery] = useState('');
  const [invResults, setInvResults] = useState([]);
  const [invSource, setInvSource] = useState(null); // 'nexus' (live) | 'mock'
  const [invLoading, setInvLoading] = useState(false);
  const [invSearched, setInvSearched] = useState(false);
  const [invError, setInvError] = useState('');
  // Pricing Engine lane: our cost (QBO, mock for now) -> margin -> suggested retail.
  const [pcQuery, setPcQuery] = useState('');
  const [pcCostItems, setPcCostItems] = useState([]);
  const [pcSelected, setPcSelected] = useState(null);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcSearched, setPcSearched] = useState(false);
  const [pcError, setPcError] = useState('');
  const [pcMarket, setPcMarket] = useState('');       // competitor / market price (string input)
  const [pcTargetMargin, setPcTargetMargin] = useState('35'); // target margin %
  const [pcRetailOverride, setPcRetailOverride] = useState(''); // manual retail (string)
  // Home dashboard: small cross-lane summary for the role-aware tiles.
  const [homeSummary, setHomeSummary] = useState(null);
  const [homeLoading, setHomeLoading] = useState(false);

  useEffect(() => {
    loadDistributors();
    loadCatalog();
  }, []);

  // Load the change feed + availability whenever the Changes & Alerts tab is opened
  // (and after an import, which bumps the catalog through loadCatalog/selectVendor).
  useEffect(() => {
    if (activeTab === 'changes') loadAlerts();
    if (activeTab === 'home') loadHomeSummary();
  }, [activeTab]);

  async function loadHomeSummary() {
    setHomeLoading(true);
    try {
      const [invRes, costRes, availRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/cost'),
        fetch('/api/availability'),
      ]);
      const inv = await invRes.json();
      const cost = await costRes.json();
      const avail = await availRes.json();
      const items = inv.items || [];
      setHomeSummary({
        inStock: items.filter(i => i.status === 'in_stock').length,
        low: items.filter(i => i.status === 'low_stock').length,
        out: items.filter(i => i.status === 'out_of_stock').length,
        costCount: (cost.items || []).length,
        unavailable: avail && Array.isArray(avail.unavailable) ? avail.unavailable.length : 0,
        lowItems: items.filter(i => i.status === 'low_stock' || i.status === 'out_of_stock').slice(0, 4),
      });
    } catch {
      setHomeSummary(null);
    }
    setHomeLoading(false);
  }

  async function loadAlerts() {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const [chRes, avRes] = await Promise.all([
        fetch('/api/changes'),
        fetch('/api/availability'),
      ]);
      const chData = await chRes.json();
      const avData = await avRes.json();
      setChangeEvents(chData.events || []);
      setAvailability(avData || null);
    } catch (err) {
      setAlertsError('Could not load changes & alerts: ' + err.message);
    }
    setAlertsLoading(false);
  }

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
    setMapEdit(null);
    setPriceMode('list');
  }
  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError('');
    setImportResult(null);
    const reader = new FileReader();
    reader.onerror = () => setImportError('Could not read that file.');
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      // Excel: parse the workbook and convert the first sheet to CSV, then import as usual.
      reader.onload = () => {
        try {
          const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          setImportCsvText(XLSX.utils.sheet_to_csv(sheet));
        } catch (err) {
          setImportError('Could not read that Excel file: ' + (err.message || err));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => setImportCsvText(String(reader.result || ''));
      reader.readAsText(file);
    }
  }
  async function runImport(opts = {}) {
    if (!importTarget) return;
    if (!importCsvText.trim()) { setImportError('Choose a CSV file or paste rows first.'); return; }
    setImportBusy(true);
    setImportError('');
    if (!opts.keepResult) setImportResult(null);
    try {
      const body = { csv: importCsvText, defaultCategory: importDefaultCategory.trim() || undefined };
      // Re-import with the corrected column mapping / headline-price choice for this vendor.
      if (opts.overrides) body.overrides = opts.overrides;
      if (opts.priceMode) body.priceMode = opts.priceMode;
      const res = await fetch('/api/distributors/' + encodeURIComponent(importTarget) + '/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || 'Import failed.'); setImportBusy(false); return; }
      setImportResult(data);
      setMapEdit({ ...(data.mapping || {}) }); // seed the editor with what we read
      setPriceMode(data.priceMode || 'list');
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

  async function runInventorySearch(e, override) {
    if (e) e.preventDefault();
    const q = (override != null ? override : invQuery).trim();
    if (!q) {
      setInvError('Enter a part name, number, or manufacturer to check stock.');
      return;
    }
    setInvLoading(true);
    setInvError('');
    setInvSearched(true);
    try {
      const res = await fetch('/api/inventory?q=' + encodeURIComponent(q));
      const data = await res.json();
      setInvResults(data.items || []);
      setInvSource(data.source || null);
    } catch (err) {
      setInvError('Stock lookup failed: ' + err.message);
      setInvResults([]);
      setInvSource(null);
    }
    setInvLoading(false);
  }

  async function runCostLookup(e, override) {
    if (e) e.preventDefault();
    const q = (override != null ? override : pcQuery).trim();
    if (!q) {
      setPcError('Enter a part name, number, or manufacturer to price it.');
      return;
    }
    setPcLoading(true);
    setPcError('');
    setPcSearched(true);
    setPcSelected(null);
    setPcRetailOverride('');
    try {
      const res = await fetch('/api/cost?q=' + encodeURIComponent(q));
      const data = await res.json();
      const items = data.items || [];
      setPcCostItems(items);
      if (items.length > 0) setPcSelected(items[0]); // auto-pick the first match
    } catch (err) {
      setPcError('Cost lookup failed: ' + err.message);
      setPcCostItems([]);
    }
    setPcLoading(false);
  }

  // Suggested competitive retail: aim for the target margin, but if a market price
  // is known, slip just under it — never dropping below a 20% margin floor.
  const MIN_MARGIN = 0.20;
  function computePricing(cost, targetMarginPct, marketPrice) {
    const tm = Math.max(0, Math.min(95, Number(targetMarginPct) || 0)) / 100;
    const costPlus = tm < 1 ? cost / (1 - tm) : cost;
    const floor = cost / (1 - MIN_MARGIN);
    const market = Number(marketPrice) > 0 ? Number(marketPrice) : null;
    let suggested, basis;
    if (market) {
      const competitive = market * 0.97; // sit a touch under the market price
      suggested = Math.max(floor, Math.min(costPlus, competitive));
      if (suggested >= costPlus - 0.005) basis = 'target'; // market had room for full target margin
      else if (suggested <= floor + 0.005) basis = 'floor'; // market too tight, held the floor
      else basis = 'undercut'; // priced just under market
    } else {
      suggested = costPlus;
      basis = 'costplus';
    }
    suggested = Math.round(suggested * 100) / 100;
    return { suggested, basis, market, floor };
  }
  const marginPct = (price, cost) => (price > 0 ? ((price - cost) / price) * 100 : 0);
  const markupPct = (price, cost) => (cost > 0 ? ((price - cost) / cost) * 100 : 0);
  const marginBadgeStyle = (m) => {
    const base = { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 };
    if (m >= 30) return { ...base, background: '#E8F5EA', color: '#2F6F3E' };
    if (m >= 15) return { ...base, background: '#FFF4D6', color: '#8A5A00' };
    return { ...base, background: '#FCEBEB', color: '#A32D2D' };
  };

  const tileStat = (lane) => {
    const s = homeSummary;
    switch (lane) {
      case 'availability': return s ? `${s.inStock} in stock · ${s.low} low · ${s.out} out` : '…';
      case 'pricing': return s ? `${s.costCount} parts with cost on file` : '…';
      case 'changes': return s ? `${s.unavailable} part${s.unavailable === 1 ? '' : 's'} flagged unavailable` : '…';
      case 'distributors': return `${distributors.length} vendors · ${catalogItems.length} catalog parts`;
      case 'search': return 'Google · Amazon · eBay · Walmart';
      default: return '';
    }
  };
  const renderHomeTile = (lane, primary) => {
    const meta = TILE_META[lane];
    return (
      <button
        key={lane}
        onClick={() => setActiveTab(lane)}
        style={{
          textAlign: 'left', cursor: 'pointer', width: '100%', borderRadius: 12,
          padding: primary ? 20 : 16,
          border: primary ? '1px solid #185FA5' : '1px solid #e5e5e5',
          background: primary ? '#F2F8FE' : '#fff',
        }}
      >
        <div style={{ fontSize: primary ? 18 : 15, fontWeight: 700, marginBottom: 4 }}>{meta.icon} {meta.title}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{meta.desc}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5' }}>{tileStat(lane)}</div>
        {primary && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#185FA5' }}>Open {meta.title} →</div>}
      </button>
    );
  };

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
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #e5e5e5', marginBottom: 16 },
    tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    roleSwitch: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 },
    roleSelect: { padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#185FA5', background: '#fff', cursor: 'pointer' },
    inlineButton: { padding: '10px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
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
  const STOCK_LABELS = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' };
  const stockBadgeStyle = (status) => {
    const base = { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 };
    if (status === 'in_stock') return { ...base, background: '#E8F5EA', color: '#2F6F3E' };
    if (status === 'low_stock') return { ...base, background: '#FFF4D6', color: '#8A5A00' };
    return { ...base, background: '#FCEBEB', color: '#A32D2D' };
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

      <div style={styles.topBar}>
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(activeTab === 'home' ? styles.tabActive : {}) }} onClick={() => setActiveTab('home')}>Home</button>
          <button style={{ ...styles.tab, ...(activeTab === 'search' ? styles.tabActive : {}) }} onClick={() => setActiveTab('search')}>Price Search</button>
          <button style={{ ...styles.tab, ...(activeTab === 'availability' ? styles.tabActive : {}) }} onClick={() => setActiveTab('availability')}>Availability</button>
          <button style={{ ...styles.tab, ...(activeTab === 'pricing' ? styles.tabActive : {}) }} onClick={() => setActiveTab('pricing')}>Pricing Engine</button>
          <button style={{ ...styles.tab, ...(activeTab === 'distributors' ? styles.tabActive : {}) }} onClick={() => setActiveTab('distributors')}>Price Lists</button>
          <button style={{ ...styles.tab, ...(activeTab === 'changes' ? styles.tabActive : {}) }} onClick={() => setActiveTab('changes')}>
            Changes &amp; Alerts
            {availability && availability.unavailable && availability.unavailable.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#FCEBEB', color: '#A32D2D' }}>
                {availability.unavailable.length}
              </span>
            )}
          </button>
        </div>
        <div style={styles.roleSwitch}>
          <span style={{ fontSize: 12, color: '#666' }}>Viewing as</span>
          <select style={styles.roleSelect} value={role} onChange={e => setRole(e.target.value)}>
            {Object.entries(ROLES).map(([key, r]) => (
              <option key={key} value={key}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'home' && (
        <>
          {/* ONE SEARCH — every tool behind a single bar (web prices, our shelf,
              our cost/retail, distributor catalogs), shopping-page layout. */}
          <form onSubmit={runUnified} style={{ display: 'flex', gap: 10, margin: '18px auto 22px', maxWidth: 720 }}>
            <input
              value={uQ}
              onChange={e => setUQ(e.target.value)}
              placeholder="Search a part — number, name, or description…"
              style={{ flex: 1, padding: '13px 18px', fontSize: 16, border: '2px solid #dcdcdc', borderRadius: 999, outline: 'none' }}
            />
            <button type="submit" disabled={uLoading || !uQ.trim()}
              style={{ padding: '0 26px', fontSize: 15, fontWeight: 700, color: '#fff', background: '#0f766e', border: 'none', borderRadius: 999, cursor: 'pointer', opacity: uLoading || !uQ.trim() ? 0.5 : 1 }}>
              {uLoading ? 'Searching…' : 'Search'}
            </button>
          </form>
          {uErr && <div style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center' }}>{uErr}</div>}
          {!uSearched && !uLoading && (
            <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: 13 }}>
              One search, everything at once — live web prices, what's on our shelves, our cost &amp; suggested retail, and every distributor catalog.
            </div>
          )}
          {uLoading && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: 13, padding: 30 }}>Comparing prices everywhere…</div>}

          {uSearched && !uLoading && (() => {
            // Assemble the shopping layout from the merged results.
            // Honest seller names: our Volusion rows come back labeled with their CATEGORY
            // ("Stanley", "Push Plates") and Apify rows as "Apify · scraper" — map both by URL.
            const sellerOf = (r) => {
              const link = String(r.link || '');
              if (link.includes('automaticsandmore.com')) return 'Automatics & More (website)';
              if (link.includes('addisonautomatics.com')) return 'Addison Automatics';
              if (String(r.source || '').startsWith('Apify')) return 'Google Shopping';
              return r.source || 'Web';
            };
            // Relevance: a result must carry the query's tokens in its title (kills the
            // "Stanley Collins card trick" class of Google noise).
            const normT = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
            const qTokens = normT(uQ).split(/\s+/).filter(t => t.length >= 2);
            const relevant = (r) => {
              if (!qTokens.length) return true;
              const hayA = normT(r.title).replace(/ /g, '');
              const hit = qTokens.filter(t => normT(r.title).includes(t) || hayA.includes(t.replace(/ /g, ''))).length;
              return hit >= Math.max(1, Math.ceil(qTokens.length * 0.6));
            };
            // Dedupe: the same listing often arrives once per category export.
            const seen = new Set();
            const web = uWeb.filter(relevant).filter(r => {
              const k = `${sellerOf(r)}|${Number(r.price) || 0}|${normT(r.title)}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            const priced = web.filter(r => Number(r.price) > 0).sort((a, b) => a.price - b.price);
            const tokenScore = (r) => qTokens.filter(t => normT(r.title).includes(t)).length;
            const hero = [...web].sort((a, b) => (tokenScore(b) - tokenScore(a)) || ((b.thumbnail ? 1 : 0) - (a.thumbnail ? 1 : 0)))[0] || null;
            // Prefer the inventory/cost row that actually carries the query in its
            // part number or name (the first API hit can be a sibling accessory).
            const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const nq = norm(uQ);
            const best = (items, ...fields) =>
              items.find(it => fields.some(f => norm(it[f]) === nq))
              || items.find(it => fields.some(f => nq && norm(it[f]).includes(nq)))
              || items[0] || null;
            const invHit = best(uInv, 'partNumber', 'name', 'manufacturerPart');
            const costHit = best(uCost, 'partNumber', 'name', 'manufacturerPart');
            const marketLow = priced.length ? priced[0].price : null;
            const marketHigh = priced.length ? priced[priced.length - 1].price : null;
            const suggested = costHit ? computePricing(costHit.unitCost, pcTargetMargin, marketLow).suggested : null;
            // Our own listing joins the buying options, ranked by OUR suggested retail.
            const options = [...priced.map(r => ({ kind: sellerOf(r).startsWith('Automatics') ? 'ourweb' : 'web', seller: sellerOf(r), price: r.price, title: r.title, note: r.condition && r.condition !== 'unknown' ? r.condition : '', link: r.link, shipping: r.shipping }))];
            if (costHit) {
              options.push({ kind: 'ours', seller: 'Automatics & More', price: suggested, note: invHit ? `${invHit.available} on hand · ${invHit.location || 'our shelf'}` : 'our stock', link: null, cost: costHit.unitCost });
              options.sort((a, b) => (a.price ?? 1e12) - (b.price ?? 1e12));
            }
            const thumbs = web.filter(r => r.thumbnail && r !== hero).slice(0, 4);
            const more = web.filter(r => r !== hero).slice(0, 8);
            if (!web.length && !invHit && !costHit) {
              return <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: 13, padding: 30 }}>Nothing found — try a different part number or fewer words.</div>;
            }
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
                  {/* LEFT — product hero */}
                  <div style={{ ...styles.card }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{hero ? hero.title : (invHit ? invHit.name : uQ)}</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {hero && hero.thumbnail ? (
                        <div>
                          <img src={hero.thumbnail} alt="" style={{ width: 210, height: 210, objectFit: 'contain', background: '#fafafa', borderRadius: 10, border: '1px solid #eee' }} />
                          {thumbs.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              {thumbs.map((t, i) => (
                                <a key={i} href={t.link} target="_blank" rel="noreferrer">
                                  <img src={t.thumbnail} alt="" style={{ width: 46, height: 46, objectFit: 'contain', background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }} />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: 210, height: 210, background: '#fafafa', borderRadius: 10, border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📦</div>
                      )}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        {[
                          invHit && ['Part #', invHit.partNumber || invHit.name],
                          invHit && invHit.manufacturer && ['Manufacturer', invHit.manufacturer],
                          costHit && ['Our cost', '$' + Number(costHit.unitCost).toFixed(2)],
                          suggested != null && ['Suggested retail', '$' + Number(suggested).toFixed(2)],
                          invHit && ['On our shelf', `${invHit.available} available${invHit.location ? ' · ' + invHit.location : ''}`],
                          hero && hero.condition && hero.condition !== 'unknown' && ['Condition', hero.condition],
                        ].filter(Boolean).map(([k, v], i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f4f4f4', fontSize: 13 }}>
                            <span style={{ color: '#70757a', width: 120, flexShrink: 0 }}>{k}</span>
                            <span style={{ fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                        {invHit && Number(invHit.available) > 0 && (
                          <span style={{ display: 'inline-block', marginTop: 10, padding: '3px 10px', borderRadius: 999, background: '#e6f4ea', color: '#137333', fontSize: 12, fontWeight: 700 }}>In stock — our shelf</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT — buying options, cheapest first */}
                  <div>
                    {marketLow != null && (
                      <div style={{ fontSize: 13, color: '#3c4043', marginBottom: 8 }}>
                        Typically <strong>${marketLow.toFixed(0)}{marketHigh > marketLow ? `–$${marketHigh.toFixed(0)}` : ''}</strong>
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Buying options</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {options.length === 0 && <div style={{ fontSize: 13, color: '#9aa0a6' }}>No priced listings found.</div>}
                      {options.map((o, i) => {
                        const inner = (
                          <div style={{ border: '1px solid ' + (o.kind === 'ours' ? '#0f766e' : '#e8eaed'), background: o.kind === 'ours' ? '#f0fdfa' : '#fff', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: o.kind === 'ours' ? '#0f766e' : '#1a73e8' }}>
                                {i === 0 && <span style={{ background: '#e6f4ea', color: '#137333', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginRight: 6 }}>Best price</span>}
                                {o.kind === 'ours' && <span style={{ background: '#0f766e', color: '#fff', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginRight: 6 }}>OURS</span>}
                                {o.kind === 'ourweb' && <span style={{ background: '#134e4a', color: '#fff', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginRight: 6 }}>OUR SITE</span>}
                                {o.seller}
                              </span>
                              <span style={{ fontWeight: 800, fontSize: 15, color: '#137333' }}>{o.price != null ? '$' + Number(o.price).toFixed(2) : '—'}</span>
                            </div>
                            {o.title && o.kind !== 'ours' && (
                              <div style={{ fontSize: 11.5, color: '#3c4043', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                            )}
                            <div style={{ fontSize: 11.5, color: '#70757a', marginTop: 2 }}>
                              {o.kind === 'ours' ? `cost $${Number(o.cost).toFixed(2)} · ${o.note}` : [o.note, o.shipping > 0 ? `+$${o.shipping} shipping` : 'shipping varies'].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        );
                        return o.link
                          ? <a key={i} href={o.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
                          : <div key={i}>{inner}</div>;
                      })}
                    </div>
                  </div>
                </div>

                {/* MORE OPTIONS — variant cards */}
                {more.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>More options</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                      {more.map((r, i) => (
                        <a key={i} href={r.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ border: '1px solid #e8eaed', borderRadius: 12, padding: 10, height: '100%' }}>
                            {r.thumbnail
                              ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: 110, objectFit: 'contain', background: '#fafafa', borderRadius: 8 }} />
                              : <div style={{ width: '100%', height: 110, background: '#fafafa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📦</div>}
                            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6, lineHeight: 1.3, maxHeight: 34, overflow: 'hidden' }}>{r.title}</div>
                            {Number(r.price) > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: '#137333', marginTop: 3 }}>${Number(r.price).toFixed(2)}</div>}
                            <div style={{ fontSize: 11, color: '#70757a', marginTop: 2 }}>{sellerOf(r)}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {activeTab === 'availability' && (
        <>
          <div style={styles.card}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>📦 Availability</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
              Check our own shelves before sourcing. Stock comes from Sortly (sample data for now).
            </div>
            <form onSubmit={runInventorySearch}>
              <label style={styles.label}>Part name, number, or manufacturer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={invQuery}
                  onChange={e => setInvQuery(e.target.value)}
                  placeholder="e.g. Besam SW200, 1607, LiftMaster"
                />
                <button type="submit" style={{ ...styles.inlineButton, whiteSpace: 'nowrap' }} disabled={invLoading}>
                  {invLoading ? 'Checking…' : 'Check stock'}
                </button>
              </div>
            </form>
            {(query || partNumber || manufacturer) && (
              <button
                style={{ ...styles.linkButton, marginTop: 10, display: 'inline-block' }}
                onClick={() => {
                  const q = [manufacturer, query, partNumber].filter(Boolean).join(' ');
                  setInvQuery(q);
                  runInventorySearch(null, q);
                }}
              >
                Use my last Price Search ({[manufacturer, query, partNumber].filter(Boolean).join(' ')})
              </button>
            )}
          </div>

          {invError && <div style={styles.error}>{invError}</div>}

          {invSearched && !invLoading && invResults.length === 0 && !invError && (
            <div style={styles.empty}>
              Not found in our inventory. It likely needs to be sourced — try the Price Search lane.
            </div>
          )}

          {invResults.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                {invResults.length} match{invResults.length === 1 ? '' : 'es'} on our shelves
                {invSource === 'nexus'
                  ? <span style={{ ...stockBadgeStyle('in_stock'), marginLeft: 8 }}>● Live from Nexus</span>
                  : invSource === 'mock'
                    ? <span style={{ ...styles.badge, marginLeft: 8 }}>sample data</span>
                    : null}
              </div>
              {invResults.map((it) => (
                <div key={it.sku} style={styles.result}>
                  <div style={styles.thumbPlaceholder}>{it.folder || 'Stock'}</div>
                  <div>
                    <div style={styles.title}>{it.name}</div>
                    <div style={styles.source}>
                      Part <strong>{it.partNumber || '—'}</strong>
                      {it.manufacturerPart ? ` · Mfg ${it.manufacturerPart}` : ''}
                      {it.manufacturer ? ` · ${it.manufacturer}` : ''}
                    </div>
                    <span style={stockBadgeStyle(it.status)}>{STOCK_LABELS[it.status]}</span>
                    <span style={{ ...styles.badge, marginLeft: 6 }}>Bin {it.bin || '—'}</span>
                    <span style={styles.badge}>{it.location || '—'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.price}>{it.available}</div>
                    <div style={styles.ship}>available</div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {it.onHand} on hand · {it.reserved} reserved
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {activeTab === 'pricing' && (
        <>
          <div style={styles.card}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>💰 Pricing Engine</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 14 }}>
              Pull our cost (QuickBooks, sample data for now), set against the market price, and get a competitive retail with the margin spelled out.
            </div>
            <form onSubmit={runCostLookup}>
              <label style={styles.label}>Part name, number, or manufacturer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={pcQuery}
                  onChange={e => setPcQuery(e.target.value)}
                  placeholder="e.g. Besam SW200, 1607, LiftMaster"
                />
                <button type="submit" style={{ ...styles.inlineButton, whiteSpace: 'nowrap' }} disabled={pcLoading}>
                  {pcLoading ? 'Looking up…' : 'Look up cost'}
                </button>
              </div>
            </form>
            {(query || partNumber || manufacturer) && (
              <button
                style={{ ...styles.linkButton, marginTop: 10, display: 'inline-block' }}
                onClick={() => {
                  const q = [manufacturer, query, partNumber].filter(Boolean).join(' ');
                  setPcQuery(q);
                  runCostLookup(null, q);
                }}
              >
                Use my last Price Search ({[manufacturer, query, partNumber].filter(Boolean).join(' ')})
              </button>
            )}
          </div>

          {pcError && <div style={styles.error}>{pcError}</div>}

          {pcSearched && !pcLoading && pcCostItems.length === 0 && !pcError && (
            <div style={styles.empty}>No cost on file for that part in QuickBooks (sample data).</div>
          )}

          {pcCostItems.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {pcCostItems.map(it => (
                <button
                  key={it.qboItemId}
                  style={{ ...styles.pill, ...(pcSelected?.qboItemId === it.qboItemId ? { borderColor: '#185FA5', background: '#E6F1FB', color: '#185FA5' } : {}) }}
                  onClick={() => { setPcSelected(it); setPcRetailOverride(''); }}
                >
                  {it.partNumber} · {it.name}
                </button>
              ))}
            </div>
          )}

          {pcSelected && (() => {
            const cost = Number(pcSelected.unitCost) || 0;
            const pricing = computePricing(cost, pcTargetMargin, pcMarket);
            const effectiveRetail = pcRetailOverride !== '' ? (Number(pcRetailOverride) || 0) : pricing.suggested;
            const m = marginPct(effectiveRetail, cost);
            const mk = markupPct(effectiveRetail, cost);
            const tmShown = Math.max(0, Math.min(95, Number(pcTargetMargin) || 0));
            const costSourceLabel = {
              nexus: 'live from Nexus (Sortly)',
              qbo: 'from QuickBooks',
              'vendor-net': 'vendor net price' + (pcSelected.distributor ? ' · ' + pcSelected.distributor : ''),
              mock: 'sample data',
            }[pcSelected.costSource] || 'sample data';
            const marketLowFromSearch = results.reduce((lo, r) => (r.price > 0 && (lo == null || r.price < lo) ? r.price : lo), null);
            const rationale = {
              costplus: `No market price entered — priced at your ${tmShown}% target margin (cost-plus).`,
              target: `Market has room — set to your ${tmShown}% target margin, still under the $${pricing.market?.toFixed(2)} market price.`,
              undercut: `Priced just under the $${pricing.market?.toFixed(2)} market price to stay competitive.`,
              floor: `Market is tight — held to the ${(MIN_MARGIN * 100)}% minimum margin (you'd be at $${pricing.suggested.toFixed(2)} vs $${pricing.market?.toFixed(2)} market).`,
            }[pricing.basis];
            return (
              <div style={styles.card}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{pcSelected.name}</div>
                <div style={styles.source}>
                  Part <strong>{pcSelected.partNumber || '—'}</strong>
                  {pcSelected.manufacturerPart ? ` · Mfg ${pcSelected.manufacturerPart}` : ''}
                  {pcSelected.manufacturer ? ` · ${pcSelected.manufacturer}` : ''}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div>
                    <label style={styles.label}>Our cost</label>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>${cost.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{costSourceLabel}</div>
                  </div>
                  <div>
                    <label style={styles.label}>Target margin %</label>
                    <input style={styles.input} type="number" min="0" max="95" value={pcTargetMargin} onChange={e => setPcTargetMargin(e.target.value)} />
                  </div>
                  <div>
                    <label style={styles.label}>Market / competitor price</label>
                    <input style={styles.input} type="number" min="0" step="0.01" value={pcMarket} onChange={e => setPcMarket(e.target.value)} placeholder="optional" />
                    {marketLowFromSearch != null && (
                      <button style={{ ...styles.linkButton, marginTop: 6, display: 'inline-block', fontSize: 11 }} onClick={() => setPcMarket(String(marketLowFromSearch))}>
                        Use search low (${marketLowFromSearch.toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 18, padding: 16, borderRadius: 10, background: '#F2F8FE', border: '1px solid #cfe3f7' }}>
                  <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 700, marginBottom: 2 }}>SUGGESTED RETAIL</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: '#185FA5' }}>${pricing.suggested.toFixed(2)}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>{rationale}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16, alignItems: 'end' }}>
                  <div>
                    <label style={styles.label}>Set your own retail</label>
                    <input style={styles.input} type="number" min="0" step="0.01" value={pcRetailOverride} onChange={e => setPcRetailOverride(e.target.value)} placeholder={pricing.suggested.toFixed(2)} />
                  </div>
                  <div>
                    <label style={styles.label}>Margin at ${effectiveRetail.toFixed(2)}</label>
                    <span style={marginBadgeStyle(m)}>{m.toFixed(1)}% margin</span>
                  </div>
                  <div>
                    <label style={styles.label}>Markup</label>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{mk.toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: '#999' }}>${(effectiveRetail - cost).toFixed(2)} profit / unit</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

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
              Upload the file the distributor sent <strong>exactly as they sent it</strong> — Excel (.xlsx/.xls) or CSV/TSV.
              You don’t need to clean it up: the importer <strong>finds the header row automatically</strong> (even under a
              title/logo banner), recognizes varied column names (Part&nbsp;#, SKU, Product, PART&nbsp;NUMBER, Entry&nbsp;Name…),
              picks up <strong>list price and net/cost</strong> when both are present, treats “BUTT&nbsp;HINGES”-style divider rows
              as categories, and rounds off vendor price rounding noise. It’ll show you which columns it read after import.
              (For multi-tab workbooks, the first sheet is used.)
              <br />Matching parts are <strong>updated</strong>, new parts are <strong>added</strong>, and anything already in our
              catalog that isn’t in this file <strong>stays</strong> — nothing is deleted.
            </div>

            <label style={styles.label}>Price list file (.xlsx, .xls, .csv, .tsv, .txt)</label>
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain" onChange={onImportFile} style={{ marginBottom: 6 }} />
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
                {importResult.skipped ? ` · ${importResult.skipped} skipped (no part #)` : ''}
                {importResult.sections ? ` · ${importResult.sections} category sections` : ''}. {importResult.totalForDistributor.toLocaleString()} parts total.
                <div style={{ marginTop: 6, fontSize: 12, color: '#3B6D4A' }}>
                  {importResult.withList ? `${importResult.withList.toLocaleString()} with list price` : ''}
                  {importResult.withList && importResult.withNet ? ' · ' : ''}
                  {importResult.withNet ? <strong>{importResult.withNet.toLocaleString()} with NET price</strong> : (importResult.withList ? '' : 'no prices found')}
                  {' · headline = '}<strong>{importResult.priceMode === 'net' ? 'NET' : 'list'}</strong>
                  {'. '}{importResult.learned ? 'Learned this vendor’s format — future uploads map the same way.' : 'Used this vendor’s saved format.'}
                </div>

                {/* What changed since last import — the point of all this: catch price moves ASAP. */}
                {importResult.changes && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #CDE8D2' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2F6F3E', marginBottom: 6 }}>What changed</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {[
                        { n: importResult.changes.added, label: 'new', bg: '#E6F1FB', fg: '#0C447C' },
                        { n: importResult.changes.priceUp, label: 'price ↑', bg: '#FCEBEB', fg: '#A32D2D' },
                        { n: importResult.changes.priceDown, label: 'price ↓', bg: '#EAF3DE', fg: '#3B6D11' },
                        { n: importResult.changes.unchanged, label: 'unchanged', bg: '#F1EFE8', fg: '#5F5E5A' },
                        { n: importResult.changes.discontinued, label: 'discontinued', bg: '#FCEBEB', fg: '#A32D2D' },
                      ].filter(b => b.n).map(b => (
                        <span key={b.label} style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: b.bg, color: b.fg }}>
                          {b.n.toLocaleString()} {b.label}
                        </span>
                      ))}
                    </div>

                    {/* Partial upload — this file only re-listed some of what we already had, so we
                        deliberately did NOT mass-flag the absent parts as discontinued. */}
                    {importResult.changes.partialUpload && (
                      <div style={{ fontSize: 11.5, background: '#FAEEDA', border: '1px solid #FAC775', color: '#633806', borderRadius: 6, padding: '7px 9px', marginBottom: 8 }}>
                        ⚠ Partial upload (covered {Math.round((importResult.changes.coverage || 0) * 100)}% of known parts) — availability not changed for the rest.
                      </div>
                    )}

                    {/* Newly discontinued / unavailable parts (red — these can't be sold). */}
                    {importResult.changes.discontinuedSample?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#A32D2D', fontWeight: 600, marginBottom: 4 }}>Newly discontinued / unavailable:</div>
                        <div style={{ display: 'grid', gap: 3 }}>
                          {importResult.changes.discontinuedSample.slice(0, 8).map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ fontFamily: 'monospace', color: '#A32D2D', fontWeight: 700 }}>{d.part}</span>
                              <span style={{ color: '#9aa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</span>
                              {d.lastPrice != null && <span style={{ color: '#789', marginLeft: 'auto', whiteSpace: 'nowrap' }}>last ${Number(d.lastPrice).toFixed(2)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Newly added parts. */}
                    {importResult.changes.addedSample?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#0C447C', fontWeight: 600, marginBottom: 4 }}>Newly added:</div>
                        <div style={{ display: 'grid', gap: 3 }}>
                          {importResult.changes.addedSample.slice(0, 8).map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ fontFamily: 'monospace', color: '#0C447C', fontWeight: 700 }}>{a.part}</span>
                              <span style={{ color: '#9aa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</span>
                              {a.price != null && <span style={{ color: '#789', marginLeft: 'auto', whiteSpace: 'nowrap' }}>${Number(a.price).toFixed(2)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Format drift — vendor changed their layout */}
                    {(importResult.changes.formatWarnings?.length > 0 || importResult.changes.newColumns?.length > 0) && (
                      <div style={{ fontSize: 11.5, background: '#FAEEDA', border: '1px solid #FAC775', color: '#633806', borderRadius: 6, padding: '7px 9px', marginBottom: 8 }}>
                        {importResult.changes.formatWarnings?.map((w, i) => <div key={i}>⚠ {w.msg}</div>)}
                        {importResult.changes.newColumns?.length > 0 && (
                          <div>New column{importResult.changes.newColumns.length > 1 ? 's' : ''} captured: <strong>{importResult.changes.newColumns.join(', ')}</strong> — stored on each part; map any to a field above if you want it searchable.</div>
                        )}
                      </div>
                    )}
                    {/* Biggest price movers */}
                    {importResult.changes.topMovers?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#456', marginBottom: 4 }}>Biggest moves:</div>
                        <div style={{ display: 'grid', gap: 3 }}>
                          {importResult.changes.topMovers.slice(0, 8).map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: m.dir === 'priceUp' ? '#A32D2D' : '#3B6D11', fontWeight: 700, width: 54 }}>
                                {m.deltaPct > 0 ? '+' : ''}{m.deltaPct}%
                              </span>
                              <span style={{ fontFamily: 'monospace', color: '#234' }}>{m.part}</span>
                              <span style={{ color: '#789' }}>{m.field} ${m.from} → ${m.to}</span>
                              <span style={{ color: '#9aa', fontSize: 11, marginLeft: 'auto', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-vendor mapping editor: correct a column once and it sticks for this distributor. */}
                {mapEdit && Array.isArray(importResult.headers) && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #CDE8D2' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2F6F3E', marginBottom: 6 }}>
                      Columns read (header row {importResult.headerRow}) — fix any that are wrong, then re-import:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                      {['part', 'description', 'price', 'net', 'category', 'manufacturerPart', 'quantity', 'uom'].map(field => (
                        <label key={field} style={{ fontSize: 11, color: '#456' }}>
                          <span style={{ display: 'block', marginBottom: 2, fontWeight: 600 }}>
                            {field === 'price' ? 'list price' : field === 'net' ? 'net / our cost' : field === 'manufacturerPart' ? 'mfg part' : field}
                          </span>
                          <select
                            value={mapEdit[field] ?? ''}
                            onChange={e => setMapEdit(m => ({ ...m, [field]: e.target.value }))}
                            style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '1px solid #CDE8D2', borderRadius: 6, background: '#fff', color: '#234' }}
                          >
                            <option value="">(none)</option>
                            {[...new Set(importResult.headers.filter(Boolean))].map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#456' }}>Headline price:</span>
                      {['list', 'net'].map(mode => (
                        <button key={mode} onClick={() => setPriceMode(mode)}
                          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                            border: priceMode === mode ? '1px solid #2F6F3E' : '1px solid #CDE8D2',
                            background: priceMode === mode ? '#2F6F3E' : '#fff', color: priceMode === mode ? '#fff' : '#456', fontWeight: 600 }}>
                          {mode === 'net' ? 'Net (our cost)' : 'List / MSRP'}
                        </button>
                      ))}
                      <button onClick={() => runImport({ overrides: mapEdit, priceMode, keepResult: true })} disabled={importBusy}
                        style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #185FA5', background: '#185FA5', color: '#fff', fontWeight: 600, opacity: importBusy ? 0.6 : 1 }}>
                        {importBusy ? 'Applying…' : 'Apply mapping & re-import'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={styles.pill} onClick={() => setImportTarget('')} disabled={importBusy}>Close</button>
              <button style={{ ...styles.button, opacity: importBusy ? 0.6 : 1 }} onClick={() => runImport()} disabled={importBusy}>
                {importBusy ? 'Importing…' : 'Import price list'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
