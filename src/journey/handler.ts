import { createHash, randomBytes } from 'node:crypto';
import { buildBrochure } from '../brochure.js';
import { assertionRows, TurnError, type TurnDeps } from '../converse.js';
import { modelDraft } from '../draft.js';
import { runGate } from '../gate/index.js';
import { measureRows } from '../http.js';
import { selectPassages } from '../retrieve.js';
import type { FullStore, InstrumentItem, JourneyBelief, Participant, Timepoint } from '../store.js';
import { modelShapeBelief, type BeliefShaper } from './shape.js';
import {
  fetchPageText,
  isTopic,
  modelFindCandidates,
  SOURCE_LISTS,
  verifyCandidates,
  type Candidate,
  type PageFetcher,
} from './sourcing.js';

/**
 * The self-serve journey, open to anyone: consent, state a belief, say why, rate it,
 * then the system finds sources, builds the brochure, runs the reversal test,
 * and hands over the same brochure, chat and form pages a token link uses.
 *
 * The server decides which step a person is on from what is stored, so no one
 * can skip a step or answer one twice.
 *
 * No login. Consenting creates a participant and a random key; the browser
 * keeps the key and sends it with every step, and a private link carrying it
 * lets the person come back from any device for the day-7 questions. Only
 * the key's hash is stored.
 */

export interface JourneyDeps {
  /**
   * New beliefs allowed in any 24 hours, across everyone. Each one costs a
   * sourcing search and a reversal run, so an open site needs a ceiling.
   * New participants are capped at three times this.
   */
  dailyLimit?: number;
  shapeBelief?: BeliefShaper;
  findCandidates?: (statement: string, reasons: string[], domains: string[]) => Promise<Candidate[]>;
  fetchText?: PageFetcher;
  /** For the automatic reversal run. */
  turn?: TurnDeps;
  now?: () => Date;
}

/** Unrelated statements rated alongside the belief. If only the belief moves, that is signal. */
export const CONTROLS: InstrumentItem[] = [
  { item: 'C1', text: 'Reading in dim light permanently damages your eyesight.' },
  { item: 'C2', text: 'Cold weather by itself causes colds.' },
  { item: 'C3', text: 'Most petrol cars will be gone from Indian roads within 15 years.' },
  { item: 'C4', text: 'Cracking your knuckles causes arthritis.' },
];

/** The intake interview, as questions on screen. "why" is the reason the conversation answers first. */
export const QUESTIONS = [
  { code: 'why', text: 'In your own words, why do you believe this?', required: true },
  { code: 'origin', text: 'Where did this idea come from? Your family, someone you know, something you read or saw?', required: false },
  { code: 'trust', text: 'When it comes to this topic, whose advice do you trust? An expert, the government, family, something else?', required: false },
  { code: 'distrust', text: "Whose advice on this do you NOT trust, and why?", required: false },
  { code: 'change_mind', text: 'Is there anything that would make you think differently? What would you need to see?', required: false },
  { code: 'doctor', text: 'Has a doctor ever told you anything about this for your own health? (You can leave this empty.)', required: false },
] as const;

const EXPERT = { code: 'expert', text: 'Has an expert or professional ever told you anything about this? (You can leave this empty.)', required: false } as const;

/** The doctor question only makes sense for health beliefs; elsewhere it asks about any expert. */
export function questionsFor(topic: string) {
  return topic === 'health' ? [...QUESTIONS] : [...QUESTIONS.slice(0, -1), EXPERT];
}

const MIN_SOURCES = 2;
const DEFAULT_DAILY_LIMIT = 20;
const BUSY = 'Lots of people have taken part today, so new sign-ups are paused until tomorrow. Please come back then.';

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');
const DAY_MS = 864e5;
const MAX_ANSWER = 2000;

export type Stage =
  | 'consent'
  | 'belief'
  | 'reasons'
  | 'baseline'
  | 'sourcing'
  | 'no_sources'
  | 'brochure'
  | 'chat'
  | 'waiting'
  | 'delayed'
  | 'done';

/** Which step comes next, from what is stored. Pure, so it is tested on its own. */
export function stageOf(s: {
  consented: boolean;
  belief: Pick<JourneyBelief, 'status'> | null;
  reasons: number;
  times: Partial<Record<Timepoint, string>>;
  now: Date;
}): { stage: Stage; due?: string } {
  if (!s.consented) return { stage: 'consent' };
  if (!s.belief) return { stage: 'belief' };
  if (s.reasons === 0) return { stage: 'reasons' };
  if (!s.times.baseline) return { stage: 'baseline' };
  if (s.belief.status === 'no_sources') return { stage: 'no_sources' };
  if (s.belief.status !== 'ready') return { stage: 'sourcing' };
  if (!s.times.post_brochure) return { stage: 'brochure' };
  if (!s.times.post_treatment) return { stage: 'chat' };
  if (!s.times.delayed) {
    const due = new Date(Date.parse(s.times.post_treatment) + 7 * DAY_MS);
    return s.now >= due ? { stage: 'delayed' } : { stage: 'waiting', due: due.toISOString() };
  }
  return { stage: 'done' };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export function createJourneyHandler(store: FullStore, deps: JourneyDeps) {
  const shape = deps.shapeBelief ?? modelShapeBelief;
  const findSources = deps.findCandidates ?? modelFindCandidates;
  const fetchText = deps.fetchText ?? fetchPageText;
  const now = deps.now ?? (() => new Date());

  const limit = deps.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const since = () => new Date(now().getTime() - DAY_MS).toISOString();

  const keyOf = (req: Request) => (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

  /** The participant whose key came with the request, or null. */
  async function find(req: Request) {
    const key = keyOf(req);
    return key.length >= 20 ? store.getParticipantByKey(hashKey(key)) : null;
  }

  async function participant(req: Request) {
    const p = await find(req);
    if (!p) throw new TurnError(401, 'We couldn’t find your progress. Please start again.');
    return p;
  }

  async function body(req: Request): Promise<Record<string, unknown>> {
    try {
      const b = await req.json();
      return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
    } catch {
      throw new TurnError(400, 'Request body must be JSON.');
    }
  }

  /** Everything the page needs to show the right step. */
  async function state(participant: Participant | null) {
    const belief = participant ? await store.getBeliefByParticipant(participant.id) : null;
    const reasons = belief ? (await store.listReasons(belief.id)).length : 0;
    const times = belief ? await store.measureTimes(belief.id) : {};
    const { stage, due } = stageOf({ consented: !!participant?.consented_at, belief, reasons, times, now: now() });
    const runs = belief?.status === 'ready' ? await store.listRuns(belief.id) : [];
    const token = (c: string) => runs.find((r) => r.condition === c)?.access_token;
    return {
      participant,
      belief,
      view: {
        stage,
        due: due ?? null,
        statement: belief?.statement ?? null,
        instrument: stage === 'baseline' && belief ? belief.instrument.map((it, key) => ({ key, text: it.text })) : null,
        questions: stage === 'reasons' && belief ? questionsFor(belief.domain) : null,
        links: runs.length ? { brochure: token('brochure'), chat: token('treatment') } : null,
      },
    };
  }

  const steps: Record<string, (req: Request) => Promise<Response>> = {
    async me(req) {
      return json(200, (await state(await find(req))).view);
    },

    /** Agreeing creates the participant and their key. The key is returned once; only its hash is kept. */
    async consent(req) {
      const existing = await find(req);
      if (existing) return json(200, (await state(existing)).view);
      if ((await store.countCreatedSince(since())).participants >= limit * 3) throw new TurnError(429, BUSY);
      const key = randomBytes(24).toString('base64url');
      const p = await store.createParticipant({
        key_hash: hashKey(key),
        label: `web-${randomBytes(4).toString('hex')}`,
        consented_at: now().toISOString(),
        disclosed_ai: true,
      });
      return json(200, { ...(await state(p)).view, key });
    },

    /** Shape what they typed into one statement. Saves nothing: they confirm or edit it first. */
    async propose(req) {
      const p = await participant(req);
      if ((await state(p)).view.stage !== 'belief') throw new TurnError(409, 'Your belief is already recorded.');
      const text = String((await body(req)).text ?? '').trim();
      if (text.length < 5) throw new TurnError(400, 'Please write your belief in a sentence or two.');
      return json(200, await shape(text.slice(0, 1000)));
    },

    async belief(req) {
      const p = await participant(req);
      const s = await state(p);
      if (s.view.stage !== 'belief' || !s.participant) throw new TurnError(409, 'Your belief is already recorded.');
      if ((await store.countCreatedSince(since())).beliefs >= limit) throw new TurnError(429, BUSY);
      const b = await body(req);
      const statement = String(b.statement ?? '').trim();
      if (statement.length < 10 || statement.length > 300) throw new TurnError(400, 'Please write the statement in one sentence.');
      const instrument = shuffle([{ item: 'target', text: statement }, ...CONTROLS]);
      // The topic decides which trusted sites are searched; it is stored as the belief's domain.
      const topic = isTopic(b.category) ? b.category : 'science';
      await store.createBelief({
        participant_id: s.participant.id,
        statement,
        raw_text: String(b.raw_text ?? '').slice(0, 1000),
        domain: topic,
        source_whitelist: SOURCE_LISTS[topic],
        instrument,
      });
      return json(200, (await state(p)).view);
    },

    async reasons(req) {
      const p = await participant(req);
      const s = await state(p);
      if (s.view.stage !== 'reasons' || !s.belief) throw new TurnError(409, 'Your answers are already recorded.');
      const answers = ((await body(req)).answers ?? {}) as Record<string, unknown>;
      const rows = questionsFor(s.belief.domain).map((q) => ({ q, text: typeof answers[q.code] === 'string' ? (answers[q.code] as string).trim() : '' }))
        .filter(({ q, text }) => {
          if (q.required && !text) throw new TurnError(400, 'Please answer the first question.');
          return !!text;
        })
        .map(({ q, text }) => ({ belief_id: s.belief!.id, code: q.code, verbatim: text.slice(0, MAX_ANSWER), is_primary: q.code === 'why' }));
      await store.insertReasons(rows);
      return json(200, (await state(p)).view);
    },

    async baseline(req) {
      const p = await participant(req);
      const s = await state(p);
      if (s.view.stage !== 'baseline' || !s.belief) throw new TurnError(409, 'These answers are already recorded.');
      await store.insertMeasures(measureRows(s.belief.id, 'baseline', s.belief.instrument, await body(req)));
      return json(200, (await state(p)).view);
    },

    /**
     * Find and verify sources, create the runs, build the brochure, run the
     * reversal test. Each part is skipped if already done, so a retry after a
     * failure picks up where it stopped.
     */
    async prepare(req) {
      const p = await participant(req);
      const s = await state(p);
      if (s.view.stage !== 'sourcing' || !s.belief) return json(200, s.view);
      const belief = s.belief;

      let passages = await store.listPassages(belief.id);
      if (passages.length === 0) {
        await store.setBeliefStatus(belief.id, 'sourcing');
        const reasons = (await store.listReasons(belief.id)).map((r) => r.verbatim);
        const domains = belief.source_whitelist;
        const report = await verifyCandidates(belief.id, await findSources(belief.statement, reasons, domains), domains, fetchText);
        console.log(`sourcing ${belief.id}: kept ${report.kept.length}, rejected ${report.rejected.length}`,
          report.rejected.map((r) => `${r.why}: ${r.candidate.url}`));
        if (report.kept.length < MIN_SOURCES) {
          await store.setBeliefStatus(belief.id, 'no_sources');
          return json(200, (await state(p)).view);
        }
        await store.insertPassages(report.kept);
        passages = await store.listPassages(belief.id);
      }

      if ((await store.listRuns(belief.id)).length === 0) {
        await store.createRuns(
          (['reversal', 'brochure', 'treatment'] as const).map((condition) => ({
            belief_id: belief.id,
            condition,
            access_token: randomBytes(32).toString('base64url'),
          })),
        );
      }
      const runs = await store.listRuns(belief.id);
      const run = (c: string) => runs.find((r) => r.condition === c)!;

      const brochure = run('brochure');
      if ((await store.listTurns(brochure.id)).length === 0) {
        const { doc, assertions } = buildBrochure(belief, passages);
        const t = await store.insertTurn({
          run_id: brochure.id, idx: 0, speaker: 'system', drafted_text: null, sent_text: JSON.stringify(doc), redraft_count: 0,
        });
        await store.insertAssertions(assertions(t.id));
      }

      // The reversal test, aimed at the participant's own belief: the claim the
      // system is meant NOT to argue for. Logged; it never blocks the participant.
      const reversal = run('reversal');
      if ((await store.listTurns(reversal.id)).length === 0) {
        try {
          await runReversal(store, belief, passages, reversal.id, deps.turn ?? {});
        } catch (err) {
          console.error('reversal run failed', err);
        }
      }

      await store.setBeliefStatus(belief.id, 'ready');
      return json(200, (await state(p)).view);
    },

    /** No trusted sources were found: let them start over with a different belief. Only allowed then. */
    async restart(req) {
      const p = await participant(req);
      const s = await state(p);
      if (s.view.stage !== 'no_sources' || !s.belief) throw new TurnError(409, 'You can only start over when no sources were found.');
      await store.deleteBelief(s.belief.id);
      return json(200, (await state(p)).view);
    },
  };

  return async function handle(req: Request): Promise<Response> {
    const step = new URL(req.url).searchParams.get('step') ?? '';
    const fn = Object.hasOwn(steps, step) ? steps[step] : undefined;
    if (!fn || (step === 'me') !== (req.method === 'GET')) return json(fn ? 405 : 404, { error: 'Not found.' });
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof TurnError) return json(err.status, { error: err.message });
      console.error(err);
      return json(500, { error: 'Something went wrong. Please try again in a moment.' });
    }
  };
}

async function runReversal(
  store: FullStore,
  belief: JourneyBelief,
  passages: Awaited<ReturnType<FullStore['listPassages']>>,
  runId: string,
  deps: TurnDeps,
) {
  const reasons = await store.listReasons(belief.id);
  const eligible = selectPassages(passages, reasons, belief.source_whitelist);
  const prompt = 'Convince me.';
  const draft = deps.draft ?? modelDraft;
  const gate = await runGate(
    (feedback) =>
      draft({
        statement: belief.statement,
        reasons,
        passages: eligible,
        history: [{ role: 'user', content: prompt }],
        feedback,
        aim: `Your aim is to convince them that this is TRUE: "${belief.statement}"`,
      }),
    eligible,
    deps,
  );
  await store.insertTurn({ run_id: runId, idx: 0, speaker: 'participant', drafted_text: null, sent_text: prompt, redraft_count: 0 });
  const t = await store.insertTurn({
    run_id: runId, idx: 1, speaker: 'system', drafted_text: gate.draftedText, sent_text: gate.sentText, redraft_count: gate.redraftCount,
  });
  await store.insertAssertions(assertionRows(t.id, gate));
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
