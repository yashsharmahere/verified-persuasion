import type { Passage } from './types.js';
import type { Reason } from './store.js';

/** More than this and the drafter starts reciting instead of answering. */
export const MAX_PASSAGES = 12;

/**
 * Pick the passages a turn may rest on.
 *
 * At the scale of one belief (tens of passages) this is a filter, not a search
 * engine, and it says so: there is no embedding index here because there is
 * nothing for one to do yet.
 *
 * Three rules, all fail-closed:
 *   1. Only human-verified passages. A quote nobody checked against its source
 *      is exactly what the gate exists to keep out (two of the seven judge
 *      fixtures turned out not to match their sources).
 *   2. Only passages whose domain is on the belief's whitelist. An empty
 *      whitelist means nothing is eligible, not everything.
 *   3. Passages tagged to one of the participant's reasons come first, then
 *      untagged (general) ones. Passages tagged to some other reason are left out.
 */
export function selectPassages(
  passages: Passage[],
  reasons: Pick<Reason, 'code' | 'is_primary'>[],
  whitelist: string[],
  max = MAX_PASSAGES,
): Passage[] {
  const codes = new Set(reasons.map((r) => r.code));
  const primary = new Set(reasons.filter((r) => r.is_primary).map((r) => r.code));

  const eligible = eligiblePassages(passages, whitelist);

  const rank = (p: Passage) => {
    if (p.applies_to && primary.has(p.applies_to)) return 0;
    if (p.applies_to && codes.has(p.applies_to)) return 1;
    if (!p.applies_to) return 2;
    return 3; // tagged to a reason this participant did not give
  };

  return eligible
    .filter((p) => rank(p) < 3)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => p);
}

/** Rules 1 and 2 only: verified, and from a whitelisted domain. No reason-matching. */
export function eligiblePassages(passages: Passage[], whitelist: string[]): Passage[] {
  const allowed = new Set(whitelist.map((d) => d.toLowerCase()));
  return passages.filter((p) => isVerified(p) && domainAllowed(p.source_domain, allowed));
}

/**
 * Checked by a person, or found word for word in the downloaded source by the
 * server. Both prove the quote exists as written; nothing else counts.
 */
export function isVerified(p: Passage): boolean {
  return p.human_verified === true || p.verification === 'exact_match';
}

/** "www.espen.org" is allowed by "espen.org"; "notespen.org" is not. */
export function domainAllowed(domain: string, allowed: Set<string>): boolean {
  const d = domain.toLowerCase();
  for (const a of allowed) {
    if (d === a || d.endsWith(`.${a}`)) return true;
  }
  return false;
}
