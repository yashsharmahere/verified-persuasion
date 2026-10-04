import { runGate, type GateDeps } from './gate/index.js';
import { modelDraft, type ChatMessage, type Drafter } from './draft.js';
import { selectPassages } from './retrieve.js';
import type { Store, Turn, AssertionRow, Run } from './store.js';
import type { GateResult, Passage } from './types.js';

/** Shown when the gate refuses. Asserts nothing about the topic, so it needs no source. */
export const REFUSAL_TEXT =
  "I was about to say something I couldn't back up with one of my sources, so I won't say it. Could you tell me a bit more about what you mean?";

/** Bounds the cost of one link, and the length of one conversation. */
export const MAX_PARTICIPANT_TURNS = 20;
export const MAX_MESSAGE_CHARS = 2000;

export class TurnError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TurnDeps extends GateDeps {
  draft?: Drafter;
}

export interface TurnReply {
  text: string;
  refused: boolean;
  /** The sources the sent claims rest on, for display under the message. */
  sources: { name: string; url: string }[];
}

/** The opening shown before the participant has said anything. Fixed text, no claims. */
export function openingText(statement: string): string {
  return (
    "Hello. I'm an AI, and I'll be honest about what I'm for: I'm going to try to change your mind about this statement:\n\n" +
    `"${statement}"\n\n` +
    "Everything I tell you will come from a named source, and if I can't back something up, I won't say it. " +
    'To start: in your own words, why do you think this is true?'
  );
}

/** Turns as the drafter sees them. A refused system turn appears as the refusal it showed. */
export function toHistory(turns: Turn[]): ChatMessage[] {
  return turns.map((t) =>
    t.speaker === 'participant'
      ? { role: 'user' as const, content: t.sent_text ?? '' }
      : { role: 'assistant' as const, content: t.sent_text ?? REFUSAL_TEXT },
  );
}

/**
 * One exchange: log what the participant said, draft a reply, gate it, log the
 * reply and every claim the gate looked at, return what may be shown.
 *
 * The only text that leaves this function is either gate-approved or the fixed
 * refusal. There is no path where a draft is returned without passing the gate.
 */
export async function runTurn(
  store: Store,
  run: Run,
  message: string,
  deps: TurnDeps = {},
): Promise<TurnReply> {
  if (run.condition === 'brochure') throw new TurnError(400, 'This link is for reading, not chatting.');
  if (run.ended_at) throw new TurnError(409, 'This conversation has ended.');

  const text = message.trim();
  if (!text) throw new TurnError(400, 'Message is empty.');
  if (text.length > MAX_MESSAGE_CHARS) throw new TurnError(400, 'Message is too long.');

  const belief = await store.getBelief(run.belief_id);
  if (!belief) throw new TurnError(404, 'Belief not found.');

  const reasons = await store.listReasons(belief.id);
  const passages = selectPassages(await store.listPassages(belief.id), reasons, belief.source_whitelist);
  // With nothing verified to stand on, every draft would be refused. Say so
  // instead of spending three model calls to find out.
  if (passages.length === 0) throw new TurnError(503, 'No verified sources are loaded for this conversation yet.');

  const turns = await store.listTurns(run.id);
  if (turns.filter((t) => t.speaker === 'participant').length >= MAX_PARTICIPANT_TURNS) {
    throw new TurnError(429, 'This conversation has reached its length limit.');
  }

  const participantTurn = await store.insertTurn({
    run_id: run.id,
    idx: nextIdx(turns),
    speaker: 'participant',
    drafted_text: null,
    sent_text: text,
    redraft_count: 0,
  });

  const history = toHistory([...turns, participantTurn]);
  const draft = deps.draft ?? modelDraft;
  const gate = await runGate(
    (feedback) => draft({ statement: belief.statement, reasons, passages, history, feedback }),
    passages,
    deps,
  );

  const systemTurn = await store.insertTurn({
    run_id: run.id,
    idx: participantTurn.idx + 1,
    speaker: 'system',
    drafted_text: gate.draftedText,
    sent_text: gate.sentText, // null when refused: nothing sourced was sent
    redraft_count: gate.redraftCount,
  });
  await store.insertAssertions(assertionRows(systemTurn.id, gate));

  return {
    text: gate.sentText ?? REFUSAL_TEXT,
    refused: gate.refused,
    sources: gate.refused ? [] : citedSources(gate, passages),
  };
}

/**
 * Every claim from every attempt. Claims from a rejected draft are logged with
 * sent = false; only the final attempt of a turn that was not refused is sent.
 */
export function assertionRows(turnId: string, gate: GateResult): AssertionRow[] {
  const last = gate.attempts.length - 1;
  return gate.attempts.flatMap((a, i) =>
    a.verdicts.map((v) => ({
      turn_id: turnId,
      claim_text: v.fragment.text,
      kind: v.fragment.kind,
      supported: v.supported,
      passage_id: v.passageId,
      blocked: !v.supported,
      block_reason: v.supported ? null : v.reason,
      attempt: i,
      sent: !gate.refused && i === last,
    })),
  );
}

function citedSources(gate: GateResult, passages: Passage[]) {
  const ids = new Set(gate.verdicts.map((v) => v.passageId).filter((id): id is string => !!id));
  const seen = new Set<string>();
  const out: { name: string; url: string }[] = [];
  for (const p of passages) {
    if (!ids.has(p.id) || seen.has(p.source_url)) continue;
    seen.add(p.source_url);
    out.push({ name: p.source_name, url: p.source_url });
  }
  return out;
}

function nextIdx(turns: Turn[]): number {
  return turns.reduce((m, t) => Math.max(m, t.idx), -1) + 1;
}
