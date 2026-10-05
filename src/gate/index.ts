import type { GateResult, Passage, Verdict } from '../types.js';
import { modelDecompose, type Decomposer } from './decompose.js';
import { verifyAll, modelJudge, type Judge } from './verify.js';

export {
  decompose,
  modelDecompose,
  parseFragments,
  DECOMPOSE_SYSTEM_PROMPT,
  type Decomposer,
} from './decompose.js';
export {
  verifyFragment,
  verifyAll,
  modelJudge,
  parseJudgeOutput,
  JUDGE_SYSTEM_PROMPT,
  type Judge,
} from './verify.js';

export const MAX_REDRAFTS = 2;

export interface GateDeps {
  decompose?: Decomposer;
  judge?: Judge;
  maxRedrafts?: number;
}

/**
 * The gate. Nothing reaches the participant without passing through it.
 *
 * Why this sits AFTER generation rather than inside the prompt: a model told to
 * "only cite real sources" will cite. Whether the citation exists is a separate
 * question, and published audits put fabrication rates for ungrounded citations
 * anywhere from 8% to 50% depending on model and topic, with fabricated
 * references routinely carrying real author names and valid-looking identifiers.
 * Preventing fabrication during generation is not reliable. Catching it
 * afterwards is.
 *
 * The gate blocks; it does not warn. A refusal is a logged result, not an error.
 */
export async function runGate(
  draft: (feedback: string | null) => Promise<string>,
  passages: Passage[],
  deps: GateDeps = {},
): Promise<GateResult> {
  const decomposeFn = deps.decompose ?? modelDecompose;
  const maxRedrafts = deps.maxRedrafts ?? MAX_REDRAFTS;

  // A redraft usually repeats most of the previous draft's claims. The passages
  // are fixed for the whole run, so a claim's verdict cannot change: judge each
  // claim text once. A judge call that fails is forgotten, so it is retried.
  const baseJudge = deps.judge ?? modelJudge;
  const judged = new Map<string, ReturnType<Judge>>();
  const judge: Judge = (claim, ps) => {
    let verdict = judged.get(claim);
    if (!verdict) {
      verdict = baseJudge(claim, ps);
      judged.set(claim, verdict);
      verdict.catch(() => judged.delete(claim));
    }
    return verdict;
  };

  let feedback: string | null = null;
  let lastDraft = '';
  let lastVerdicts: Verdict[] = [];
  const attempts: GateResult['attempts'] = [];

  for (let attempt = 0; attempt <= maxRedrafts; attempt++) {
    lastDraft = await draft(feedback);

    const fragments = await decomposeFn(lastDraft);
    lastVerdicts = await verifyAll(fragments, passages, judge);
    attempts.push({ draft: lastDraft, verdicts: lastVerdicts });

    const unsupported = lastVerdicts.filter((v) => !v.supported);

    if (unsupported.length === 0) {
      return {
        sentText: lastDraft,
        draftedText: lastDraft,
        verdicts: lastVerdicts,
        redraftCount: attempt,
        refused: false,
        attempts,
      };
    }

    // Name the offending claims so the redraft can drop them specifically,
    // rather than rewriting blind and reintroducing the same problem.
    feedback = buildFeedback(unsupported);
  }

  // Out of redrafts. Rather than send something unverified, the system says it
  // cannot support the point. The participant sees a visible refusal.
  return {
    sentText: null,
    draftedText: lastDraft,
    verdicts: lastVerdicts,
    redraftCount: maxRedrafts,
    refused: true,
    attempts,
  };
}

export function buildFeedback(unsupported: Verdict[]): string {
  const lines = unsupported.map((v) => `- "${v.fragment.text}" — ${v.reason}`);
  return [
    'The following claims are not supported by any retrieved source and must not appear:',
    ...lines,
    '',
    'Rewrite without them. Do not substitute a weaker or hedged version of the same claim —',
    'drop the point entirely. Say less. Only assert what the sources establish.',
  ].join('\n');
}

/**
 * Salvage path: strip the unsupported fragments and keep the rest.
 *
 * Used when a redraft is not worth another model call. Cruder than redrafting —
 * removing a sentence mid-paragraph can leave the text disjointed — so it is the
 * fallback, not the default.
 */
export function stripUnsupported(draftedText: string, verdicts: Verdict[]): string {
  let out = draftedText;
  for (const v of verdicts) {
    if (!v.supported) out = out.split(v.fragment.text).join('');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}
