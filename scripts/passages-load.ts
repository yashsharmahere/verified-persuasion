/**
 * Load source passages for a belief.
 *
 *   npm run passages:load -- --belief <id> [data/passages.json]
 *
 * A passage marked human_verified must say how it was checked ("checked"), so
 * the flag cannot be set by habit. Unverified passages are stored but the app
 * never uses them.
 */
import { check, db, readJson, requireArg } from './lib.js';

interface PassageIn {
  source_name: string;
  source_url: string;
  quote: string;
  applies_to?: string | null;
  human_verified: boolean;
  checked?: string;
}

const beliefId = requireArg('belief', 'The belief id is printed by intake:load.');
const path = process.argv.slice(2).find((a) => a.endsWith('.json')) ?? 'data/passages.json';
const { passages } = readJson<{ passages: PassageIn[] }>(path);

const supabase = db();
const belief = check(
  await supabase.from('beliefs').select('id, source_whitelist').eq('id', beliefId).maybeSingle(),
  'belief',
);
const existing = new Set(
  check(await supabase.from('passages').select('quote').eq('belief_id', beliefId), 'passages').map((p) => p.quote),
);

const rows = [];
for (const [i, p] of passages.entries()) {
  const where = `passage ${i + 1} (${p.source_name})`;
  if (!p.quote?.trim() || !p.source_name?.trim()) throw new Error(`${where}: quote and source_name are required`);
  const domain = new URL(p.source_url).hostname.toLowerCase();
  if (p.human_verified && !p.checked?.trim()) {
    throw new Error(`${where}: human_verified is true but "checked" does not say how it was checked`);
  }
  if (!belief.source_whitelist.some((d: string) => domain === d || domain.endsWith(`.${d}`))) {
    console.warn(`  warning: ${where} is from ${domain}, which is not on the whitelist. It will never be used.`);
  }
  if (existing.has(p.quote)) {
    console.log(`  skip (already loaded): ${where}`);
    continue;
  }
  rows.push({
    belief_id: beliefId,
    source_name: p.source_name,
    source_url: p.source_url,
    source_domain: domain,
    quote: p.quote,
    human_verified: p.human_verified === true,
    applies_to: p.applies_to ?? null,
  });
}

if (rows.length) check(await supabase.from('passages').insert(rows).select('id'), 'insert passages');
const verified = rows.filter((r) => r.human_verified).length;
console.log(`Loaded ${rows.length} passage(s), ${verified} verified.`);
