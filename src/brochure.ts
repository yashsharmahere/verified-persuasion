import { eligiblePassages, MAX_PASSAGES } from './retrieve.js';
import type { AssertionRow, Belief } from './store.js';
import type { Passage } from './types.js';

/**
 * The brochure: the comparison the system has to beat.
 *
 * Same sources and same claims as the conversation, with none of what the
 * conversation adds: no reason-matching, no back-and-forth, no choosing which
 * fact to say next. It is the verified quotes themselves, each with its source,
 * so it needs no model call and has nothing for the gate to catch.
 *
 * Built once and stored, so the participant reads exactly what was logged.
 */

export interface BrochureDoc {
  title: string;
  intro: string;
  items: { quote: string; source_name: string; source_url: string }[];
}

export function buildBrochure(belief: Pick<Belief, 'statement' | 'source_whitelist'>, passages: Passage[]) {
  const chosen = eligiblePassages(passages, belief.source_whitelist).slice(0, MAX_PASSAGES);
  if (chosen.length === 0) throw new Error('No verified, whitelisted passages to build a brochure from.');

  const doc: BrochureDoc = {
    title: 'What the sources say',
    intro:
      `This page collects what published sources say on one question:\n"${belief.statement}"\n\n` +
      'Each passage below is quoted word for word and names where it comes from.',
    items: chosen.map((p) => ({ quote: p.quote, source_name: p.source_name, source_url: p.source_url })),
  };

  /** Each quote is one claim, supported by its own passage by construction. */
  const assertions = (turnId: string): AssertionRow[] =>
    chosen.map((p) => ({
      turn_id: turnId,
      claim_text: p.quote,
      kind: 'assertion',
      supported: true,
      passage_id: p.id,
      blocked: false,
      block_reason: null,
      attempt: 0,
      sent: true,
    }));

  return { doc, assertions };
}
