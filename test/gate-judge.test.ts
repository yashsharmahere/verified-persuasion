/**
 * Is the judge strict enough?
 *
 * Separate from `npm test` because this one calls a real model and costs money.
 * `npm test` covers the gate's control flow; this covers whether the entailment
 * judge gets the right answer on claims that are nearly right.
 *
 * Cases live in data/gate-cases.json — swap that file when the belief changes.
 *
 * The cases that matter are not the obvious fabrications. They are the
 * near-misses: a claim that overstates its passage by one degree. Those are what
 * a real conversation produces, and what a loose checker waves through.
 *
 *   ANTHROPIC_API_KEY=... npm run gate:judge
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { verifyFragment } from '../src/gate/verify.js';
import type { Passage } from '../src/types.js';

interface Case {
  id: string;
  claim: string;
  passage: { source_name: string; source_url: string; quote: string };
  expected: 'supported' | 'unsupported';
  /** Why this case exists — printed on failure. */
  tests: string;
  /**
   * Has a human opened the source and confirmed this quote is verbatim?
   *
   * This field exists because the fixtures once failed it. On 2026-10-04 two
   * ESPEN "quotes" here were paraphrases, and one of them had silently widened
   * the source's population from "older people who are malnourished or at risk
   * of malnutrition because they have acute or chronic illness" to "older adults
   * who have acute or chronic illnesses" — the same drift the gate exists to
   * catch, committed in the gate's own test data.
   *
   * A harness that grades a judge against invented quotes grades nothing.
   */
  source_checked: boolean;
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set, so the judge cannot be tested.\n' +
      'This test calls a real model on purpose: the question it answers is\n' +
      'whether the judge is strict enough on near-miss claims, and a stub\n' +
      'cannot answer that.\n\n' +
      'Run `npm test` for the gate control-flow tests, which need no key.',
  );
  process.exit(1);
}

const casesPath = new URL('../data/gate-cases.json', import.meta.url);
const cases: Case[] = JSON.parse(readFileSync(casesPath, 'utf8'));

const unchecked = cases.filter((c) => !c.source_checked);
if (unchecked.length) {
  console.log(
    `\nNote: ${unchecked.length} case(s) carry a quote nobody has confirmed against\n` +
      `the source: ${unchecked.map((c) => c.id).join(', ')}.\n` +
      `Their verdicts grade the judge against text that may not exist as written.\n`,
  );
}

// A judge that rejects everything would pass a harness made only of
// unsupported cases. Refuse to run one.
const supportedCases = cases.filter((c) => c.expected === 'supported').length;
if (supportedCases < 2) {
  console.error(
    `Only ${supportedCases} case(s) expect "supported". A judge that rejects\n` +
      `every claim would score well on this harness and be useless in practice.\n` +
      `Add cases a correct judge must accept.`,
  );
  process.exit(1);
}

async function main() {
  let passed = 0;
  const failures: { severity: 'critical' | 'minor'; detail: string }[] = [];

  for (const c of cases) {
    const passage: Passage = {
      id: c.id,
      source_name: c.passage.source_name,
      source_url: c.passage.source_url,
      source_domain: new URL(c.passage.source_url).hostname,
      quote: c.passage.quote,
      human_verified: true,
      applies_to: null,
    };

    const verdict = await verifyFragment({ text: c.claim, kind: 'assertion' }, [passage]);
    const got = verdict.supported ? 'supported' : 'unsupported';

    if (got === c.expected) {
      passed++;
      console.log(`  pass  ${c.id}`);
      continue;
    }

    // A false positive lets an unsourced claim reach the participant.
    // A false negative only makes the system quieter than it needs to be.
    const severity = c.expected === 'unsupported' ? 'critical' : 'minor';
    console.log(`  FAIL  ${c.id}  expected ${c.expected}, got ${got}  [${severity}]`);
    failures.push({
      severity,
      detail:
        `${c.id} — ${c.tests}\n` +
        `        claim: "${c.claim}"\n` +
        `        judge: ${verdict.reason ?? 'supported'}`,
    });
  }

  console.log(`\n${passed}/${cases.length} passed`);

  if (failures.length === 0) return;

  const critical = failures.filter((f) => f.severity === 'critical');
  const minor = failures.filter((f) => f.severity === 'minor');

  if (critical.length) {
    console.log(`\nCRITICAL — unsupported claims the judge let through (${critical.length}):`);
    for (const f of critical) console.log(`  - ${f.detail}`);
    console.log(
      '\nThese reach the participant. The judge prompt needs to be stricter\n' +
        'before running this on a person.',
    );
  }

  if (minor.length) {
    console.log(`\nMinor — supported claims the judge rejected (${minor.length}):`);
    for (const f of minor) console.log(`  - ${f.detail}`);
    console.log('\nThese make the system mute, not wrong. Tolerable, worth watching.');
  }

  process.exit(critical.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
