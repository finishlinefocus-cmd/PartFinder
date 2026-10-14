// node --test client/src/compare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison, compareSummary, marginView, isOurListing } from './compare.js';

const rows = [
  { source: 'Amazon', price: 52, shipping: 0, via: 'serpapi', link: 'https://amazon.com/x' },
  { source: 'Amazon', price: 48.5, shipping: 6, via: 'serpapi', link: 'https://amazon.com/y' },
  { source: 'eBay', price: 44, shipping: 9.99, via: 'serpapi' },
  { source: 'Automatics & More', price: 55, shipping: 0, via: 'catalog', link: 'https://www.automaticsandmore.com/p/1' },
  { source: 'Addison Automatics', price: 0, shipping: 0, via: 'catalog', catalog: { priceLabel: '(login for price)' } },
];

test('a seller is its lowest listing, never an average', () => {
  const c = buildComparison(rows);
  const amazon = c.sellers.find(s => s.name === 'Amazon');
  assert.equal(amazon.listings, 2);
  assert.equal(amazon.low, 48.5);
});

test('shipping counts only when asked for and only when stated', () => {
  const c = buildComparison(rows, { withShipping: true });
  const amazon = c.sellers.find(s => s.name === 'Amazon');
  assert.equal(amazon.low, 52);              // 48.5 + 6 = 54.5 > 52 + 0
  const ebay = c.sellers.find(s => s.name === 'eBay');
  assert.equal(ebay.low, 53.99);
});

test('an unpriced listing is a listing, not a $0 price', () => {
  const c = buildComparison(rows);
  const addison = c.sellers.find(s => s.name === 'Addison Automatics');
  assert.equal(addison.listings, 1);
  assert.equal(addison.priced, 0);
  assert.equal(addison.low, null);
  assert.equal(c.sellers[c.sellers.length - 1].name, 'Addison Automatics'); // unpriced sorts last
  assert.equal(c.counts.pricedSellers, 3);
});

test('our store is separated and kept out of the market figures', () => {
  const c = buildComparison(rows);
  assert.equal(c.ours.name, 'Automatics & More');
  assert.equal(c.market.low, 44);
  assert.equal(c.market.lowSeller, 'eBay');
  assert.equal(c.market.pricedSellers, 2);
  assert.equal(c.position, 'above');
  assert.equal(c.delta, 11);
});

test('cheapest and only-seller positions', () => {
  const c1 = buildComparison([{ source: 'Automatics & More', price: 10 }, { source: 'eBay', price: 12 }]);
  assert.equal(c1.position, 'cheapest');
  const c2 = buildComparison([{ source: 'Automatics & More', price: 10 }]);
  assert.equal(c2.position, 'only');
  assert.equal(c2.market.low, null);
  const c3 = buildComparison([{ source: 'eBay', price: 12 }]);
  assert.equal(c3.position, 'unknown');
  assert.equal(c3.ours, null);
});

test('our listing is recognised by source, link, or am- distributor id', () => {
  assert.equal(isOurListing({ source: 'automatics and more' }), true);
  assert.equal(isOurListing({ source: 'x', link: 'https://www.automaticsandmore.com/a.htm' }), true);
  assert.equal(isOurListing({ source: 'Adams Rite', catalog: { distributorId: 'am-adams-rite' } }), true);
  assert.equal(isOurListing({ source: 'Amazon', link: 'https://amazon.com' }), false);
});

test('summary line reads as a sentence fragment a pill can hold', () => {
  assert.equal(compareSummary(buildComparison(rows)), '4 sellers · from $44.00');
  assert.equal(compareSummary(buildComparison([{ source: 'Automatics & More', price: 10 }])), '1 seller · from $10.00 (us)');
  assert.equal(compareSummary(buildComparison([{ source: 'Addison', price: 0 }])), '1 seller · no prices');
  assert.equal(compareSummary(buildComparison([])), 'Compare');
});

test('margin view needs a real cost and never invents one', () => {
  const c = buildComparison(rows);
  assert.equal(marginView(c, []), null);
  assert.equal(marginView(c, [{ unitCost: 0 }]), null);
  const m = marginView(c, [{ unitCost: 33 }]);
  assert.equal(m.cost, 33);
  assert.equal(m.ourPrice, 55);
  assert.equal(Math.round(m.ourMarginPct), 40);
  assert.equal(m.marketLow, 44);
  assert.equal(m.marketBelowCost, false);
  const m2 = marginView(c, [{ unitCost: 50 }]);
  assert.equal(m2.marketBelowCost, true);
});
