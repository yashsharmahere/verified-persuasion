/**
 * Load one participant's Run 0 intake: participant, belief, reasons, baseline
 * scores, and the three runs with their links.
 *
 *   npm run intake:load -- data/intake.json
 *
 * The belief statement is the candidate wording chosen as target. The other
 * candidates keep their baseline scores as "alt:T2" etc. Later timepoints ask
 * only the target and the controls, in one fixed shuffled order.
 */
import { baseUrl, check, db, newToken, readJson } from './lib.js';

interface Intake {
  participant: { label: string; consented_at: string; disclosed_ai: boolean; notes?: string };
  belief: { domain: string; source_whitelist: string[] };
  target: string;
  candidates: Record<string, string>;
  controls: Record<string, string>;
  baseline: { scores: Record<string, number>; open_response?: string; collected_by?: string };
  reasons: { code: string; verbatim: string; is_primary: boolean }[];
}

const path = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'data/intake.json';
const intake = readJson<Intake>(path);
const fail = (msg: string) => {
  console.error(msg);
  process.exit(1);
};

// Validate everything before writing anything.
const statement = intake.candidates[intake.target];
if (!statement) fail(`target "${intake.target}" is not one of the candidates`);
if (!intake.participant.consented_at) fail('No consent recorded. Do not load a participant without consent.');
if (!intake.participant.disclosed_ai) fail('disclosed_ai is false. The protocol requires disclosure.');
if (!intake.belief.source_whitelist?.length) fail('source_whitelist is empty: no source would be eligible.');
if (intake.reasons.filter((r) => r.is_primary).length !== 1) fail('Exactly one reason must be is_primary.');
if (intake.reasons.some((r) => !r.verbatim || r.verbatim === 'His exact words.')) fail('Every reason needs his verbatim words.');
for (const label of [...Object.keys(intake.candidates), ...Object.keys(intake.controls)]) {
  const s = intake.baseline.scores[label];
  if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 100) fail(`baseline score for ${label} must be 0–100`);
}

const supabase = db();
const existing = check(
  await supabase.from('participants').select('id').eq('label', intake.participant.label),
  'participants',
);
if (existing.length && !process.argv.includes('--force')) {
  fail(`A participant labelled ${intake.participant.label} already exists. Use a new label, or --force.`);
}

// Target among the controls, in a fixed random order that every later form reuses.
const instrument = [
  { item: 'target', text: statement! },
  ...Object.entries(intake.controls).map(([item, text]) => ({ item, text })),
]
  .map((x) => ({ x, k: Math.random() }))
  .sort((a, b) => a.k - b.k)
  .map(({ x }) => x);

const participant = check(
  await supabase
    .from('participants')
    .insert({
      label: intake.participant.label,
      consented_at: intake.participant.consented_at,
      disclosed_ai: intake.participant.disclosed_ai,
      notes: intake.participant.notes ?? null,
    })
    .select('id')
    .single(),
  'insert participant',
);

const belief = check(
  await supabase
    .from('beliefs')
    .insert({
      participant_id: participant.id,
      statement,
      domain: intake.belief.domain,
      source_whitelist: intake.belief.source_whitelist,
      instrument,
    })
    .select('id')
    .single(),
  'insert belief',
);

check(
  await supabase.from('reasons').insert(intake.reasons.map((r) => ({ ...r, belief_id: belief.id }))),
  'insert reasons',
);

const label = (l: string) => (l === intake.target ? 'target' : l in intake.candidates ? `alt:${l}` : l);
check(
  await supabase.from('measures').insert(
    Object.entries(intake.baseline.scores).map(([l, score]) => ({
      belief_id: belief.id,
      timepoint: 'baseline',
      item: label(l),
      score,
      open_response: l === intake.target ? (intake.baseline.open_response ?? null) : null,
      collected_by: intake.baseline.collected_by ?? null,
    })),
  ),
  'insert baseline measures',
);

const runs = check(
  await supabase
    .from('runs')
    .insert(
      (['reversal', 'brochure', 'treatment'] as const).map((condition) => ({
        belief_id: belief.id,
        condition,
        access_token: newToken(),
      })),
    )
    .select('condition, access_token'),
  'insert runs',
);
const token = (c: string) => runs.find((r) => r.condition === c)!.access_token;

console.log(`Loaded ${intake.participant.label}.
  belief id:  ${belief.id}
  statement:  "${statement}"

Next: load verified passages (npm run passages:load -- --belief ${belief.id}),
then the reversal run, then build the brochure.

Participant links — keep these private; each link is the only credential:
  brochure:       ${baseUrl()}/brochure.html?t=${token('brochure')}
  conversation:   ${baseUrl()}/chat.html?t=${token('treatment')}
  day 7 form:     ${baseUrl()}/measure.html?tp=delayed&t=${token('treatment')}
`);
