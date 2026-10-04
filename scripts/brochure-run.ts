/**
 * Build the brochure once, from the verified passages, and store it on the
 * belief's brochure run. The participant then reads exactly what was stored.
 *
 *   npm run run:brochure -- --belief <id>
 *
 * Refuses to rebuild once built: changing the document after it has been shown
 * would change the comparison.
 */
import { buildBrochure } from '../src/brochure.js';
import { supabaseStore } from '../src/store.js';
import { baseUrl, check, db, requireArg } from './lib.js';

const beliefId = requireArg('belief', 'The belief id is printed by intake:load.');
const supabase = db();
const store = supabaseStore(supabase);

const belief = await store.getBelief(beliefId);
if (!belief) throw new Error(`No belief ${beliefId}`);
const run = check(
  await supabase
    .from('runs')
    .select('id, access_token')
    .eq('belief_id', beliefId)
    .eq('condition', 'brochure')
    .maybeSingle(),
  'brochure run',
);

if ((await store.listTurns(run.id)).length > 0) {
  console.error('The brochure for this belief is already built. Not rebuilding it.');
  process.exit(1);
}

const { doc, assertions } = buildBrochure(belief, await store.listPassages(beliefId));
const turn = await store.insertTurn({
  run_id: run.id,
  idx: 0,
  speaker: 'system',
  drafted_text: null,
  sent_text: JSON.stringify(doc),
  redraft_count: 0,
});
await store.insertAssertions(assertions(turn.id));

console.log(`Brochure built with ${doc.items.length} passage(s).
  ${baseUrl()}/brochure.html?t=${run.access_token}`);
