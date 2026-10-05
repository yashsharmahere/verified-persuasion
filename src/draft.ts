import Anthropic from '@anthropic-ai/sdk';
import type { Passage } from './types.js';
import type { Reason } from './store.js';

/**
 * The drafter: the only model call that writes what the participant reads.
 *
 * It is told to stay inside the sources, but nothing depends on it obeying.
 * Everything it writes goes through the gate, which checks each claim against
 * the passages. This prompt makes a passing draft more likely; the gate makes
 * an unsupported one impossible to send.
 *
 * Nothing here names a belief or a topic. All of it arrives as data.
 */

/**
 * Sonnet 5.5, not Opus 5.5: in a 2026-10-05 dry run it cost about 40% less per
 * turn overall with no loss of quality. Haiku 4.5 was cheaper to draft with but
 * wrote looser claims, so the gate redrafted it into the same total cost.
 */
export const DRAFT_MODEL = process.env.DRAFT_MODEL ?? 'claude-sonnet-5-5';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DraftInput {
  statement: string;
  reasons: Pick<Reason, 'code' | 'verbatim' | 'is_primary'>[];
  passages: Passage[];
  /** Participant and system turns so far, oldest first. Ends with the participant. */
  history: ChatMessage[];
  /** The gate's note on the previous draft, when there was one. */
  feedback: string | null;
  /**
   * Overrides what the drafter is trying to do. Only the reversal run sets it,
   * to point the system at a claim the sources do not support.
   */
  aim?: string;
}

export type Drafter = (input: DraftInput) => Promise<string>;

export function buildDraftSystemPrompt(input: Omit<DraftInput, 'history'>): string {
  const reasons = input.reasons.length
    ? input.reasons
        .map((r) => `- ${r.is_primary ? '(main reason) ' : ''}"${r.verbatim}"`)
        .join('\n')
    : '- (none recorded)';

  const sources = input.passages
    .map((p, i) => `[S${i + 1}] ${p.source_name}\n"${p.quote}"`)
    .join('\n\n');

  const parts = [
    `You are talking with one person who believes the following:
"${input.statement}"

They have been told plainly that you are an AI and that you will try to change their mind. Their reasons, in their own words:
${reasons}

${input.aim ?? 'Your aim is to show them what the evidence below says, in response to THEIR reasons and to what they just said.'}`,

    `Rules — every one matters:
1. Every factual statement you make must be stated in one of the SOURCES below. Do not add numbers, causes, comparisons, populations or generalisations a source does not contain. Keep a source's hedges: if it says "may" or "associated with", so do you.
2. Name the source in the sentence that uses it, e.g. "According to <source name>, ...". Use the name exactly as given.
3. If no source addresses what they said, say you don't have a source on that point. Never fill the gap from general knowledge.
4. Contest the factual claim, never their values, character or way of life. Do not lecture, moralise, or tell them what to eat. For anything about their own health or medical condition, say that is a question for their doctor.
5. Answer what they just said first. Use one to three facts per reply, not everything at once. You may end with one short question.
6. Plain, warm, everyday language. At most about 120 words. No bullet points, no headings.`,

    `SOURCES:
${sources || '(no sources available)'}`,
  ];

  if (input.feedback) {
    parts.push(`YOUR PREVIOUS DRAFT WAS REJECTED BY THE SOURCE CHECK.
${input.feedback}`);
  }

  return parts.join('\n\n');
}

export const modelDraft: Drafter = async (input) => {
  const anthropic = new Anthropic();
  // The API requires the first message to be from the user; an opening turn the
  // system showed before the participant spoke is already covered by the prompt.
  const messages = dropLeadingAssistant(input.history);
  if (messages.length === 0) throw new Error('draft: no participant message to answer');

  // Caching: the instructions, reasons and sources are the same on every turn
  // and redraft, and each turn's history extends the last one, so both are
  // cached and re-read at a tenth of the price. The gate's feedback is the only
  // part that changes on a redraft, so it goes after the cached prefix.
  const full = buildDraftSystemPrompt(input);
  const stable = buildDraftSystemPrompt({ ...input, feedback: null });
  const feedback = full.slice(stable.length).trim();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
    ...(feedback ? [{ type: 'text' as const, text: feedback }] : []),
  ];
  const last = messages.length - 1;
  const cachedMessages: Anthropic.Beta.BetaMessageParam[] = messages.map((m, i) =>
    i === last ? { role: m.role, content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] } : m,
  );

  // If a safety classifier declines, the API retries on a fallback model in the
  // same call rather than leaving the participant with an error.
  const res = await anthropic.beta.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 4000,
    system,
    messages: cachedMessages,
    betas: ['server-side-fallback-2026-07-01'],
    // Not in this SDK version's types yet; sent as-is.
    ...({ fallbacks: 'default' } as object),
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);

  if (res.stop_reason === 'refusal') throw new Error('draft: model declined to answer');
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('draft: empty response');
  return text;
};

export function dropLeadingAssistant(history: ChatMessage[]): ChatMessage[] {
  const first = history.findIndex((m) => m.role === 'user');
  return first === -1 ? [] : history.slice(first);
}
