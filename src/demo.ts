/**
 * Demo mode: the whole app with no database and no API key.
 *
 * The data is NOT a participant. It is a made-up belief over the source-checked
 * quotes from data/gate-cases.json, so every page can be clicked through.
 * The model calls are stubbed: the "drafter" quotes a passage, the "judge"
 * accepts a claim only if it contains a passage's quote verbatim. That shows
 * the flow, not the quality — `npm run gate:judge` is for quality.
 *
 * Used by `npm run dev -- --demo` and by the public demo on the live site
 * (api/demo.ts), which gives every visitor their own copy.
 */
import cases from '../data/gate-cases.json' with { type: 'json' };
import { createHandler } from './http.js';
import { memoryStore } from './store.js';
import { buildBrochure } from './brochure.js';
import type { TurnDeps } from './converse.js';
import type { Passage } from './types.js';

interface Case {
  source_checked?: boolean;
  passage: { source_name: string; source_url: string; quote: string };
}

export async function demoSetup(tokens = { treatment: 'demo-treatment-token', brochure: 'demo-brochure-token' }) {
  const seen = new Set<string>();
  const passages: (Passage & { belief_id: string })[] = [];
  for (const c of cases as Case[]) {
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
      { id: 'run-t', belief_id: 'demo-belief', condition: 'treatment', ended_at: null, access_token: tokens.treatment },
      { id: 'run-b', belief_id: 'demo-belief', condition: 'brochure', ended_at: null, access_token: tokens.brochure },
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
      `{base}/chat.html?t=${tokens.treatment}`,
      `{base}/brochure.html?t=${tokens.brochure}`,
    ],
  };
}

/** The routes the demo forwards to; the same handlers a real link uses. */
const DEMO_ROUTES = new Set(['session', 'turn', 'end', 'brochure', 'instrument', 'measure']);

/** A visitor's links are demo-<id>-t (chat) and demo-<id>-b (brochure); <id> is random, from their browser. */
const DEMO_TOKEN = /^demo-([a-z0-9]{16,64})-[tb]$/;

/** Visitors kept in memory at once. The oldest is dropped first; nothing about a demo is worth keeping. */
const MAX_VISITORS = 500;

/**
 * The public demo: /api/demo?route=<name> with a demo-* token, forwarded to the
 * same handlers as /api/<name>. Each visitor id gets its own in-memory copy of
 * the demo, so visitors never see each other's conversations. It touches no
 * database and calls no model. State lives only as long as the function
 * instance does; a visitor who comes back to a fresh instance starts over.
 */
export function createDemoHandler() {
  const visitors = new Map<string, Promise<(req: Request) => Promise<Response>>>();
  const notFound = () =>
    new Response(JSON.stringify({ error: 'Demo link not recognised.' }), {
      status: 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });

  function handlerFor(id: string) {
    let h = visitors.get(id);
    if (h) {
      visitors.delete(id); // re-inserted below: most recently used goes last
    } else {
      h = demoSetup({ treatment: `demo-${id}-t`, brochure: `demo-${id}-b` }).then(({ store, deps }) =>
        createHandler(store, deps),
      );
    }
    visitors.set(id, h);
    while (visitors.size > MAX_VISITORS) visitors.delete(visitors.keys().next().value!);
    return h;
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const route = url.searchParams.get('route') ?? '';
    if (!DEMO_ROUTES.has(route)) return notFound();

    let token = url.searchParams.get('t');
    let body: string | undefined;
    if (req.method === 'POST') {
      body = await req.text();
      try {
        token = (JSON.parse(body) as { t?: unknown }).t as string;
      } catch {
        token = null; // the real handler reports the bad JSON once it is forwarded
      }
    }
    const id = typeof token === 'string' ? DEMO_TOKEN.exec(token)?.[1] : undefined;
    if (!id) return notFound();

    url.pathname = `/api/${route}`;
    url.searchParams.delete('route');
    const handler = await handlerFor(id);
    return handler(new Request(url, { method: req.method, headers: req.headers, body }));
  };
}
