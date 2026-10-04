/**
 * Score relevance for every sent claim not yet scored, then print the numbers.
 *
 *   npm run metrics -- --belief <id>
 *
 * UCR comes in two forms and both get reported:
 *   - drafted (run_claim_metrics):  how often the drafter produced unsupported claims
 *   - sent (sent_claim_metrics):    how often one reached the participant (should be 0)
 */
import { modelRelevance } from '../src/relevance.js';
import { check, db, requireArg } from './lib.js';

const beliefId = requireArg('belief', 'The belief id is printed by intake:load.');
const supabase = db();

const reasons = check(await supabase.from('reasons').select('verbatim').eq('belief_id', beliefId), 'reasons').map(
  (r) => r.verbatim as string,
);
const runs = check(await supabase.from('runs').select('id, condition').eq('belief_id', beliefId), 'runs');
const turnIds = check(
  await supabase.from('turns').select('id').in('run_id', runs.map((r) => r.id)),
  'turns',
).map((t) => t.id);

const pending = turnIds.length
  ? check(
      await supabase
        .from('assertions')
        .select('id, claim_text')
        .in('turn_id', turnIds)
        .eq('kind', 'assertion')
        .eq('sent', true)
        .is('relevant_to_reason', null),
      'assertions',
    )
  : [];

for (const a of pending) {
  const relevant = await modelRelevance(a.claim_text, reasons);
  check(
    await supabase
      .from('assertions')
      .update({ relevant_to_reason: relevant, relevance_judge: 'claude-sonnet-4-5' })
      .eq('id', a.id)
      .select('id'),
    'update relevance',
  );
}
if (pending.length) console.log(`Scored relevance for ${pending.length} claim(s).\n`);

const show = async (view: string, title: string) => {
  const rows = check(await supabase.from(view).select('*').eq('belief_id', beliefId), view);
  console.log(`${title}\n`);
  console.table(rows.map(({ belief_id: _b, run_id: _r, ...rest }) => rest));
};

await show('run_claim_metrics', 'Every drafted claim (pre-gate UCR):');
await show('sent_claim_metrics', 'Claims that reached the participant (post-gate UCR, RCR):');
await show('belief_deltas', 'Belief change on the target (ΔB):');
await show('control_drift', 'Control items, baseline → day 7 (should not move):');
