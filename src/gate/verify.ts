import Anthropic from '@anthropic-ai/sdk';
import type { Fragment, Passage, Verdict } from '../types.js';

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
export const JUDGE_SYSTEM_PROMPT = `You decide whether a claim is entailed by one of several numbered passages. You are not evaluating whether the claim is true in general — only whether ONE of THESE passages establishes it.

Each passage is introduced by the document and section it comes from. Treat that line as context for who and what the passage is about (for example, a section on the elderly is about older people). Do not treat it as extra evidence.

Answer supported only if a careful reader of a single passage, with its source line, would agree the claim follows from it. A claim that needs two passages combined is not supported.

The claim is NOT supported if, for every passage, any of these hold:
- The passage is about the topic but does not establish this specific claim.
- The claim is stronger than the passage: correlation stated as causation, a finding in one population stated as universal, "may" stated as "does", a range stated as a point value.
- The claim adds a number, comparison, or qualifier the passage does not contain.
- The claim is directionally right but the passage does not actually say it.

Return JSON only: {"supported": true|false, "passage": <the number of the passage that entails it, or null>, "reason": "one short sentence"}
When supported is true, passage must be a number and reason may be an empty string.`;

/**
 * One entailment decision per claim, against every retrieved passage at once.
 * Returns which passage entails it. Injectable so the gate's control flow can
 * be tested deterministically, and so the judge can be swapped without
 * touching the gate.
 */
export type Judge = (
  claim: string,
  passages: Passage[],
) => Promise<{ supported: boolean; passageId?: string | null; reason?: string }>;

/**
 * The real judge: ONE model call per claim, with every passage numbered in it.
 * Checking a claim against each passage in turn cost up to one call per
 * passage, one after another; this is the "check a hundred cheaply" answer.
 */
/** Must pass `npm run gate:judge`. Haiku 4.5 was tried (2026-10-05) and let a dropped qualifier through. */
export const JUDGE_MODEL = 'claude-sonnet-4-5';

export const modelJudge: Judge = async (claim, passages) => {
  const anthropic = new Anthropic();
  const listed = passages
    .map((p, i) => `PASSAGE ${i + 1} (from ${p.source_name}):\n"""${p.quote}"""`)
    .join('\n\n');
  const res = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 300,
    // A gate should give the same verdict on the same input every time.
    temperature: 0,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${listed}\n\nCLAIM:\n"""${claim}"""` }],
  });

  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    return { supported: false, reason: 'judge returned no text' };
  }
  const parsed = parseJudgeOutput(block.text);
  if (!parsed.supported) return { supported: false, reason: parsed.reason };
  // Support must name a passage we actually sent. Anything else fails closed.
  const passage = parsed.passage === undefined ? undefined : passages[parsed.passage - 1];
  if (!passage) return { supported: false, reason: 'judge claimed support without naming a valid passage' };
  return { supported: true, passageId: passage.id };
};

export async function verifyFragment(
  fragment: Fragment,
  passages: Passage[],
  judge: Judge = modelJudge,
): Promise<Verdict> {
  // Only assertions need support. Questions, reflections and connectives assert
  // nothing, so there is nothing to check — and sending them to the judge would
  // burn a call per fragment to answer a question nobody asked.
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

  let result: Awaited<ReturnType<Judge>>;
  try {
    result = await judge(fragment.text, passages);
  } catch (err) {
    // A judge that throws has not established support. Fail closed: the whole
    // point of the gate is that an error cannot become a pass.
    return {
      fragment,
      supported: false,
      passageId: null,
      reason: `Judge failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Support counts only when it names one of the passages that were checked.
  const passageId = result.supported ? result.passageId : null;
  if (passageId && passages.some((p) => p.id === passageId)) {
    return { fragment, supported: true, passageId, reason: null };
  }

  return {
    fragment,
    supported: false,
    passageId: null,
    reason: result.supported
      ? 'Judge claimed support without naming a checked passage.'
      : (result.reason ?? 'No retrieved passage entails this claim.'),
  };
}

export async function verifyAll(
  fragments: Fragment[],
  passages: Passage[],
  judge: Judge = modelJudge,
): Promise<Verdict[]> {
  return Promise.all(fragments.map((f) => verifyFragment(f, passages, judge)));
}

/** Exported for testing: unparseable judge output must never read as support. */
export function parseJudgeOutput(raw: string): { supported: boolean; passage?: number; reason?: string } {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced?.[1] ?? raw;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1) return { supported: false, reason: 'unparseable judge output' };
    const parsed = JSON.parse(body.slice(start, end + 1));
    // Strict: only a literal true counts. "true", 1, and undefined do not.
    return {
      supported: parsed.supported === true,
      // A passage number must be a positive whole number; anything else is no number.
      passage: Number.isInteger(parsed.passage) && parsed.passage > 0 ? parsed.passage : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch {
    return { supported: false, reason: 'unparseable judge output' };
  }
}
