import Anthropic from '@anthropic-ai/sdk';
import { domainAllowed } from '../retrieve.js';
import type { NewPassage } from '../store.js';

/**
 * Find sources for a belief nobody prepared in advance.
 *
 * Two steps, and only the second decides what counts:
 *
 *   1. A model searches a fixed list of trusted sites and proposes quotes.
 *      Models misquote, paraphrase from memory, and invent plausible sentences,
 *      so nothing it proposes is trusted.
 *   2. The server downloads each proposed page itself and keeps a quote only if
 *      it appears there word for word. That replaces "a person opened the
 *      source" with "the server opened the source": it proves the quote exists
 *      as written. It does not prove the quote was read in context; the judge's
 *      strictness and the trusted-site list are what bound that.
 */

/**
 * Whose pages may be quoted, by topic. Nothing else is searched or kept. A
 * belief gets the list for its topic, decided when it is first stated, and it
 * is stored on the belief so the conversation uses the same list.
 *
 * Learned the hard way (2026-10-05): one health-only list meant a belief about
 * phone batteries found nothing at all, and the system rightly refused.
 */
export const TOPICS = ['health', 'technology', 'money', 'safety', 'science'] as const;
export type Topic = (typeof TOPICS)[number];

export const SOURCE_LISTS: Record<Topic, string[]> = {
  health: [
    'who.int', 'nin.res.in', 'icmr.gov.in', 'mohfw.gov.in', 'fssai.gov.in', 'nih.gov', 'ncbi.nlm.nih.gov', 'cdc.gov',
    'fda.gov', 'nhs.uk', 'nice.org.uk', 'efsa.europa.eu', 'heart.org', 'diabetes.org', 'cancer.gov',
  ],
  technology: [
    'apple.com', 'samsung.com', 'google.com', 'android.com', 'microsoft.com', 'ieee.org', 'nist.gov', 'energy.gov',
    'cpsc.gov', 'bis.gov.in', 'ul.com', 'ulse.org', 'batteryuniversity.com',
  ],
  money: [
    'rbi.org.in', 'sebi.gov.in', 'irdai.gov.in', 'pfrda.org.in', 'amfiindia.com', 'ncfe.org.in', 'incometax.gov.in',
    'investor.gov', 'consumerfinance.gov', 'finra.org', 'moneyhelper.org.uk',
  ],
  safety: [
    'cpsc.gov', 'nfpa.org', 'osha.gov', 'nhtsa.gov', 'fema.gov', 'ready.gov', 'ndma.gov.in', 'morth.nic.in', 'who.int',
    'cdc.gov', 'ulse.org',
  ],
  science: [
    'nasa.gov', 'noaa.gov', 'usgs.gov', 'epa.gov', 'nist.gov', 'imd.gov.in', 'isro.gov.in', 'nationalacademies.org',
    'royalsociety.org', 'who.int',
  ],
};

export function isTopic(x: unknown): x is Topic {
  return typeof x === 'string' && (TOPICS as readonly string[]).includes(x);
}

/** Kept for code that predates topics: the health list. */
export const TRUSTED_DOMAINS = SOURCE_LISTS.health;

export interface Candidate {
  source_name: string;
  url: string;
  quote: string;
}

const MIN_QUOTE = 25;
const MAX_QUOTE = 400;
/** Enough for the brochure and the conversation; more and the drafter recites. */
export const MAX_SOURCED = 8;

/** The search model. Sonnet 5.5 supports the current web search and fetch tools. */
export const SOURCING_MODEL = 'claude-sonnet-5-5';

const SOURCING_PROMPT = `You find published evidence about one belief a person holds. You do not argue; you collect.

Use web search and web fetch to find short passages from the allowed sites that speak directly to the belief, in either direction: passages that support it count as much as passages against it. Search only the allowed sites; if they say nothing on the belief, return an empty list rather than stretching.

Rules:
- Copy each quote EXACTLY as it appears on the page: same words, same order. Never paraphrase, shorten inside, or join sentences. If unsure of the exact wording, fetch the page and copy from it.
- Each quote is one to three sentences, 25 to 400 characters.
- Use the URL of the page you copied it from.
- Prefer official guidance, standards and systematic reviews over single studies and news. Where an Indian national body on the allowed list covers the topic, include it: the reader is in India.
- Use at least three different organisations if the allowed sites allow it; no more than four quotes from any one page.
- Up to 10 quotes from up to 5 pages.

Return JSON only, no other text: {"quotes":[{"source_name":"Organisation, document title, year","url":"https://...","quote":"..."}]}`;

/** Ask the model for candidate quotes. Server tools run on Anthropic's side, so this needs no outbound search access. */
export async function modelFindCandidates(statement: string, reasons: string[], domains: string[]): Promise<Candidate[]> {
  const anthropic = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      // The tools enforce the list, but the model cannot see it unless told;
      // without this line it returned nothing at all (2026-10-05).
      content: `BELIEF: "${statement}"\n\nWHY THEY HOLD IT, IN THEIR WORDS:\n${reasons.map((r) => `- ${r}`).join('\n') || '- (not given)'}\n\nALLOWED SITES (and their subdomains): ${domains.join(', ')}`,
    },
  ];
  // Server tools can pause a long turn; continue it a few times at most.
  for (let i = 0; i < 4; i++) {
    const res = await anthropic.beta.messages.create({
      model: SOURCING_MODEL,
      max_tokens: 8000,
      system: SOURCING_PROMPT,
      messages,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 5, allowed_domains: domains },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6, allowed_domains: domains, max_content_tokens: 20000 },
      ],
      // Not in this SDK version's types yet; sent as-is.
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return parseCandidates(text);
  }
  return [];
}

/** Lenient on wrapping, strict on shape: anything malformed is dropped, never repaired. */
export function parseCandidates(raw: string): Candidate[] {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { quotes?: unknown };
    if (!Array.isArray(parsed.quotes)) return [];
    return parsed.quotes.filter(
      (q): q is Candidate =>
        !!q &&
        typeof q === 'object' &&
        typeof (q as Candidate).source_name === 'string' &&
        typeof (q as Candidate).url === 'string' &&
        typeof (q as Candidate).quote === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Text normalised so that a quote matches its page despite typography and
 * layout: curly quotes and dashes, line breaks, PDF hyphenation at line ends,
 * HTML entities. Words and their order are untouched, so a paraphrase still
 * fails.
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/­/g, '') // soft hyphen
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2') // "pro-\ntein" -> "protein"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Does the quote appear, word for word, in the page? */
export function quoteFoundIn(quote: string, pageText: string): boolean {
  const q = normalizeForMatch(quote).replace(/^["']|["']$/g, '');
  return q.length >= MIN_QUOTE && normalizeForMatch(pageText).includes(q);
}

export type PageFetcher = (url: string) => Promise<string>;

/** Download a page and return its text. PDFs are read with unpdf; HTML has its markup removed. */
export const fetchPageText: PageFetcher = async (url) => {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; VerifiedPersuasion/1.0; quote check)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
};

export interface VerifyReport {
  kept: NewPassage[];
  rejected: { candidate: Candidate; why: string }[];
}

/**
 * Keep a candidate only if its site is trusted, its length is sane, and the
 * server finds it word for word in the downloaded page. Fails closed: a page
 * that cannot be downloaded means its quotes are dropped.
 */
export async function verifyCandidates(
  beliefId: string,
  candidates: Candidate[],
  domains: string[],
  fetchText: PageFetcher = fetchPageText,
  max = MAX_SOURCED,
): Promise<VerifyReport> {
  const allowed = new Set(domains);
  const pages = new Map<string, Promise<string | null>>();
  const kept: NewPassage[] = [];
  const rejected: VerifyReport['rejected'] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const reject = (why: string) => rejected.push({ candidate: c, why });
    let host: string;
    try {
      const u = new URL(c.url);
      if (u.protocol !== 'https:') { reject('not https'); continue; }
      host = u.hostname.toLowerCase();
    } catch {
      reject('bad url');
      continue;
    }
    if (!domainAllowed(host, allowed)) { reject('site not on the trusted list'); continue; }
    const quote = c.quote.trim().replace(/^["“']|["”']$/g, '');
    if (quote.length < MIN_QUOTE || quote.length > MAX_QUOTE) { reject('quote too short or too long'); continue; }
    const key = normalizeForMatch(quote);
    if (seen.has(key)) { reject('duplicate'); continue; }

    if (!pages.has(c.url)) pages.set(c.url, fetchText(c.url).catch(() => null));
    const page = await pages.get(c.url)!;
    if (page === null) { reject('page could not be downloaded'); continue; }
    if (!quoteFoundIn(quote, page)) { reject('not found word for word on the page'); continue; }

    seen.add(key);
    kept.push({
      belief_id: beliefId,
      source_name: c.source_name.trim().slice(0, 200),
      source_url: c.url,
      source_domain: host,
      quote,
      human_verified: false,
      applies_to: null,
      verification: 'exact_match',
    });
    if (kept.length >= max) break;
  }
  return { kept, rejected };
}
