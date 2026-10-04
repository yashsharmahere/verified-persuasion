/**
 * Does the gate actually catch bad claims?
 *
 * Run this BEFORE pointing the system at a person. A gate that has never been
 * tested against known-bad claims is an assumption, not a mechanism.
 *
 * Cases live in data/gate-cases.json — swap that file to change belief.
 * Each case pairs a claim with the passage it must be judged against, and
 * states the expected verdict.
 *
 * The cases that matter most are not the obvious fabrications. They are the
 * near-misses: a claim that overstates its passage by one degree. Those are
 * what a real conversation produces, and what a loose checker waves through.
 *
 *   npm run gate:test
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

const casesPath = new URL('../data/gate-cases.json', import.meta.url);
const cases: Case[] = JSON.parse(readFileSync(casesPath, 'utf8'));

async function main() {
  let passed = 0;
  const failures: string[] = [];

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
    } else {
      console.log(`  FAIL  ${c.id}  expected ${c.expected}, got ${got}`);
      failures.push(`${c.id}: ${c.tests}\n        claim: "${c.claim}"\n        judge said: ${verdict.reason ?? 'supported'}`);
    }
  }

  console.log(`\n${passed}/${cases.length} passed`);

  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    console.log(
      '\nA false NEGATIVE (supported claim marked unsupported) makes the system mute.',
      '\nA false POSITIVE (unsupported claim marked supported) is the dangerous one:',
      '\nit means unsourced claims reach the participant. Fix those before running.',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
