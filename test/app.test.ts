/**
 * App tests: retrieval, the conversation loop, the brochure and the HTTP
 * handlers. No API key, no network, no database — an in-memory store and
 * stubbed model calls.
 *
 * Same property as the gate tests, one layer out: nothing reaches the
 * participant unless the gate passed it, and every failure fails closed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPassages, eligiblePassages } from '../src/retrieve.js';
import { openingText, runTurn, REFUSAL_TEXT, TurnError, MAX_PARTICIPANT_TURNS, type TurnDeps } from '../src/converse.js';
import { buildBrochure } from '../src/brochure.js';
import { buildDraftSystemPrompt, PAGE_OPENED, withOpening } from '../src/draft.js';
import { createHandler } from '../src/http.js';
import { memoryStore, type Belief } from '../src/store.js';
import type { Passage } from '../src/types.js';

const P = (id: string, over: Partial<Passage> = {}): Passage & { belief_id: string } => ({
  id,
  belief_id: 'b1',
  source_name: `Source ${id}`,
  source_url: `https://www.example.org/${id}`,
  source_domain: 'www.example.org',
  quote: `quote ${id}`,
  human_verified: true,
  applies_to: null,
  ...over,
});

const belief: Belief = {
  id: 'b1',
  statement: 'The belief statement.',
  domain: 'test',
  source_whitelist: ['example.org'],
  instrument: [
    { item: 'C1', text: 'Control one.' },
    { item: 'target', text: 'The belief statement.' },
  ],
};

function setup(passages = [P('p1'), P('p2')], runOver: { condition?: 'treatment' | 'brochure' | 'reversal'; ended_at?: string | null } = {}) {
  return memoryStore({
    beliefs: [belief],
    reasons: [{ belief_id: 'b1', code: 'r1', verbatim: 'Because I say so.', is_primary: true }],
    passages,
    runs: [
      {
        id: 'run1',
        belief_id: 'b1',
        condition: runOver.condition ?? 'treatment',
        ended_at: runOver.ended_at ?? null,
        access_token: 'tok-treatment-0000000000',
      },
      { id: 'run2', belief_id: 'b1', condition: 'brochure', ended_at: null, access_token: 'tok-brochure-00000000000' },
    ],
  });
}

const run = { id: 'run1', belief_id: 'b1', condition: 'treatment' as const, ended_at: null };

/** Each draft is one sentence; the judge passes a claim only if it is a passage quote. */
function deps(drafts: string[]): TurnDeps & { calls: number } {
  const d = {
    calls: 0,
    draft: async () => drafts[Math.min(d.calls++, drafts.length - 1)]!,
    decompose: async (text: string) => [{ text, kind: 'assertion' as const }],
    judge: async (claim: string, ps: Passage[]) => {
      const p = ps.find((x) => x.quote === claim);
      return { supported: !!p, passageId: p?.id ?? null, reason: 'not in passage' };
    },
  };
  return d;
}

// ---------------------------------------------------------------- retrieval

test('retrieval drops unverified passages', () => {
  const out = selectPassages([P('a'), P('b', { human_verified: false })], [], ['example.org']);
  assert.deepEqual(out.map((p) => p.id), ['a']);
});

test('retrieval drops passages from domains off the whitelist, including lookalikes', () => {
  const out = selectPassages(
    [P('a'), P('b', { source_domain: 'notexample.org' }), P('c', { source_domain: 'evil.com' })],
    [],
    ['example.org'],
  );
  assert.deepEqual(out.map((p) => p.id), ['a']);
});

test('an empty whitelist makes nothing eligible, not everything', () => {
  assert.equal(eligiblePassages([P('a')], []).length, 0);
});

test('retrieval ranks the primary reason first and leaves out other reasons’ passages', () => {
  const out = selectPassages(
    [P('general'), P('other', { applies_to: 'x' }), P('second', { applies_to: 'r2' }), P('main', { applies_to: 'r1' })],
    [
      { code: 'r1', is_primary: true },
      { code: 'r2', is_primary: false },
    ],
    ['example.org'],
  );
  assert.deepEqual(out.map((p) => p.id), ['main', 'second', 'general']);
});

test('retrieval caps the number of passages', () => {
  const many = Array.from({ length: 20 }, (_, i) => P(`p${i}`));
  assert.equal(selectPassages(many, [], ['example.org'], 5).length, 5);
});

// ---------------------------------------------------------------- conversation

test('a draft the gate passes is sent, logged, and its source named', async () => {
  const m = setup();
  const r = await runTurn(m.store, run, 'hello', deps(['quote p1']));
  assert.equal(r.text, 'quote p1');
  assert.equal(r.refused, false);
  assert.deepEqual(r.sources, [{ name: 'Source p1', url: 'https://www.example.org/p1' }]);
  assert.deepEqual(m.turns.map((t) => t.speaker), ['participant', 'system']);
  assert.equal(m.assertions.length, 1);
  assert.equal(m.assertions[0]!.sent, true);
  assert.equal(m.assertions[0]!.passage_id, 'p1');
});

test('two sections of one document are both named, though they share a link', async () => {
  const url = 'https://www.example.org/guidelines.pdf';
  const m = setup([
    P('p1', { source_name: 'Guidelines (Section 11)', source_url: url }),
    P('p2', { source_name: 'Guidelines (Section 16)', source_url: url }),
  ]);
  const d = deps(['quote p1|quote p2']);
  d.decompose = async (text: string) => text.split('|').map((t) => ({ text: t, kind: 'assertion' as const }));
  const r = await runTurn(m.store, run, 'hello', d);
  assert.deepEqual(r.sources.map((x) => x.name), ['Guidelines (Section 11)', 'Guidelines (Section 16)']);
});

test('a refused turn shows the fixed refusal and sends nothing sourced', async () => {
  const m = setup();
  const d = deps(['made up', 'still made up', 'made up again']);
  const r = await runTurn(m.store, run, 'hello', d);
  assert.equal(r.refused, true);
  assert.equal(r.text, REFUSAL_TEXT);
  assert.deepEqual(r.sources, []);
  assert.equal(d.calls, 3, 'one draft plus two redrafts');
  assert.equal(m.turns[1]!.sent_text, null, 'the stored sent_text of a refusal is null');
  assert.equal(m.assertions.length, 3, 'every attempt’s claims are logged');
  assert.ok(m.assertions.every((a) => !a.sent && a.blocked));
});

test('claims blocked in an earlier draft are logged as not sent; the passing redraft is sent', async () => {
  const m = setup();
  await runTurn(m.store, run, 'hello', deps(['invented', 'quote p2']));
  assert.deepEqual(
    m.assertions.map((a) => [a.claim_text, a.attempt, a.sent, a.blocked]),
    [
      ['invented', 0, false, true],
      ['quote p2', 1, true, false],
    ],
  );
  assert.equal(m.turns[1]!.redraft_count, 1);
});

test('with no verified passages the model is never called', async () => {
  const m = setup([P('p1', { human_verified: false })]);
  const d = deps(['quote p1']);
  await assert.rejects(runTurn(m.store, run, 'hello', d), (e: TurnError) => e.status === 503);
  assert.equal(d.calls, 0);
  assert.equal(m.turns.length, 0);
});

test('a drafter that throws sends nothing', async () => {
  const m = setup();
  const d: TurnDeps = {
    draft: async () => {
      throw new Error('model down');
    },
  };
  await assert.rejects(runTurn(m.store, run, 'hello', d), (e: TurnError) => e.status === 503);
  assert.equal(m.turns.length, 0, 'nothing is stored, so the message can simply be sent again');
});

test('ended runs, brochure links, empty and oversized messages are rejected', async () => {
  const m = setup();
  const d = deps(['quote p1']);
  await assert.rejects(runTurn(m.store, { ...run, ended_at: 'x' }, 'hi', d), (e: TurnError) => e.status === 409);
  await assert.rejects(runTurn(m.store, { ...run, condition: 'brochure' }, 'hi', d), (e: TurnError) => e.status === 400);
  await assert.rejects(runTurn(m.store, run, '   ', d), (e: TurnError) => e.status === 400);
  await assert.rejects(runTurn(m.store, run, 'x'.repeat(5000), d), (e: TurnError) => e.status === 400);
  assert.equal(d.calls, 0);
});

test('a conversation stops at its turn limit', async () => {
  const m = setup();
  const d = deps(['quote p1']);
  for (let i = 0; i < MAX_PARTICIPANT_TURNS; i++) await runTurn(m.store, run, `msg ${i}`, d);
  await assert.rejects(runTurn(m.store, run, 'one more', d), (e: TurnError) => e.status === 429);
});

// ---------------------------------------------------------------- drafter prompt

test('the drafter prompt carries every passage, the reasons, and the gate feedback', () => {
  const prompt = buildDraftSystemPrompt({
    statement: 'S',
    reasons: [{ code: 'r1', verbatim: 'his words', is_primary: true }],
    passages: [P('p1'), P('p2')],
    feedback: 'drop claim X',
  });
  for (const s of ['quote p1', 'quote p2', 'Source p1', 'his words', 'drop claim X']) assert.ok(prompt.includes(s), s);
});

test('the model sees the opening the participant replied to, and the history still starts with the user', () => {
  assert.deepEqual(
    withOpening([
      { role: 'assistant', content: 'opening' },
      { role: 'user', content: 'yes' },
    ]),
    [
      { role: 'user', content: PAGE_OPENED },
      { role: 'assistant', content: 'opening' },
      { role: 'user', content: 'yes' },
    ],
  );
  assert.deepEqual(withOpening([{ role: 'user', content: 'hi' }]), [{ role: 'user', content: 'hi' }]);
});

// ---------------------------------------------------------------- brochure

test('the brochure is the verified, whitelisted quotes, each logged as a sent supported claim', () => {
  const { doc, assertions } = buildBrochure(belief, [P('a'), P('b', { human_verified: false }), P('c', { source_domain: 'evil.com' })]);
  assert.deepEqual(doc.items.map((i) => i.quote), ['quote a']);
  assert.deepEqual(assertions('t1').map((a) => [a.passage_id, a.supported, a.sent]), [['a', true, true]]);
});

test('no brochure is built from nothing', () => {
  assert.throws(() => buildBrochure(belief, [P('a', { human_verified: false })]));
});

// ---------------------------------------------------------------- HTTP

const base = 'http://test';
const get = (path: string) => new Request(base + path);
const post = (path: string, body: unknown) =>
  new Request(base + path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

test('an unknown link gets a 404 and nothing else', async () => {
  const h = createHandler(setup().store);
  const r = await h(get('/api/session?t=not-a-real-token-at-all'));
  assert.equal(r.status, 404);
});

test('the opening is logged once, on the first visit', async () => {
  const m = setup();
  const h = createHandler(m.store);
  await h(get('/api/session?t=tok-treatment-0000000000'));
  const r = await h(get('/api/session?t=tok-treatment-0000000000'));
  const body = (await r.json()) as { turns: { text: string }[] };
  assert.equal(body.turns.length, 1);
  assert.ok(body.turns[0]!.text.includes('The belief statement.'));
  assert.equal(m.turns.length, 1);
});

test('the instrument hides which item is the target', async () => {
  const h = createHandler(setup().store);
  const r = await h(get('/api/instrument?t=tok-treatment-0000000000&tp=post_treatment'));
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!text.includes('target') && !text.includes('C1'), text);
});

test('measures: partial or out-of-range answers are rejected; a full set is stored once', async () => {
  const m = setup();
  const h = createHandler(m.store);
  const send = (scores: unknown) => h(post('/api/measure', { t: 'tok-treatment-0000000000', tp: 'post_treatment', scores, open_response: 'facts' }));

  assert.equal((await send({ 0: 50 })).status, 400);
  assert.equal((await send({ 0: 50, 1: 101 })).status, 400);
  assert.equal((await send({ 0: 50, 1: 12.5 })).status, 400);
  assert.equal(m.measures.length, 0);

  assert.equal((await send({ 0: 50, 1: 20 })).status, 200);
  assert.deepEqual(m.measures.map((x) => [x.item, x.score, x.open_response]), [
    ['C1', 50, null],
    ['target', 20, 'facts'],
  ]);
  assert.equal((await send({ 0: 50, 1: 20 })).status, 409);
});

test('a link can only record its own timepoints', async () => {
  const h = createHandler(setup().store);
  const brochureTreatment = await h(post('/api/measure', { t: 'tok-brochure-00000000000', tp: 'post_treatment', scores: { 0: 1, 1: 1 } }));
  const baseline = await h(post('/api/measure', { t: 'tok-treatment-0000000000', tp: 'baseline', scores: { 0: 1, 1: 1 } }));
  assert.equal(brochureTreatment.status, 400);
  assert.equal(baseline.status, 400, 'baseline is recorded at intake, never through a link');
});

test('a failing model call reaches the browser as a plain 503, with no internal detail', async () => {
  const h = createHandler(setup().store, {
    draft: async () => {
      throw new Error('secret internal detail');
    },
  });
  const r = await h(post('/api/turn', { t: 'tok-treatment-0000000000', message: 'hi' }));
  const text = await r.text();
  assert.equal(r.status, 503);
  assert.ok(!text.includes('secret internal detail'));
  assert.match(text, /try again/);
});

test('a brochure link cannot be used to chat', async () => {
  const h = createHandler(setup().store, deps(['quote p1']));
  const r = await h(post('/api/turn', { t: 'tok-brochure-00000000000', message: 'hi' }));
  assert.equal(r.status, 400);
});


test('the opening starts from the reason they already gave, instead of asking again', () => {
  const withReason = openingText('X is true.', 'My father  said so.');
  assert.match(withReason, /You told us why you believe it: "My father said so\."/);
  assert.doesNotMatch(withReason, /why do you think this is true/);
  assert.match(openingText('X is true.'), /why do you think this is true/);
});
