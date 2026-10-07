# Verified Persuasion · *Can You Be Convinced?*

A system that argues someone out of a wrong belief, using **only claims it can trace to a named source**. If it can't source a claim, it doesn't say it.

100xEngineers C7 Capstone · Module 3

- **Live:** https://canyoubeconvinced.vercel.app (participants start at `/start.html`)
- **Case study:** [`docs/04-case-study.md`](docs/04-case-study.md), with the participant's run in [`data/run-2026-10-07.md`](data/run-2026-10-07.md)
- **Demo video script:** [`docs/05-demo-video.md`](docs/05-demo-video.md)
- **Working notes and decisions:** [`CONTEXT.md`](CONTEXT.md)

---

## The idea in one paragraph

Research across 19 AI models and 77,000 people found the models that changed the most minds were also the least accurate. The usual reading is "lying persuades." It doesn't. What persuades is **density** — how many relevant checkable facts land in a conversation. Inaccuracy rose alongside it because a model pushed for more facts eventually invents them, and the same study found inaccuracy did *not* correlate with the persuasive effect. So the two are tangled, not opposed. This project untangles them: keep the facts, block the invention, see if it still works.

## What gets measured

| Metric | What it means | Target |
|---|---|---|
| **UCR** | Unsupported Claim Rate — unsourced claims ÷ total claims | 0% |
| **RCR** | Relevant Claim Rate — claims answering their stated reason ÷ total | high |
| **ΔB** | Belief change, before → immediately after | — |
| **ΔB week** | Belief change, before → 7 days later | — |

All four come out of the `assertions` and `measures` tables. See `run_claim_metrics` and `belief_deltas` views.

---

## How it works

```
  Their belief       Sources                    Draft             Gate
  and reasons   →   (trusted sites for the  →  (answers their →  (cut into claims,
  (asked on          topic; every quote          reasons, from     judge each against
   screen)           matched word for word       checked quotes    the quotes, blocking)
                     on its page by the          only)                  ↓
                     server)                                all claims sourced? → send
                                                            any claim not?      → redraft (×2),
                                                                                  then refuse;
                                                                                  log everything
```

**The gate is the project.** Everything else is conventional.

### Why the gate sits after generation, not in the prompt

A model told to "only cite real sources" will cite. Whether the citation exists is a different question — audits put fabrication rates between 8% and 50% depending on model and topic, and fabricated references routinely carry real author names with invented titles. You cannot reliably prevent this during generation. You can catch it afterwards.

### What the gate actually does

1. **Decompose** — split the drafted turn into atomic claims. Separate model call, no knowledge of the persuasion goal, so it has no incentive to mislabel an awkward claim.
2. **Classify** — assertion / question / reflection / connective. Only assertions get checked; the rest assert nothing.
3. **Verify** — for each assertion, does a retrieved passage actually *entail* it? Not "is it on the same topic" — entail. A passage saying protein needs rise with age does not support "older adults should eat more of everything."
4. **Enforce** — all pass → send with sources named. Any fail → strip, redraft naming the offending claim, retry. After 2 failed redrafts, refuse visibly and log it.

The refusal log is a **result**, not telemetry. It's the evidence that source discipline was structural rather than aspirational.

The control flow is fixed; decomposing and judging are model calls, so the gate is not deterministic. That's why the judge has its own test (below).

### Where the sources come from

Nobody prepares sources in advance. When someone states a belief:

1. It is sorted into a topic (health, technology, money, safety, science). Each topic has a fixed, hand-picked list of trusted sites (`SOURCE_LISTS` in `src/journey/sourcing.ts`).
2. A model searches **only those sites** and proposes short quotes.
3. **The server, with no model, downloads each page and keeps a quote only if it appears word for word** (`verification = 'exact_match'`). Paraphrases and invented sentences fail. Pages that refuse the download are dropped.
4. Fewer than five kept → one more search for other pages. Fewer than two → the system says it won't argue without evidence.

This proves a quote exists as written; it does not prove it was read in context. The judge's strictness and the site list bound the rest. What was found and why each quote was kept or rejected is stored on the belief (`beliefs.sourcing_log`).

---

## Nothing here knows what the belief is

The belief, its reasons, its sources and its site list are **rows in a database**, not code. Swap them and the system works on a different belief. That's deliberate — a system hardcoded to one topic isn't a system, it's a lookup table with a chatbot on top.

---

## Setup

```bash
npm install
npm test                 # gate + app control flow — no API key needed
npm run dev -- --demo    # click through every page: in-memory data, stubbed model, no keys
cp .env.example .env     # add ANTHROPIC_API_KEY and Supabase keys
npm run gate:judge       # is the judge strict enough? calls a real model
```

### Running a participant through it (self-serve)

1. Apply the migrations in `supabase/migrations/` and set the env vars (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optionally `MAX_NEW_BELIEFS_PER_DAY`).
2. Turn on Google sign-in in Supabase Auth, with the site's `/start.html` as a redirect URL.
3. Deploy (Vercel; `vercel.json` sets the function time limits).
4. Send the participant to `/start.html`. They log in with Google, agree, state the belief, answer the intake, rate it among four controls; the server finds and checks sources, builds the brochure and runs the reversal test; they read the brochure, rate, chat, rate; seven days later they rate once more.
5. Read the results from the database (`assertions`, `measures`, `beliefs.sourcing_log`), or `npm run metrics -- --belief <id>`.

**Manual mode (the first version)**, still available for a belief prepared by hand with human-checked quotes:

```bash
npm run intake:load -- data/intake.json                 # participant, belief, reasons, baseline, links
npm run passages:load -- --belief <id> data/passages.json  # human-checked passages
npm run run:reversal -- --belief <id> --claim "..."     # before any person sees it
npm run run:brochure -- --belief <id>                   # builds the fixed page once
npm run metrics -- --belief <id>                        # UCR (drafted and sent), RCR, ΔB, control drift
```

`data/intake.example.json` and `data/passages.example.json` show the shapes.

The participant's browser holds only their login session or the token in their link. The service key, the passages and which scale item is the target stay on the server.

### Two test suites, answering different questions

**`npm test`** — no key, no network. `gate-logic` covers what the gate does with a judge's answer; `app` covers retrieval, the conversation loop, the brochure and the HTTP handlers against an in-memory store. Every one defends a single property: *no path turns an unverified claim into a sent one.* A judge that throws, malformed JSON, an unrecognised fragment label, empty retrieval — all fail closed.

**`npm run gate:judge`** — calls a real model against the eight near-miss cases in `data/gate-cases.json`. Run it after any change to the judge, its model or its prompt (even layout: moving the passages once dropped it from 8/8 to 6/8).

### What the judge test is actually for

The cases that matter are not obvious fabrications. They are **near-misses** — a claim that overstates its passage by one degree:

| Passage says | Claim says | Verdict |
|---|---|---|
| "associated with" | "causes" | unsupported |
| "in healthy older adults" | "in everyone" | unsupported |
| "may be higher" | "is higher" | unsupported |

Those are what a real conversation produces, and what a similarity check waves through.

The two failure modes are not equally bad, and the test grades them separately:

- **False positive** (bad claim accepted) → **critical**, exits 1. Unsourced claims reach the person; this invalidates the project.
- **False negative** (good claim rejected) → **minor**, exits 0. The system goes quiet. Tolerable, worth watching.

---

## The runs, in order

| # | Run | What it is | Why it's ordered here |
|---|---|---|---|
| 0 | **Intake** | On screen: *why* do you believe this, where from, whom do you trust? Baseline score among four controls. | Must happen before they hear any argument |
| 1 | **Reversal** | Runs automatically once sources are found: the system is told to argue the participant's own (unsupported) belief is *true*. Logged verbatim. | Before the conversation; if it fabricates, that falsifies the hypothesis |
| 2 | **Brochure** | One static page, same facts, no conversation. Measure. | The baseline your system has to beat |
| 3 | **Treatment** | Full system, with disclosure. Measure. | — |
| 4 | **Delayed** | Same question, 7 days later. | Durability |

**On the brochure:** if a plain page moves the belief as much as your system does, your system added nothing and you say so. That's a graded criterion, not a failure.

**On disclosure:** tell them plainly they're talking to a machine that will try to change their mind. The effect survives it (Boissin et al. 2025, N=955), so honesty is free.

---

## The falsifier, stated in advance

The hypothesis dies if either of these happens:

1. The fixed brochure moves belief as much as the full system does.
2. The reversal run produces a fluent sourced-looking argument instead of a refusal.

**What does NOT falsify it:** a small shift, partial regression at 7 days, or the person still disagreeing at the end. Corrections reduce without erasing — that's the normal shape, not a failure.

---

## The threat that will most likely ruin your result

**Demand characteristics.** A participant who knows you, knows what you're testing, and wants your project to go well will move their number without their reasoning changing at all.

Mitigations, none complete:
- The participant takes part **alone, on their own device**, including the 7-day measure
- Bury the target belief among 3–4 unrelated control items — if the target moves and the controls don't, that's real (see the `control_drift` view)
- Check whether their **open-ended explanation** changed, not just the number. Someone who slides the scale but can't say what moved them is showing compliance
- Whatever remains, state it in the write-up

---

## Schema

| Table | Holds |
|---|---|
| `participants` | Pseudonym, Google login, consent, disclosure |
| `beliefs` | The exact statement and what they typed, topic, site list, status, `sourcing_log` |
| `reasons` | Their coded reason + **verbatim words** |
| `passages` | Quotes from listed sites; `verification` is `exact_match` (server-checked) or `human` |
| `runs` | reversal / brochure / treatment |
| `turns` | Drafted vs. sent text, redraft count |
| `assertions` | **Every claim, supported?, relevant?, blocked?** ← produces all the numbers |
| `measures` | Belief scores at each timepoint, plus open responses |

Views: `run_claim_metrics` (UCR, RCR), `belief_deltas` (ΔB), `control_drift`.

---

## Sources

- Hackenburg et al., *Science* 390(6777), 2025 — density is the lever
- Costello, Pennycook & Rand, *Just the Facts*, 2025 — removing facts kills the effect
- Boissin et al., *PNAS Nexus* 4(11), 2025 — the effect survives disclosure
- Salvi et al., *Nature Human Behaviour* 9, 2025 — personalisation changes which facts arrive, not how they sound
- Wood & Porter, *Political Behavior*, 2019 — the backfire effect mostly doesn't replicate
- Min et al. (FActScore) 2023; Wei et al. (SAFE) 2024 — decompose-then-verify
