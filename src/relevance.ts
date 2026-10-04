import Anthropic from '@anthropic-ai/sdk';
import { parseJudgeOutput } from './gate/verify.js';

/**
 * RCR's per-claim judgment: does this claim bear on the reason the person
 * actually gave? Run after the conversation, not during it, so it adds no
 * latency and cannot influence what was sent.
 *
 * Same model and temperature as the entailment judge, and the same strict
 * parser: anything but a literal true is "not relevant".
 */
export const RELEVANCE_SYSTEM_PROMPT = `You decide whether a claim made in a conversation bears directly on a person's stated reason for holding a belief.

"Relevant" means the claim speaks to that reason: it supports, challenges, qualifies or gives evidence about the specific thing the person said. A claim that is only about the same general topic is not relevant.

Return JSON only: {"relevant": true|false, "reason": "one short sentence"}`;

export type RelevanceJudge = (claim: string, reasons: string[]) => Promise<boolean>;

export const modelRelevance: RelevanceJudge = async (claim, reasons) => {
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    temperature: 0,
    system: RELEVANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `THE PERSON'S REASONS, IN THEIR WORDS:\n${reasons.map((r) => `- "${r}"`).join('\n')}\n\nCLAIM:\n"""${claim}"""`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return false;
  // Reuse the judge parser by mapping the field name: only a literal true counts.
  return parseJudgeOutput(block.text.replace('"relevant"', '"supported"')).supported;
};
