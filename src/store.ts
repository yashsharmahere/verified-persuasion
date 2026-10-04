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

export function supabaseStore(db: SupabaseClient = supabaseFromEnv()): Store {
  return {
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
        .select('id, source_name, source_url, source_domain, quote, human_verified, applies_to')
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
  const beliefs = [...(seed.beliefs ?? [])];
  const reasons = [...(seed.reasons ?? [])];
  const passages = [...(seed.passages ?? [])];
  const runs = [...(seed.runs ?? [])];
  const turns: Turn[] = [];
  const assertions: AssertionRow[] = [];
  const measures: MeasureRow[] = [];
  let n = 0;

  const store: Store = {
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
    },
    async endRun(runId) {
      const r = runs.find((x) => x.id === runId);
      if (r) r.ended_at = new Date().toISOString();
    },
  };

  return { store, turns, assertions, measures, runs };
}
