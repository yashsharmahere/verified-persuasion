import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Passage } from './types.js';

/**
 * Everything the app reads and writes, behind one interface so the conversation
 * loop and the HTTP handlers can be tested against an in-memory store without a
 * database. Supabase is the real implementation.
 */

export type Condition = 'reversal' | 'brochure' | 'treatment';
export type Timepoint = 'baseline' | 'post_brochure' | 'post_treatment' | 'delayed';

export interface InstrumentItem {
  /** 'target' for the belief statement; any other label is a control. */
  item: string;
  text: string;
}

export interface Belief {
  id: string;
  statement: string;
  domain: string;
  source_whitelist: string[];
  instrument: InstrumentItem[];
}

export interface Reason {
  code: string;
  verbatim: string;
  is_primary: boolean;
}

export interface Run {
  id: string;
  belief_id: string;
  condition: Condition;
  ended_at: string | null;
}

export interface Turn {
  id: string;
  run_id: string;
  idx: number;
  speaker: 'system' | 'participant';
  drafted_text: string | null;
  sent_text: string | null;
  redraft_count: number;
}

export interface AssertionRow {
  turn_id: string;
  claim_text: string;
  kind: string;
  supported: boolean;
  passage_id: string | null;
  blocked: boolean;
  block_reason: string | null;
  attempt: number;
  sent: boolean;
}

export interface MeasureRow {
  belief_id: string;
  timepoint: Timepoint;
  item: string;
  score: number;
  open_response: string | null;
  collected_by: string | null;
}

export interface Store {
  getRunByToken(token: string): Promise<Run | null>;
  getBelief(beliefId: string): Promise<Belief | null>;
  listReasons(beliefId: string): Promise<Reason[]>;
  listPassages(beliefId: string): Promise<Passage[]>;
  listTurns(runId: string): Promise<Turn[]>;
  insertTurn(turn: Omit<Turn, 'id'>): Promise<Turn>;
  insertAssertions(rows: AssertionRow[]): Promise<void>;
  listMeasures(beliefId: string, timepoint: Timepoint): Promise<MeasureRow[]>;
  insertMeasures(rows: MeasureRow[]): Promise<void>;
  endRun(runId: string): Promise<void>;
}

export type BeliefStatus = 'draft' | 'sourcing' | 'ready' | 'no_sources';

export interface Participant {
  id: string;
  consented_at: string | null;
}

export interface JourneyBelief extends Belief {
  status: BeliefStatus;
}

export interface RunLink {
  id: string;
  condition: Condition;
  access_token: string;
  ended_at: string | null;
}

export type NewPassage = Omit<Passage, 'id'> & { belief_id: string };

/**
 * What the self-serve journey needs on top of the conversation's Store: a
 * participant found by their login, their belief and its preparation status,
 * and the runs whose tokens the existing pages already use.
 */
export interface JourneyStore {
  getParticipantByUser(userId: string): Promise<Participant | null>;
  createParticipant(p: {
    user_id: string;
    email: string;
    label: string;
    consented_at: string;
    disclosed_ai: boolean;
  }): Promise<Participant>;
  getBeliefByParticipant(participantId: string): Promise<JourneyBelief | null>;
  /** How many participants and beliefs were created since a time: the daily cap on an open site. */
  countCreatedSince(since: string): Promise<{ participants: number; beliefs: number }>;
  createBelief(b: {
    participant_id: string;
    statement: string;
    raw_text: string;
    domain: string;
    source_whitelist: string[];
    instrument: InstrumentItem[];
  }): Promise<JourneyBelief>;
  setBeliefStatus(beliefId: string, status: BeliefStatus): Promise<void>;
  /** Remove a belief and, by cascade, its reasons, measures, passages and runs. */
  deleteBelief(beliefId: string): Promise<void>;
  insertReasons(rows: (Reason & { belief_id: string })[]): Promise<void>;
  insertPassages(rows: NewPassage[]): Promise<void>;
  listRuns(beliefId: string): Promise<RunLink[]>;
  createRuns(rows: { belief_id: string; condition: Condition; access_token: string }[]): Promise<void>;
  /** When each timepoint was first recorded, for the stage and the day-7 date. */
  measureTimes(beliefId: string): Promise<Partial<Record<Timepoint, string>>>;
}

export type FullStore = Store & JourneyStore;

/** Service-role client. Server-side only: this key must never reach a browser. */
export function supabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export function supabaseStore(db: SupabaseClient = supabaseFromEnv()): FullStore {
  const beliefCols = 'id, statement, domain, source_whitelist, instrument, status';
  return {
    async getParticipantByUser(userId) {
      const res = await db.from('participants').select('id, consented_at').eq('user_id', userId).maybeSingle();
      return check(res, 'getParticipantByUser') as Participant | null;
    },

    async countCreatedSince(since) {
      const count = async (table: string) => {
        const res = await db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', since);
        if (res.error) throw new Error(`countCreatedSince: ${res.error.message}`);
        return res.count ?? 0;
      };
      const [participants, beliefs] = await Promise.all([count('participants'), count('beliefs')]);
      return { participants, beliefs };
    },

    async createParticipant(p) {
      const res = await db.from('participants').insert(p).select('id, consented_at').single();
      return check(res, 'createParticipant') as Participant;
    },

    async getBeliefByParticipant(participantId) {
      const res = await db
        .from('beliefs')
        .select(beliefCols)
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return check(res, 'getBeliefByParticipant') as JourneyBelief | null;
    },

    async createBelief(b) {
      const res = await db.from('beliefs').insert({ ...b, status: 'draft' }).select(beliefCols).single();
      return check(res, 'createBelief') as JourneyBelief;
    },

    async setBeliefStatus(beliefId, status) {
      check(await db.from('beliefs').update({ status }).eq('id', beliefId), 'setBeliefStatus');
    },

    async deleteBelief(beliefId) {
      check(await db.from('beliefs').delete().eq('id', beliefId), 'deleteBelief');
    },

    async insertReasons(rows) {
      if (rows.length) check(await db.from('reasons').insert(rows), 'insertReasons');
    },

    async insertPassages(rows) {
      if (rows.length) check(await db.from('passages').insert(rows), 'insertPassages');
    },

    async listRuns(beliefId) {
      const res = await db.from('runs').select('id, condition, access_token, ended_at').eq('belief_id', beliefId);
      return check(res, 'listRuns') as RunLink[];
    },

    async createRuns(rows) {
      check(await db.from('runs').insert(rows), 'createRuns');
    },

    async measureTimes(beliefId) {
      const res = await db
        .from('measures')
        .select('timepoint, collected_at')
        .eq('belief_id', beliefId)
        .order('collected_at');
      const out: Partial<Record<Timepoint, string>> = {};
      for (const m of check(res, 'measureTimes') as { timepoint: Timepoint; collected_at: string }[]) {
        out[m.timepoint] ??= m.collected_at;
      }
      return out;
    },

    async getRunByToken(token) {
      const res = await db
        .from('runs')
        .select('id, belief_id, condition, ended_at')
        .eq('access_token', token)
        .maybeSingle();
      return check(res, 'getRunByToken') as Run | null;
    },

    async getBelief(beliefId) {
      const res = await db
        .from('beliefs')
        .select('id, statement, domain, source_whitelist, instrument')
        .eq('id', beliefId)
        .maybeSingle();
      return check(res, 'getBelief') as Belief | null;
    },

    async listReasons(beliefId) {
      const res = await db
        .from('reasons')
        .select('code, verbatim, is_primary')
        .eq('belief_id', beliefId)
        .order('created_at');
      return check(res, 'listReasons') as Reason[];
    },

    async listPassages(beliefId) {
      const res = await db
        .from('passages')
        .select('id, source_name, source_url, source_domain, quote, human_verified, applies_to, verification')
        .eq('belief_id', beliefId)
        .order('retrieved_at');
      return check(res, 'listPassages') as Passage[];
    },

    async listTurns(runId) {
      const res = await db
        .from('turns')
        .select('id, run_id, idx, speaker, drafted_text, sent_text, redraft_count')
        .eq('run_id', runId)
        .order('idx');
      return check(res, 'listTurns') as Turn[];
    },

    async insertTurn(turn) {
      const res = await db.from('turns').insert(turn).select().single();
      return check(res, 'insertTurn') as Turn;
    },

    async insertAssertions(rows) {
      if (rows.length === 0) return;
      check(await db.from('assertions').insert(rows), 'insertAssertions');
    },

    async listMeasures(beliefId, timepoint) {
      const res = await db
        .from('measures')
        .select('belief_id, timepoint, item, score, open_response, collected_by')
        .eq('belief_id', beliefId)
        .eq('timepoint', timepoint);
      return check(res, 'listMeasures') as MeasureRow[];
    },

    async insertMeasures(rows) {
      check(await db.from('measures').insert(rows), 'insertMeasures');
    },

    async endRun(runId) {
      check(
        await db.from('runs').update({ ended_at: new Date().toISOString() }).eq('id', runId),
        'endRun',
      );
    },
  };
}

/** In-memory store for tests and for running the app locally without a database. */
export function memoryStore(seed: {
  beliefs?: Belief[];
  reasons?: (Reason & { belief_id: string })[];
  passages?: (Passage & { belief_id: string })[];
  runs?: (Run & { access_token: string })[];
} = {}) {
  const beliefs: (Belief & { status?: BeliefStatus; participant_id?: string })[] = [...(seed.beliefs ?? [])];
  const participants: (Participant & { user_id: string; email: string })[] = [];
  const measureAt: { belief_id: string; timepoint: Timepoint; at: string }[] = [];
  const reasons = [...(seed.reasons ?? [])];
  const passages = [...(seed.passages ?? [])];
  const runs = [...(seed.runs ?? [])];
  const turns: Turn[] = [];
  const assertions: AssertionRow[] = [];
  const measures: MeasureRow[] = [];
  let n = 0;

  const store: FullStore = {
    async getParticipantByUser(userId) {
      const p = participants.find((x) => x.user_id === userId);
      return p ? { id: p.id, consented_at: p.consented_at } : null;
    },
    // The memory store keeps no clock of its own, so it counts everything.
    async countCreatedSince() {
      return { participants: participants.length, beliefs: beliefs.filter((b) => b.participant_id).length };
    },
    async createParticipant(p) {
      const row = { id: `participant-${++n}`, consented_at: p.consented_at, user_id: p.user_id, email: p.email };
      participants.push(row);
      return { id: row.id, consented_at: row.consented_at };
    },
    async getBeliefByParticipant(participantId) {
      const b = [...beliefs].reverse().find((x) => x.participant_id === participantId);
      return b ? { ...b, status: b.status ?? 'ready' } : null;
    },
    async createBelief(b) {
      const row = { id: `belief-${++n}`, ...b, status: 'draft' as BeliefStatus };
      beliefs.push(row);
      return row;
    },
    async setBeliefStatus(beliefId, status) {
      const b = beliefs.find((x) => x.id === beliefId);
      if (b) b.status = status;
    },
    async deleteBelief(beliefId) {
      const drop = <T extends { belief_id: string }>(xs: T[]) => {
        for (let i = xs.length - 1; i >= 0; i--) if (xs[i]!.belief_id === beliefId) xs.splice(i, 1);
      };
      const i = beliefs.findIndex((x) => x.id === beliefId);
      if (i >= 0) beliefs.splice(i, 1);
      drop(reasons); drop(passages); drop(runs); drop(measures); drop(measureAt);
    },
    async insertReasons(rows) {
      reasons.push(...rows);
    },
    async insertPassages(rows) {
      passages.push(...rows.map((r) => ({ ...r, id: `passage-${++n}` })));
    },
    async listRuns(beliefId) {
      return runs.filter((r) => r.belief_id === beliefId).map((r) => ({ ...r }));
    },
    async createRuns(rows) {
      runs.push(...rows.map((r) => ({ ...r, id: `run-${++n}`, ended_at: null })));
    },
    async measureTimes(beliefId) {
      const out: Partial<Record<Timepoint, string>> = {};
      for (const m of measureAt) if (m.belief_id === beliefId) out[m.timepoint] ??= m.at;
      return out;
    },
    async getRunByToken(token) {
      const r = runs.find((x) => x.access_token === token);
      return r ? { id: r.id, belief_id: r.belief_id, condition: r.condition, ended_at: r.ended_at } : null;
    },
    async getBelief(id) {
      return beliefs.find((b) => b.id === id) ?? null;
    },
    async listReasons(id) {
      return reasons.filter((r) => r.belief_id === id);
    },
    async listPassages(id) {
      return passages.filter((p) => p.belief_id === id);
    },
    async listTurns(runId) {
      return turns.filter((t) => t.run_id === runId).sort((a, b) => a.idx - b.idx);
    },
    async insertTurn(t) {
      const row = { ...t, id: `turn-${++n}` };
      turns.push(row);
      return row;
    },
    async insertAssertions(rows) {
      assertions.push(...rows);
    },
    async listMeasures(beliefId, timepoint) {
      return measures.filter((m) => m.belief_id === beliefId && m.timepoint === timepoint);
    },
    async insertMeasures(rows) {
      measures.push(...rows);
      const at = new Date().toISOString();
      for (const r of rows) measureAt.push({ belief_id: r.belief_id, timepoint: r.timepoint, at });
    },
    async endRun(runId) {
      const r = runs.find((x) => x.id === runId);
      if (r) r.ended_at = new Date().toISOString();
    },
  };

  /** Tests use this to move a recorded timepoint into the past. */
  const backdate = (timepoint: Timepoint, days: number) => {
    for (const m of measureAt) if (m.timepoint === timepoint) m.at = new Date(Date.parse(m.at) - days * 864e5).toISOString();
  };

  return { store, turns, assertions, measures, runs, participants, beliefs, passages, reasons, backdate };
}
