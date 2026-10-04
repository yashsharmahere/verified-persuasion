/**
 * Demo mode: the whole app with no database and no API key.
 *
 * The data is NOT a participant. It is a made-up belief over the source-checked
 * quotes from data/gate-cases.json, so every page can be clicked through.
 * The model calls are stubbed: the "drafter" quotes a passage, the "judge"
 * accepts a claim only if it contains a passage's quote verbatim. That shows
 * the flow, not the quality — `npm run gate:judge` is for quality.
 */
import { readFileSync } from 'node:fs';
import { memoryStore } from '../src/store.js';
import { buildBrochure } from '../src/brochure.js';
import type { TurnDeps } from '../src/converse.js';
import type { Passage } from '../src/types.js';

interface Case {
  source_checked?: boolean;
  passage: { source_name: string; source_url: string; quote: string };
}

export async function demoSetup() {
  const cases: Case[] = JSON.parse(readFileSync(new URL('../data/gate-cases.json', import.meta.url), 'utf8'));
  const seen = new Set<string>();
  const passages: (Passage & { belief_id: string })[] = [];
  for (const c of cases) {
    if (!c.source_checked || seen.has(c.passage.quote)) continue;
    seen.add(c.passage.quote);
    passages.push({
      id: `p${passages.length + 1}`,
      belief_id: 'demo-belief',
      source_name: c.passage.source_name,
      source_url: c.passage.source_url,
      source_domain: new URL(c.passage.source_url).hostname,
      quote: c.passage.quote,
      human_verified: true,
      applies_to: null,
    });
  }

  const { store } = memoryStore({
    beliefs: [
      {
        id: 'demo-belief',
        statement: 'DEMO — older adults need no more protein than younger adults.',
        domain: 'nutrition',
        source_whitelist: [...new Set(passages.map((p) => p.source_domain))],
        instrument: [
          { item: 'C1', text: 'Reading in dim light permanently damages your eyesight.' },
          { item: 'target', text: 'DEMO — older adults need no more protein than younger adults.' },
          { item: 'C2', text: 'Cold weather by itself causes colds.' },
        ],
      },
    ],
    reasons: [{ belief_id: 'demo-belief', code: 'demo', verbatim: 'I have always eaten the same way.', is_primary: true }],
    passages,
    runs: [
      { id: 'run-t', belief_id: 'demo-belief', condition: 'treatment', ended_at: null, access_token: 'demo-treatment-token' },
      { id: 'run-b', belief_id: 'demo-belief', condition: 'brochure', ended_at: null, access_token: 'demo-brochure-token' },
    ],
  });

  // The brochure is built once and stored, as brochure-run does for a real run.
  const belief = (await store.getBelief('demo-belief'))!;
  const { doc, assertions } = buildBrochure(belief, passages);
  const t = await store.insertTurn({
    run_id: 'run-b', idx: 0, speaker: 'system',
    drafted_text: null, sent_text: JSON.stringify(doc), redraft_count: 0,
  });
  await store.insertAssertions(assertions(t.id));

  let turn = 0;
  const deps: TurnDeps = {
    draft: async ({ passages: ps }) => {
      const p = ps[turn++ % ps.length]!;
      return `According to ${p.source_name}, "${p.quote}" What do you make of that?`;
    },
    decompose: async (text) =>
      text
        .split(/(?<=[.?!"])\s+(?=[A-Z])/)
        .map((s) => ({ text: s, kind: s.trim().endsWith('?') ? ('question' as const) : ('assertion' as const) })),
    judge: async (claim, passage) => ({ supported: claim.includes(passage.quote) }),
  };

  return {
    store,
    deps,
    links: [
      '{base}/chat.html?t=demo-treatment-token',
      '{base}/brochure.html?t=demo-brochure-token',
    ],
  };
}
