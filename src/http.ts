import { runTurn, openingText, TurnError, REFUSAL_TEXT, type TurnDeps } from './converse.js';
import type { Store, Run, Timepoint, MeasureRow } from './store.js';

/**
 * HTTP handlers, written against the web-standard Request/Response so the same
 * code runs as Vercel functions (api/*.ts) and under the local dev server.
 *
 * A participant's browser holds one thing: the run's access token from their
 * link. It never sees the service key, the passages table, or which scale item
 * is the target.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Which measurement each kind of link may submit. */
const ALLOWED_TIMEPOINTS: Record<Run['condition'], Timepoint[]> = {
  brochure: ['post_brochure'],
  treatment: ['post_treatment', 'delayed'],
  reversal: [],
};

export function createHandler(store: Store, deps: TurnDeps = {}) {
  async function runFor(token: unknown): Promise<Run> {
    if (typeof token !== 'string' || token.length < 16) throw new TurnError(404, 'Link not recognised.');
    const run = await store.getRunByToken(token);
    if (!run) throw new TurnError(404, 'Link not recognised.');
    return run;
  }

  async function body(req: Request): Promise<Record<string, unknown>> {
    try {
      const b = await req.json();
      return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
    } catch {
      throw new TurnError(400, 'Request body must be JSON.');
    }
  }

  /** GET /api/session?t= — what a chat page needs to render. Starts the transcript on first visit. */
  async function session(req: Request) {
    const run = await runFor(new URL(req.url).searchParams.get('t'));
    if (run.condition !== 'treatment') throw new TurnError(400, 'This link is not for a conversation.');
    const belief = await store.getBelief(run.belief_id);
    if (!belief) throw new TurnError(404, 'Belief not found.');

    let turns = await store.listTurns(run.id);
    if (turns.length === 0) {
      // The opening is logged as turn 0 so the stored transcript is exactly what
      // the participant saw.
      await store.insertTurn({
        run_id: run.id,
        idx: 0,
        speaker: 'system',
        drafted_text: null,
        sent_text: openingText(belief.statement),
        redraft_count: 0,
      });
      turns = await store.listTurns(run.id);
    }

    return json(200, {
      ended: !!run.ended_at,
      turns: turns.map((t) => ({ speaker: t.speaker, text: t.sent_text ?? REFUSAL_TEXT })),
    });
  }

  /** POST /api/turn {t, message} */
  async function turn(req: Request) {
    const b = await body(req);
    const run = await runFor(b.t);
    if (run.condition !== 'treatment') throw new TurnError(400, 'This link is not for a conversation.');
    if (typeof b.message !== 'string') throw new TurnError(400, 'Message is missing.');
    return json(200, await runTurn(store, run, b.message, deps));
  }

  /** POST /api/end {t} — the participant says they are done talking. */
  async function end(req: Request) {
    const run = await runFor((await body(req)).t);
    if (run.condition !== 'treatment') throw new TurnError(400, 'This link is not for a conversation.');
    if (!run.ended_at) await store.endRun(run.id);
    return json(200, { ended: true });
  }

  /** GET /api/brochure?t= — the fixed document, exactly as stored when it was built. */
  async function brochure(req: Request) {
    const run = await runFor(new URL(req.url).searchParams.get('t'));
    if (run.condition !== 'brochure') throw new TurnError(400, 'This link is not for the brochure.');
    const doc = (await store.listTurns(run.id)).find((t) => t.speaker === 'system' && t.sent_text);
    if (!doc) throw new TurnError(503, 'The brochure has not been built yet.');
    return json(200, JSON.parse(doc.sent_text!));
  }

  /**
   * GET /api/instrument?t=&tp= — the scale items, in their fixed order, keyed by
   * position. The labels ("target", "C1") stay on the server.
   */
  async function instrument(req: Request) {
    const url = new URL(req.url);
    const run = await runFor(url.searchParams.get('t'));
    const tp = timepointFor(run, url.searchParams.get('tp'));
    const belief = await store.getBelief(run.belief_id);
    if (!belief || belief.instrument.length === 0) throw new TurnError(503, 'No questions are set up for this link.');
    const done = (await store.listMeasures(belief.id, tp)).length > 0;
    return json(200, {
      timepoint: tp,
      submitted: done,
      items: belief.instrument.map((it, key) => ({ key, text: it.text })),
    });
  }

  /** POST /api/measure {t, tp, scores: {key: 0..100}, open_response, collected_by} */
  async function measure(req: Request) {
    const b = await body(req);
    const run = await runFor(b.t);
    const tp = timepointFor(run, b.tp);
    const belief = await store.getBelief(run.belief_id);
    if (!belief || belief.instrument.length === 0) throw new TurnError(503, 'No questions are set up for this link.');
    if ((await store.listMeasures(belief.id, tp)).length > 0) {
      throw new TurnError(409, 'These answers have already been recorded.');
    }

    const rows = measureRows(belief.id, tp, belief.instrument, b);
    await store.insertMeasures(rows);
    return json(200, { recorded: rows.length });
  }

  const routes: Record<string, Record<string, (req: Request) => Promise<Response>>> = {
    '/api/session': { GET: session },
    '/api/turn': { POST: turn },
    '/api/end': { POST: end },
    '/api/brochure': { GET: brochure },
    '/api/instrument': { GET: instrument },
    '/api/measure': { POST: measure },
  };

  return async function handle(req: Request): Promise<Response> {
    const route = routes[new URL(req.url).pathname];
    const fn = route?.[req.method];
    if (!fn) return json(route ? 405 : 404, { error: 'Not found.' });
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof TurnError) return json(err.status, { error: err.message });
      // Log the detail server-side; the participant gets a plain message.
      console.error(err);
      return json(500, { error: 'Something went wrong. Please try again in a moment.' });
    }
  };
}

function timepointFor(run: Run, tp: unknown): Timepoint {
  const allowed = ALLOWED_TIMEPOINTS[run.condition];
  if (typeof tp !== 'string' || !allowed.includes(tp as Timepoint)) {
    throw new TurnError(400, 'This link cannot record that measurement.');
  }
  return tp as Timepoint;
}

/** Every item must be answered with a whole number from 0 to 100. Partial forms are rejected. */
export function measureRows(
  beliefId: string,
  tp: Timepoint,
  instrument: { item: string }[],
  b: Record<string, unknown>,
): MeasureRow[] {
  const scores = (b.scores && typeof b.scores === 'object' ? b.scores : {}) as Record<string, unknown>;
  const open = typeof b.open_response === 'string' && b.open_response.trim() ? b.open_response.trim().slice(0, 4000) : null;
  const by = typeof b.collected_by === 'string' && b.collected_by.trim() ? b.collected_by.trim().slice(0, 200) : null;

  return instrument.map((it, key) => {
    const s = scores[String(key)];
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 100) {
      throw new TurnError(400, 'Please answer every question with a number from 0 to 100.');
    }
    return {
      belief_id: beliefId,
      timepoint: tp,
      item: it.item,
      score: s,
      // The open question is about the target; store it once, on the target row.
      open_response: it.item === 'target' ? open : null,
      collected_by: by,
    };
  });
}
