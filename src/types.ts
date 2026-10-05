/**
 * Shared types. Nothing here names a belief, a domain, or a topic:
 * the belief is data, loaded at runtime.
 */

export type ClaimKind = 'assertion' | 'question' | 'reflection' | 'connective';

/** A verbatim quote from a whitelisted source. The only thing a claim may rest on. */
export interface Passage {
  id: string;
  source_name: string;
  source_url: string;
  source_domain: string;
  quote: string;
  human_verified: boolean;
  applies_to: string | null;
  /**
   * How it was verified. 'human': a person checked it against the source.
   * 'exact_match': the server downloaded the source and found the quote in it,
   * word for word. Absent means 'human'.
   */
  verification?: 'human' | 'exact_match';
}

/** One atomic claim pulled out of a drafted turn. */
export interface Fragment {
  text: string;
  kind: ClaimKind;
}

/** The verdict on one fragment after checking it against the retrieved passages. */
export interface Verdict {
  fragment: Fragment;
  supported: boolean;
  passageId: string | null;
  /** Why it failed, when it did. Written into the refusal log. */
  reason: string | null;
}

export interface GateResult {
  /** The text that may be shown to the participant. Null when the gate gave up. */
  sentText: string | null;
  draftedText: string;
  verdicts: Verdict[];
  redraftCount: number;
  /** True when the gate ran out of redrafts and refused to send anything. */
  refused: boolean;
  /**
   * Every draft the gate saw, in order, with its verdicts. The claims blocked in
   * earlier drafts are the evidence that the gate did something, so they are
   * kept rather than discarded with the draft.
   */
  attempts: { draft: string; verdicts: Verdict[] }[];
}

/** Everything the system knows about the person and their belief. All of it data. */
export interface BeliefContext {
  beliefId: string;
  statement: string;
  domain: string;
  sourceWhitelist: string[];
  /** Their stated reason, verbatim. This is what retrieval is keyed on. */
  primaryReason: { code: string; verbatim: string };
}
