import Anthropic from '@anthropic-ai/sdk';
import type { Fragment, Passage, Verdict } from '../types.js';

const anthropic = new Anthropic();

/**
 * Decide whether a retrieved passage actually ENTAILS a claim.
 *
 * The distinction that matters: a passage can be ABOUT a claim's subject without
 * supporting the claim. A passage saying protein needs rise with age is near, in
 * any embedding space, to "older adults should eat more of everything" — and does
 * not support it. Similarity retrieves; entailment decides.
 *
 * The judge is deliberately strict. A claim that overstates its passage by a
 * degree ("associated with" -> "causes", "in one cohort" -> "in general")
 * is NOT supported, because that drift is exactly how a sourced-looking
 * conversation ends up asserting things no source says.
 */
const SYSTEM = `You decide whether a quoted passage entails a claim. You are not evaluating whether the claim is true in general — only whether THIS passage establishes it.

Answer "supported" only if a careful reader of the passage alone would agree the claim follows from it.

Answer "unsupported" if any of these hold:
- The passage is about the topic but does not establish this specific claim.
- The claim is stronger than the passage: correlation stated as causation, a finding in one population stated as universal, "may" stated as "does", a range stated as a point value.
- The claim adds a number, comparison, or qualifier the passage does not contain.
- The claim is directionally right but the passage does not actually say it.

Return JSON only: {"supported": true|false, "reason": "one short sentence"}
When supported is true, reason may be an empty string.`;

export async function verifyFragment(fragment: Fragment, passages: Passage[]): Promise<Verdict> {
  // Only assertions need support. Questions, reflections and connectives assert
  // nothing, so there is nothing to check.
  if (fragment.kind !== 'assertion') {
    return { fragment, supported: true, passageId: null, reason: null };
  }

  if (passages.length === 0) {
    return {
      fragment,
      supported: false,
      passageId: null,
      reason: 'No passages retrieved for this belief.',
    };
  }

  // Check against each passage until one entails it. A claim needs one good
  // source, not all of them.
  for (const passage of passages) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `PASSAGE (from ${passage.source_name}):\n"""${passage.quote}"""\n\nCLAIM:\n"""${fragment.text}"""`,
        },
      ],
    });

    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') continue;

    const parsed = parseJson(block.text);
    if (parsed.supported === true) {
      return { fragment, supported: true, passageId: passage.id, reason: null };
    }
  }

  return {
    fragment,
    supported: false,
    passageId: null,
    reason: 'No retrieved passage entails this claim.',
  };
}

export async function verifyAll(fragments: Fragment[], passages: Passage[]): Promise<Verdict[]> {
  return Promise.all(fragments.map((f) => verifyFragment(f, passages)));
}

function parseJson(raw: string): { supported?: boolean; reason?: string } {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced?.[1] ?? raw;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1) return { supported: false, reason: 'unparseable judge output' };
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    // A judge whose output cannot be read has not established support.
    return { supported: false, reason: 'unparseable judge output' };
  }
}
