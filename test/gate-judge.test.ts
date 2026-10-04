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
