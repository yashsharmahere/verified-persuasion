import Anthropic from '@anthropic-ai/sdk';

/**
 * Turn what a person typed into one statement they can rate from 0 to 100,
 * and decide whether it is in scope.
 *
 * The brief draws the line: a belief that costs money, time or health, that a
 * reviewer can check in under a minute; political and identity issues are
 * out. Added here: nothing that would have the system argue about a person's
 * own diagnosis or treatment, which belongs with their doctor.
 */

export interface ShapedBelief {
  in_scope: boolean;
  /** One plain sentence, in the person's own terms, that can be rated 0 to 100. */
  statement: string;
  /** A short topic label, e.g. "nutrition", "personal finance". */
  domain: string;
  /** When out of scope: why, in one friendly sentence addressed to the person. */
  reason: string;
}

export type BeliefShaper = (text: string) => Promise<ShapedBelief>;

export const SHAPE_PROMPT = `A person has typed a belief they hold. You prepare it for a study; you do not argue with it.

Decide if it is in scope. In scope: an everyday factual belief about health, food, money, safety, or similar, that costs the person money, time or health, and that published evidence can speak to. Out of scope: political, religious or identity questions; opinions and matters of taste; claims about a specific named person; questions about the person's own diagnosis, medicines or treatment; anything you cannot restate as a single checkable claim.

If in scope, restate it as ONE plain sentence in the person's own terms that they could rate from 0 (definitely false) to 100 (definitely true). Keep their meaning, including how strong it is; do not soften it, correct it or make it more reasonable. No "I believe".

Return JSON only: {"in_scope": true|false, "statement": "...", "domain": "one or two words", "reason": "if out of scope, one friendly sentence to the person saying why; else empty"}`;

export const SHAPE_MODEL = 'claude-sonnet-5-5';

export const modelShapeBelief: BeliefShaper = async (text) => {
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: SHAPE_MODEL,
    max_tokens: 2000,
    system: SHAPE_PROMPT,
    messages: [{ role: 'user', content: text.slice(0, 1000) }],
  });
  const raw = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseShaped(raw);
};

/** Anything unparseable is out of scope: the system never guesses what someone believes. */
export function parseShaped(raw: string): ShapedBelief {
  const fallback: ShapedBelief = {
    in_scope: false,
    statement: '',
    domain: '',
    reason: "Sorry, I couldn't turn that into a single statement. Could you write it as one sentence?",
  };
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return fallback;
  try {
    const p = JSON.parse(raw.slice(start, end + 1)) as Partial<ShapedBelief>;
    const statement = typeof p.statement === 'string' ? p.statement.trim() : '';
    if (p.in_scope !== true) {
      return { ...fallback, reason: typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim() : fallback.reason };
    }
    if (statement.length < 10 || statement.length > 300) return fallback;
    return {
      in_scope: true,
      statement,
      domain: typeof p.domain === 'string' && p.domain.trim() ? p.domain.trim().slice(0, 40) : 'general',
      reason: '',
    };
  } catch {
    return fallback;
  }
}
