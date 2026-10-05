/**
 * Gate control-flow tests. No API key, no network, no model.
 *
 * These cover the deterministic half of the gate: what it does with a judge's
 * answer, not whether the judge is right. The judge's quality is a separate
 * question tested by `npm run gate:judge` against a real model.
 *
 * The property every test here defends: NO PATH THROUGH THIS CODE TURNS AN
 * UNVERIFIED CLAIM INTO A SENT ONE. Errors, malformed output, unknown labels
 * and empty retrieval must all fail closed.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  runGate,
  verifyFragment,
  verifyAll,
  parseJudgeOutput,
  parseFragments,
  buildFeedback,
  stripUnsupported,
  type Judge,
} from '../src/gate/index.js';
import type { Passage, Fragment } from '../src/types.js';

const passage = (id: string, quote: string): Passage => ({
  id,
  source_name: 'Test Source',
  source_url: 'https://example.org/doc',
  source_domain: 'example.org',
  quote,
  human_verified: true,
  applies_to: null,
});

const P = [passage('p1', 'first passage'), passage('p2', 'second passage')];

const alwaysSupports: Judge = async (_claim, ps) => ({ supported: true, passageId: ps[0]!.id });
const neverSupports: Judge = async () => ({ supported: false, reason: 'not entailed' });
/** A judge that supports a claim (citing the first passage) when the predicate holds. */
const byClaim =
  (ok: (claim: string) => boolean): Judge =>
  async (claim, ps) =>
    ok(claim) ? { supported: true, passageId: ps[0]!.id } : { supported: false, reason: 'not entailed' };

// ---------------------------------------------------------------- verifyFragment

test('non-assertions pass without consulting the judge', async () => {
  let called = 0;
  const judge: Judge = async () => {
    called++;
    return { supported: false };
  };

  for (const kind of ['question', 'reflection', 'connective'] as const) {
    const v = await verifyFragment({ text: 'x', kind }, P, judge);
    assert.equal(v.supported, true, `${kind} should pass`);
    assert.equal(v.passageId, null, `${kind} should cite no passage`);
  }
  assert.equal(called, 0, 'judge must not be called for non-assertions');
});

test('an assertion with no retrieved passages is unsupported', async () => {
  const v = await verifyFragment({ text: 'claim', kind: 'assertion' }, [], alwaysSupports);
  assert.equal(v.supported, false);
  assert.match(v.reason ?? '', /No passages retrieved/);
});

test('the supporting passage is the one the judge names, not the first sent', async () => {
  const judge: Judge = async () => ({ supported: true, passageId: 'p2' });
  const v = await verifyFragment({ text: 'claim', kind: 'assertion' }, P, judge);
  assert.equal(v.supported, true);
  assert.equal(v.passageId, 'p2', 'must record which passage actually entailed it');
});

test('one judge call per claim, however many passages there are', async () => {
  let called = 0;
  let sent = 0;
  const judge: Judge = async (_claim, ps) => {
    called++;
    sent = ps.length;
    return { supported: false };
  };
  await verifyFragment({ text: 'claim', kind: 'assertion' }, P, judge);
  assert.equal(called, 1, 'checking a claim costs one call, not one per passage');
  assert.equal(sent, P.length, 'the judge sees every retrieved passage');
});

test('support that names no passage, or one that was not checked, fails closed', async () => {
  for (const passageId of [undefined, null, 'p9']) {
    const judge: Judge = async () => ({ supported: true, passageId });
    const v = await verifyFragment({ text: 'claim', kind: 'assertion' }, P, judge);
    assert.equal(v.supported, false, `passageId ${passageId} must not count as support`);
    assert.equal(v.passageId, null);
  }
});

test('a claim no passage entails is unsupported', async () => {
  const v = await verifyFragment({ text: 'claim', kind: 'assertion' }, P, neverSupports);
  assert.equal(v.supported, false);
  assert.equal(v.passageId, null);
});

test('a judge that throws fails closed', async () => {
  const judge: Judge = async () => {
    throw new Error('rate limited');
  };
  const v = await verifyFragment({ text: 'claim', kind: 'assertion' }, P, judge);
  assert.equal(v.supported, false, 'an API error must never read as support');
  assert.match(v.reason ?? '', /rate limited/);
});

// ------------------------------------------------------------- parseJudgeOutput

test('the passage number is read only when it is a positive whole number', () => {
  assert.equal(parseJudgeOutput('{"supported": true, "passage": 2}').passage, 2);
  for (const bad of ['"2"', '0', '-1', '1.5', 'null']) {
    assert.equal(parseJudgeOutput(`{"supported": true, "passage": ${bad}}`).passage, undefined, bad);
  }
});

test('only a literal true counts as support', () => {
  assert.equal(parseJudgeOutput('{"supported": true}').supported, true);
  assert.equal(parseJudgeOutput('{"supported": false}').supported, false);
  // Truthy-but-not-true values must not pass. A model that answers "true" as a
  // string, or 1, has not given the answer the schema asks for.
  assert.equal(parseJudgeOutput('{"supported": "true"}').supported, false);
  assert.equal(parseJudgeOutput('{"supported": 1}').supported, false);
  assert.equal(parseJudgeOutput('{"reason": "no verdict"}').supported, false);
});

test('fenced and prose-wrapped JSON still parse', () => {
  assert.equal(parseJudgeOutput('```json\n{"supported": true}\n```').supported, true);
  assert.equal(parseJudgeOutput('Here is my verdict: {"supported": true} — done').supported, true);
});

test('unparseable judge output is unsupported', () => {
  for (const bad of ['', 'supported', '{broken', 'null']) {
    assert.equal(parseJudgeOutput(bad).supported, false, `"${bad}" must not pass`);
  }
});

// -------------------------------------------------------------- parseFragments

test('an unrecognised label becomes an assertion', () => {
  const out = parseFragments('{"fragments":[{"text":"a","kind":"banter"}]}');
  assert.equal(out[0]?.kind, 'assertion', 'unknown labels must not skip verification');
});

test('a missing label becomes an assertion', () => {
  const out = parseFragments('{"fragments":[{"text":"a"}]}');
  assert.equal(out[0]?.kind, 'assertion');
});

test('known labels survive', () => {
  const out = parseFragments(
    '{"fragments":[{"text":"a","kind":"question"},{"text":"b","kind":"connective"}]}',
  );
  assert.equal(out[0]?.kind, 'question');
  assert.equal(out[1]?.kind, 'connective');
});

test('empty and whitespace fragments are dropped', () => {
  const out = parseFragments('{"fragments":[{"text":"a"},{"text":"   "},{"text":""}]}');
  assert.equal(out.length, 1);
});

test('a response with no fragments array throws rather than returning nothing', () => {
  // Returning [] would mean "no claims to check", which reads as a clean pass.
  assert.throws(() => parseFragments('{"result":"ok"}'), /no fragments array/);
});

// -------------------------------------------------------------------- runGate

const splitSentences: Fragment[] | undefined = undefined;
void splitSentences;

/** Decomposer that labels every sentence an assertion. */
const naiveDecompose = async (text: string): Promise<Fragment[]> =>
  text
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ text: s, kind: 'assertion' as const }));

test('a fully supported draft is sent on the first attempt', async () => {
  const result = await runGate(async () => 'Claim one. Claim two.', P, {
    decompose: naiveDecompose,
    judge: alwaysSupports,
  });

  assert.equal(result.refused, false);
  assert.equal(result.sentText, 'Claim one. Claim two.');
  assert.equal(result.redraftCount, 0);
  assert.equal(result.verdicts.length, 2);
});

test('an unsupported claim triggers a redraft, and a clean redraft is sent', async () => {
  const drafts = ['Bad claim. Good claim.', 'Good claim.'];
  let n = 0;
  const seenFeedback: (string | null)[] = [];

  const judge = byClaim((claim) => !claim.includes('Bad'));

  const result = await runGate(
    async (feedback) => {
      seenFeedback.push(feedback);
      return drafts[n++] ?? '';
    },
    P,
    { decompose: naiveDecompose, judge },
  );

  assert.equal(result.refused, false);
  assert.equal(result.sentText, 'Good claim.');
  assert.equal(result.redraftCount, 1);
  assert.equal(seenFeedback[0], null, 'first attempt gets no feedback');
  assert.match(seenFeedback[1] ?? '', /Bad claim/, 'redraft must name the offending claim');
});

test('the gate refuses rather than sending an unverified turn', async () => {
  let attempts = 0;
  const result = await runGate(
    async () => {
      attempts++;
      return 'Still bad.';
    },
    P,
    { decompose: naiveDecompose, judge: neverSupports },
  );

  assert.equal(result.refused, true);
  assert.equal(result.sentText, null, 'nothing may be sent when claims are unsupported');
  assert.equal(result.redraftCount, 2);
  assert.equal(attempts, 3, 'one initial attempt plus two redrafts');
  assert.equal(result.draftedText, 'Still bad.', 'the rejected draft is kept for the log');
});

test('a turn of only questions and connectives is sent without any judge call', async () => {
  let called = 0;
  const judge: Judge = async () => {
    called++;
    return { supported: false };
  };

  const result = await runGate(async () => 'Why do you think that?', P, {
    decompose: async () => [{ text: 'Why do you think that?', kind: 'question' }],
    judge,
  });

  assert.equal(result.refused, false);
  assert.equal(called, 0);
});

test('one bad claim among many still blocks the turn', async () => {
  const judge = byClaim((claim) => !claim.includes('Bad'));
  const result = await runGate(async () => 'Good one. Good two. Bad three. Good four.', P, {
    decompose: naiveDecompose,
    judge,
    maxRedrafts: 0,
  });

  assert.equal(result.refused, true, 'a single unsupported claim is enough to block');
  assert.equal(result.verdicts.filter((v) => !v.supported).length, 1);
});

// ------------------------------------------------------------------ helpers

test('feedback names every unsupported claim and forbids hedging', async () => {
  const verdicts = await verifyAll(
    [
      { text: 'bad one', kind: 'assertion' },
      { text: 'bad two', kind: 'assertion' },
    ],
    P,
    neverSupports,
  );

  const fb = buildFeedback(verdicts);
  assert.match(fb, /bad one/);
  assert.match(fb, /bad two/);
  assert.match(fb, /hedged/, 'must tell the model not to soften the claim instead of dropping it');
});

test('stripUnsupported removes every occurrence of a bad claim', async () => {
  const verdicts = await verifyAll([{ text: 'bad', kind: 'assertion' }], P, neverSupports);
  const out = stripUnsupported('good bad middle bad end', verdicts);
  assert.equal(out.includes('bad'), false, 'a repeated claim must not survive');
  assert.equal(out, 'good middle end');
});

test('stripUnsupported leaves a fully supported draft untouched', async () => {
  const verdicts = await verifyAll([{ text: 'fine', kind: 'assertion' }], P, alwaysSupports);
  assert.equal(stripUnsupported('fine as it is', verdicts), 'fine as it is');
});
