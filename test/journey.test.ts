/**
 * Self-serve journey tests. No API key, no network, no database: an in-memory
 * store, a fake login, and stubbed models and page downloads.
 *
 * The property that matters most: a quote is only ever used if the server
 * found it word for word in the downloaded source.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../src/http.js';
import { createJourneyHandler, stageOf, type JourneyDeps } from '../src/journey/handler.js';
import { parseShaped } from '../src/journey/shape.js';
import { normalizeForMatch, parseCandidates, quoteFoundIn, verifyCandidates } from '../src/journey/sourcing.js';
import { memoryStore } from '../src/store.js';

// ------------------------------------------------------------------ stageOf

test('stages follow the study order, and day 7 waits seven days', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const base = { consented: true, belief: { status: 'ready' as const }, reasons: 2, now };
  assert.equal(stageOf({ ...base, consented: false, times: {} }).stage, 'consent');
  assert.equal(stageOf({ ...base, belief: null, times: {} }).stage, 'belief');
  assert.equal(stageOf({ ...base, reasons: 0, times: {} }).stage, 'reasons');
  assert.equal(stageOf({ ...base, times: {} }).stage, 'baseline');
  assert.equal(stageOf({ ...base, belief: { status: 'draft' }, times: { baseline: 'x' } }).stage, 'sourcing');
  assert.equal(stageOf({ ...base, belief: { status: 'no_sources' }, times: { baseline: 'x' } }).stage, 'no_sources');
  assert.equal(stageOf({ ...base, times: { baseline: 'x' } }).stage, 'brochure');
  assert.equal(stageOf({ ...base, times: { baseline: 'x', post_brochure: 'x' } }).stage, 'chat');
  const waiting = stageOf({ ...base, times: { baseline: 'x', post_brochure: 'x', post_treatment: '2026-10-05T12:00:00Z' } });
  assert.equal(waiting.stage, 'waiting');
  assert.equal(waiting.due, '2026-10-12T12:00:00.000Z');
  assert.equal(stageOf({ ...base, times: { baseline: 'x', post_brochure: 'x', post_treatment: '2026-10-03T12:00:00Z' } }).stage, 'delayed');
  assert.equal(stageOf({ ...base, times: { baseline: 'x', post_brochure: 'x', post_treatment: 'x', delayed: 'x' } }).stage, 'done');
});

// ------------------------------------------------------------- exact match

test('a quote matches its page despite typography, line breaks and PDF hyphenation', () => {
  const page = 'An elderly person needs fewer calo-\nries but more  micronutrients than someone in “mid-life”.';
  assert.ok(quoteFoundIn('An elderly person needs fewer calories but more micronutrients than someone in "mid-life".', page));
  assert.ok(quoteFoundIn('needs fewer calories but more micronutrients', page));
});

test('a paraphrase, a changed word or a too-short fragment does not match', () => {
  const page = 'There is a strong association between salt intake and blood pressure.';
  assert.ok(!quoteFoundIn('There is a strong link between salt intake and blood pressure.', page));
  assert.ok(!quoteFoundIn('Salt intake causes high blood pressure.', page));
  assert.ok(!quoteFoundIn('salt intake', page), 'fragments under the minimum length never count');
});

test('normalisation changes typography only, never words', () => {
  assert.equal(normalizeForMatch('A  “B”\n—C&amp;D'), 'a "b" -c&d');
});

test('only trusted, https, findable quotes are kept, each marked exact_match', async () => {
  const pages: Record<string, string> = {
    'https://www.who.int/a': 'Reducing salt intake is one of the most cost-effective ways to improve health.',
  };
  const fetchText = async (url: string) => {
    if (!(url in pages)) throw new Error('404');
    return pages[url]!;
  };
  const report = await verifyCandidates('b1', [
    { source_name: 'WHO', url: 'https://www.who.int/a', quote: 'Reducing salt intake is one of the most cost-effective ways to improve health.' },
    { source_name: 'WHO again', url: 'https://www.who.int/a', quote: 'Reducing salt intake is one of the most cost-effective ways to improve health.' },
    { source_name: 'WHO', url: 'https://www.who.int/a', quote: 'Salt is the single biggest cause of heart disease in the world.' },
    { source_name: 'Blog', url: 'https://notwho.int/a', quote: 'Reducing salt intake is one of the most cost-effective ways.' },
    { source_name: 'WHO', url: 'http://www.who.int/a', quote: 'Reducing salt intake is one of the most cost-effective ways.' },
    { source_name: 'WHO', url: 'https://www.who.int/missing', quote: 'A page that cannot be downloaded at all, so it fails.' },
  ], fetchText);

  assert.equal(report.kept.length, 1);
  assert.equal(report.kept[0]!.verification, 'exact_match');
  assert.equal(report.kept[0]!.human_verified, false);
  assert.deepEqual(report.rejected.map((r) => r.why), [
    'duplicate',
    'not found word for word on the page',
    'site not on the trusted list',
    'not https',
    'page could not be downloaded',
  ]);
});

test('malformed model output is dropped, never repaired', () => {
  assert.deepEqual(parseCandidates('no json here'), []);
  assert.deepEqual(parseCandidates('{"quotes": "nope"}'), []);
  assert.equal(parseCandidates('Here: {"quotes":[{"source_name":"a","url":"b","quote":"c"},{"url":1}]}').length, 1);
  assert.equal(parseShaped('garbage').in_scope, false);
  assert.equal(parseShaped('{"in_scope": "true", "statement": "Something long enough here."}').in_scope, false);
  assert.equal(parseShaped('{"in_scope": true, "statement": "Older people can eat the same as at 30.", "domain": "nutrition"}').in_scope, true);
});

// ---------------------------------------------------------- the whole journey

const QUOTES = [
  'An elderly person needs fewer calories but more micronutrients than someone in mid-life.',
  'There is a strong association between salt intake and blood pressure.',
];

function setup(over: Partial<JourneyDeps> = {}) {
  const m = memoryStore();
  let clock = new Date('2026-10-05T10:00:00Z');
  const deps: JourneyDeps = {
    verifyUser: async (t) => (t === 'tok-dad' ? { id: 'user-dad-0001', email: 'dad@example.com' } : t === 'tok-stranger' ? { id: 'user-x', email: 'x@example.com' } : null),
    isAllowed: (e) => e === 'dad@example.com',
    shapeBelief: async () => ({ in_scope: true, statement: 'A person over 60 can eat the same as at 30.', domain: 'nutrition', reason: '' }),
    findCandidates: async () => QUOTES.map((quote) => ({ source_name: 'ICMR-NIN', url: 'https://www.nin.res.in/g.pdf', quote })),
    fetchText: async () => QUOTES.join(' '),
    turn: {
      draft: async () => 'I will not argue that.',
      decompose: async (text) => [{ text, kind: 'connective' }],
      judge: async () => ({ supported: false }),
    },
    now: () => clock,
    ...over,
  };
  const journey = createJourneyHandler(m.store, deps);
  const app = createHandler(m.store, {
    draft: async () => QUOTES[0]!,
    decompose: async (text) => [{ text, kind: 'assertion' }],
    judge: async (claim, ps) => {
      const p = ps.find((x) => x.quote === claim);
      return { supported: !!p, passageId: p?.id ?? null };
    },
  });
  const call = (step: string, body?: unknown, token = 'tok-dad') =>
    journey(
      new Request(`http://x/api/journey?step=${step}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  return { m, call, app, tick: (days: number) => (clock = new Date(clock.getTime() + days * 864e5)) };
}

const view = async (r: Response) => (await r.json()) as { stage: string; links: { brochure: string; chat: string } | null; instrument: { key: number }[] | null };

test('no login is a 401; a login not on the allow-list is a 403', async () => {
  const { call } = setup();
  assert.equal((await call('me', undefined, 'bad')).status, 401);
  assert.equal((await call('me', undefined, 'tok-stranger')).status, 403);
  const join = async (email: string) => ((await (await call('can_join', { email }, '')).json()) as { allowed: boolean }).allowed;
  assert.equal(await join('DAD@example.com '), true);
  assert.equal(await join('x@example.com'), false);
});

test('the whole journey, start to day 7, through the same pages a token link uses', async () => {
  const { m, call, app, tick } = setup();
  const step = async (name: string, body?: unknown) => {
    const r = await call(name, body);
    assert.equal(r.status, 200, `${name}: ${await r.clone().text()}`);
    return view(r);
  };

  assert.equal((await step('me')).stage, 'consent');
  assert.equal((await step('consent', {})).stage, 'belief');
  const proposal = (await (await call('propose', { text: 'I can eat everything like when I was young' })).json()) as { statement: string };
  assert.equal((await step('belief', { statement: proposal.statement, raw_text: 'I can eat everything' })).stage, 'reasons');
  assert.equal((await call('reasons', { answers: { origin: 'my father' } })).status, 400, 'the "why" answer is required');
  const v = await step('reasons', { answers: { why: 'My father ate everything and lived to 90.', doctor: '' } });
  assert.equal(v.stage, 'baseline');
  assert.equal(v.instrument!.length, 5, 'the belief and four controls');

  const scores = Object.fromEntries(v.instrument!.map((it) => [it.key, 80]));
  assert.equal((await step('baseline', { scores })).stage, 'sourcing');
  assert.equal((await call('baseline', { scores })).status, 409, 'the baseline is recorded once');

  const ready = await step('prepare', {});
  assert.equal(ready.stage, 'brochure');
  assert.ok(ready.links?.brochure && ready.links.chat);
  assert.ok(m.passages.every((p) => p.verification === 'exact_match'));
  assert.equal(m.measures.filter((x) => x.timepoint === 'baseline').length, 5);

  // The existing pages, through the tokens the journey handed out.
  const brochure = await app(new Request(`http://x/api/brochure?t=${ready.links!.brochure}`));
  assert.equal(brochure.status, 200);
  const measure = (t: string, tp: string) =>
    app(new Request('http://x/api/measure', { method: 'POST', body: JSON.stringify({ t, tp, scores }) }));
  assert.equal((await measure(ready.links!.brochure, 'post_brochure')).status, 200);
  assert.equal((await step('me')).stage, 'chat');

  const turn = await app(new Request('http://x/api/turn', { method: 'POST', body: JSON.stringify({ t: ready.links!.chat, message: 'why?' }) }));
  assert.equal(turn.status, 200);
  assert.equal((await measure(ready.links!.chat, 'post_treatment')).status, 200);
  assert.equal((await step('me')).stage, 'waiting');

  tick(7);
  m.backdate('post_treatment', 7);
  assert.equal((await step('me')).stage, 'delayed');
  assert.equal((await measure(ready.links!.chat, 'delayed')).status, 200);
  assert.equal((await step('me')).stage, 'done');
});

test('the reversal test runs automatically, aimed at their own belief, and is logged', async () => {
  const { m, call } = setup();
  await call('consent', {});
  await call('belief', { statement: 'A person over 60 can eat the same as at 30.' });
  const v = await view(await call('reasons', { answers: { why: 'Because.' } }));
  await call('baseline', { scores: Object.fromEntries(v.instrument!.map((it) => [it.key, 50])) });
  await call('prepare', {});
  const reversal = m.runs.find((r) => r.condition === 'reversal')!;
  assert.equal(m.turns.filter((t) => t.run_id === reversal.id).length, 2, 'the prompt and the system reply are logged');
});

test('with fewer than two verified quotes, the system says so instead of arguing', async () => {
  const { m, call } = setup({ fetchText: async () => 'A page that contains none of the proposed quotes.' });
  await call('consent', {});
  await call('belief', { statement: 'A person over 60 can eat the same as at 30.' });
  const v = await view(await call('reasons', { answers: { why: 'Because.' } }));
  await call('baseline', { scores: Object.fromEntries(v.instrument!.map((it) => [it.key, 50])) });
  const r = await view(await call('prepare', {}));
  assert.equal(r.stage, 'no_sources');
  assert.equal(r.links, null);
  assert.equal(m.runs.length, 0, 'no conversation is set up without sources');
});

test('steps cannot be skipped or repeated', async () => {
  const { call } = setup();
  assert.equal((await call('belief', { statement: 'Something long enough to count.' })).status, 409, 'no belief before consent');
  await call('consent', {});
  assert.equal((await call('reasons', { answers: { why: 'x' } })).status, 409, 'no reasons before a belief');
  await call('belief', { statement: 'A person over 60 can eat the same as at 30.' });
  assert.equal((await call('belief', { statement: 'A different belief entirely, later.' })).status, 409, 'one belief');
});
