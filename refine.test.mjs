// node --test refine.test.mjs — runs with NO API key and spends nothing: the client is a fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { refineResults, refineStatus, trimListing, reconcileVerdicts, _clearRefineCache, MAX_LISTINGS } from './refine.js';

const results = [
  { id: 'a', title: 'LiftMaster 41A5021-1 Logic Board', source: 'Amazon', price: 89.5, shipping: 0, thumbnail: 'http://x/very-long-url', via: 'serpapi' },
  { id: 'b', title: 'LiftMaster garage remote', source: 'eBay', price: 25, via: 'serpapi' },
  { id: 'c', title: 'Logic board', source: 'Addison Automatics', price: 0, via: 'catalog', catalog: { addisonPart: '41A5021-1', priceLabel: '(login for price)', bigBlob: 'x'.repeat(5000) } },
];

function fakeClient(answer, usage = { input_tokens: 1200, output_tokens: 300 }) {
  const calls = [];
  return {
    calls,
    messages: {
      async create(req) {
        calls.push(req);
        return { model: req.model, stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify(answer) }] };
      },
    },
  };
}

const answer = {
  interpretation: { summary: 'A LiftMaster 41A5021-1 logic board.', manufacturer: 'LiftMaster', partNumber: '41A5021-1', confidence: 'high' },
  verdicts: [
    { id: 'a', match: 'exact', note: '' },
    { id: 'b', match: 'unrelated', note: 'A remote, not the board.' },
    { id: 'zzz', match: 'exact', note: 'invented' },
  ],
  suggestedQueries: ['41A5021-1', 'LiftMaster 41A5021-1I', ''],
};

test('off without a key, and the status says how to turn it on', async () => {
  delete process.env.ANTHROPIC_API_KEY; delete process.env.PARTFINDER_ANTHROPIC_KEY;
  assert.equal(refineStatus().enabled, false);
  assert.match(refineStatus().reason, /ANTHROPIC_API_KEY/);
  await assert.rejects(refineResults({ query: 'x', results }, { client: fakeClient(answer) }), /ANTHROPIC_API_KEY/);
});

test('trimming drops thumbnails and catalog blobs, keeps part numbers and the price label', () => {
  const t = trimListing(results[2], 2);
  assert.equal(t.partNumber, '41A5021-1');
  assert.equal(t.priceLabel, '(login for price)');
  assert.equal(t.price, null);
  assert.equal('bigBlob' in t, false);
  assert.equal('thumbnail' in trimListing(results[0], 0), false);
});

test('verdicts naming unknown listings are dropped; silence defaults to related, never hidden', () => {
  const listings = results.map(trimListing);
  const v = reconcileVerdicts(answer.verdicts, listings);
  assert.deepEqual(v.map(x => x.id).sort(), ['a', 'b', 'c']);
  assert.equal(v.find(x => x.id === 'c').match, 'related');
});

test('a run sends trimmed listings, the structured-output schema, and reports tokens', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  _clearRefineCache();
  const client = fakeClient(answer);
  const out = await refineResults({ query: 'liftmaster board', partNumber: '41A5021-1', results }, { client });
  assert.equal(client.calls.length, 1);
  const req = client.calls[0];
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.output_config.effort, 'low');
  assert.match(req.messages[0].content, /"partNumber":"41A5021-1"/);
  assert.doesNotMatch(req.messages[0].content, /very-long-url|bigBlob/);
  assert.equal(out.interpretation.partNumber, '41A5021-1');
  assert.equal(out.suggestedQueries.length, 2);
  assert.equal(out.usage.inputTokens, 1200);
  assert.equal(out.usage.outputTokens, 300);
  assert.equal(out.cached, false);
  delete process.env.ANTHROPIC_API_KEY;
});

test('a second press on the same search is served from cache and spends nothing', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  _clearRefineCache();
  const client = fakeClient(answer);
  await refineResults({ query: 'liftmaster board', results }, { client });
  const again = await refineResults({ query: 'liftmaster board', results }, { client });
  assert.equal(client.calls.length, 1);
  assert.equal(again.cached, true);
  // A different listing set is a different question.
  await refineResults({ query: 'liftmaster board', results: results.slice(0, 2) }, { client });
  assert.equal(client.calls.length, 2);
  delete process.env.ANTHROPIC_API_KEY;
});

test('at most MAX_LISTINGS go out, and the response says how many were held back', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  _clearRefineCache();
  const many = Array.from({ length: 95 }, (_, i) => ({ id: 'r' + i, title: 't' + i, source: 's', price: i + 1 }));
  const client = fakeClient({ interpretation: null, verdicts: [], suggestedQueries: [] });
  const out = await refineResults({ query: 'q', results: many }, { client });
  assert.equal(out.listingsSent, MAX_LISTINGS);
  assert.equal(out.listingsTotal, 95);
  assert.equal(out.verdicts.length, MAX_LISTINGS);
  delete process.env.ANTHROPIC_API_KEY;
});

test('a refusal and a non-JSON answer are errors, not empty successes', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  _clearRefineCache();
  const refusing = { messages: { async create() { return { stop_reason: 'refusal', stop_details: { explanation: 'nope' }, content: [], usage: {} }; } } };
  await assert.rejects(refineResults({ query: 'q1', results }, { client: refusing }), /declined/);
  const garbage = { messages: { async create() { return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }], usage: {} }; } } };
  await assert.rejects(refineResults({ query: 'q2', results }, { client: garbage }), /not the expected JSON/);
  delete process.env.ANTHROPIC_API_KEY;
});
