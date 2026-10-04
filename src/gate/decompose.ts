import Anthropic from '@anthropic-ai/sdk';
import type { Fragment, ClaimKind } from '../types.js';

const anthropic = new Anthropic();

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
const SYSTEM = `You split text into atomic fragments and label each one. You do not evaluate, argue, or improve the text.

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
- Do not drop any content. Every word of the input belongs to some fragment.

Return JSON only: {"fragments":[{"text":"...","kind":"assertion"}]}`;

const VALID_KINDS: ClaimKind[] = ['assertion', 'question', 'reflection', 'connective'];

export async function decompose(draftedTurn: string): Promise<Fragment[]> {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: draftedTurn }],
  });

  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('decompose: no text in response');

  const parsed = parseJson(block.text);
  return parsed.fragments
    .filter((f) => f.text?.trim())
    .map((f) => ({
      text: f.text.trim(),
      // Anything we don't recognise is treated as an assertion, so an unexpected
      // label can never be a way to skip verification.
      kind: VALID_KINDS.includes(f.kind as ClaimKind) ? (f.kind as ClaimKind) : 'assertion',
    }));
}

function parseJson(raw: string): { fragments: { text: string; kind: string }[] } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`decompose: no JSON object found in: ${raw.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
}
