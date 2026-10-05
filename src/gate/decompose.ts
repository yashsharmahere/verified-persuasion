import Anthropic from '@anthropic-ai/sdk';
import type { Fragment, ClaimKind } from '../types.js';

/**
 * Split a drafted turn into atomic fragments and label each one.
 *
 * This runs as its OWN model call with no knowledge of the persuasion goal.
 * A decomposer that knows what the system is trying to achieve has an incentive
 * to label an awkward assertion as "reflection" so it skips verification.
 *
 * Granularity follows VeriScore rather than FActScore: the target is
 * verifiability, not maximum atomicity. Chopping too finely produces fragments
 * that have lost the context needed to check them ("it rises with age" —
 * what does?), which is a documented failure mode of decompose-then-verify.
 */
export const DECOMPOSE_SYSTEM_PROMPT = `You split text into atomic fragments and label each one. You do not evaluate, argue, or improve the text.

Split the input so that each fragment carries exactly one checkable idea, and enough context to be checked standing alone. Resolve pronouns and references as you split: "it rises with age" becomes "protein requirement rises with age".

Label each fragment:
- assertion: states something about the world that could be true or false. Includes numbers, comparisons, causal claims, and statements about what research or an organisation says.
- question: asks the reader something.
- reflection: restates or summarises what the reader themselves said, with nothing added.
- connective: transitions, acknowledgements, framing that asserts nothing ("That's a fair point", "Here's one way to look at it").

Rules:
- A sentence may contain several fragments. Split it.
- When a fragment both restates the reader AND adds a new factual element, label it assertion.
- Hedged claims ("studies suggest X") are still assertions.
- Saying the speaker has no source on something, cannot back something up, or will not make a claim, or saying that something is a question for the reader's doctor, asserts nothing about the world: label it connective. Any statement of what a source or the evidence DOES say is an assertion.
- Do not drop any content. Every word of the input belongs to some fragment.

Return JSON only: {"fragments":[{"text":"...","kind":"assertion"}]}`;

const VALID_KINDS: ClaimKind[] = ['assertion', 'question', 'reflection', 'connective'];

/** Injectable so the gate's control flow can be tested without a model. */
export type Decomposer = (draftedTurn: string) => Promise<Fragment[]>;

export const modelDecompose: Decomposer = async (draftedTurn) => {
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: DECOMPOSE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: draftedTurn }],
  });

  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('decompose: no text in response');

  return parseFragments(block.text);
};

export const decompose: Decomposer = modelDecompose;

/** Exported for testing. */
export function parseFragments(raw: string): Fragment[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`decompose: no JSON object found in: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(body.slice(start, end + 1)) as {
    fragments?: { text?: string; kind?: string }[];
  };

  if (!Array.isArray(parsed.fragments)) {
    throw new Error('decompose: response has no fragments array');
  }

  return parsed.fragments
    .filter((f): f is { text: string; kind?: string } => typeof f.text === 'string' && f.text.trim() !== '')
    .map((f) => ({
      text: f.text.trim(),
      // Anything we don't recognise is treated as an assertion, so an unexpected
      // or malicious label can never be a way to skip verification.
      kind: VALID_KINDS.includes(f.kind as ClaimKind) ? (f.kind as ClaimKind) : 'assertion',
    }));
}
