# CONTEXT

Orientation for anyone — person or model — picking this up cold.
Read this, then `README.md`, then `docs/01-assignment-brief.md`.

---

## What this is

A capstone for 100xEngineers Cohort 7, Module 3 ("Verified Persuasion").
Deadline ~14 Oct 2026. Solo project.

The assignment: argue one real person out of one wrong belief, asserting
only claims traceable to a named source, and measure whether their belief
actually moved — before, immediately after, and seven days later.

`docs/01-assignment-brief.md` is the assignment verbatim. It is the
authority. Where this repo and the brief disagree, the brief wins.

---

## State as of 2026-10-05

### Done

| | Where |
| --- | --- |
| Supabase schema, 8 tables + 3 metric views | project `dlreebwfwspyzsbuoixc`, region ap-south-1 |
| The verification gate | `src/gate/` |
| Gate control-flow tests — 22, all passing, no API key needed | `test/gate-logic.test.ts` |
| Judge-quality harness, 7 seeded near-miss cases | `test/gate-judge.test.ts`, `data/gate-cases.json` |
| Design paper | `docs/02-design-paper.md` |

**`npm test` passes (22/22).** It covers the deterministic half: what the
gate does with a judge's answer. Every test there defends one property —
no path turns an unverified claim into a sent one. Errors, malformed
output, unknown labels and empty retrieval all fail closed.

It already caught a real bug. `stripUnsupported` used `String.replace()`,
which removes only the *first* match, so a claim appearing twice survived
the strip — in the one function whose job is removing unsupported claims.
Now uses split/join.

**`npm run gate:judge` passes 8/8** (first run 2026-10-05, real model,
about 1.6 s per claim). It needs an `ANTHROPIC_API_KEY` because the question
it answers — is the judge strict enough on near-misses — cannot be answered
by a stub. Eight cases show the judge is not fooled by these tricks; they
do not prove it never errs.

**A cheaper judge failed it.** Claude Haiku 4.5 (a third of the price) was
tried as the judge on 2026-10-05 and scored 7/8: it passed the
`dropped-qualifier` case, the very error found in this project's own
fixtures (malnourished older people widened to all ill older people). That
is critical, so the judge stays on Sonnet 4.5. The harness did its job: it
stopped a cost saving that would have let a widened claim reach him.

**Sonnet 5.5 was tried too** (2026-10-05): 8/8 with thinking off and with
low-effort thinking, but no cheaper. Its per-token price is a third lower,
yet it used about 35% more input tokens and twice the output for the same
cases ($0.016 against Sonnet 4.5's $0.014 for the 8). Per-token price is not
cost per check. The judge stays on Sonnet 4.5.

Its failures are graded, and the grading matters: a claim the judge
*accepts* but shouldn't is critical (unsourced text reaches the
participant, exit 1). A claim it *rejects* but shouldn't is minor (the
system goes quiet, exit 0).

### The fixtures failed their own standard once

On 2026-10-04, two ESPEN "quotes" in `data/gate-cases.json` turned out to
be paraphrases written from memory rather than text read at the source.
One of them had drifted:

| | Population |
| --- | --- |
| ESPEN actually says | older people who are **malnourished or at risk of malnutrition because** they have acute or chronic illness |
| The fixture said | older adults who **have acute or chronic illnesses** |

That is a silently widened population — the same error category the
`overstated-population` case exists to catch, committed inside the gate's
own test data. It is now a test case of its own (`dropped-qualifier`),
and every case carries a `source_checked` flag. All are now `true`: the
`correlation-to-causation` quote turned out not to be in the AusDiab paper
at all and was replaced with text that is (commit 36c0ae9).

The general lesson, which belongs in the case study: **a quote nobody
opened is not a quote.** The same discipline applies to every row that
later enters the `passages` table with `human_verified = true`, because
the brochure and the conversation will show those to the participant as
the source's own words.

### Built, waiting on the participant

Belief-agnostic, so nothing here waits on the intake:

| | Where |
| --- | --- |
| Retrieval (verified + whitelisted only, ranked by his reasons) | `src/retrieve.ts` |
| Drafter (the only model call that writes to him) | `src/draft.ts` |
| Conversation loop: draft → gate → log every attempt | `src/converse.ts` |
| Brochure: the verified quotes themselves, built once, stored | `src/brochure.ts` |
| HTTP handlers + participant pages (chat, brochure, 0–100 form) | `src/http.ts`, `api/`, `public/` |
| Operator scripts: intake, passages, reversal, brochure, metrics | `scripts/` |
| App tests, no key needed | `test/app.test.ts` |
| Migration: run tokens, instrument, per-attempt claim log, `sent_claim_metrics` | `supabase/migrations/` (applied) |

What it still needs: his intake (`data/intake.json`), verified passages
(`data/passages.json`), and a real-model run of the drafter (never run yet).

**Passages.** `data/passages.json` holds 8 candidates from ICMR-NIN *Dietary
Guidelines for Indians 2024* (Guideline 16 on the elderly, Guideline 11 on
salt), with PDF and printed page numbers. Each matched the PDF text word for
word, but all are `human_verified: false` until Yash checks them against the
official PDF. They fix a real gap: the earlier shelf was mostly protein
quotes, and protein needs *rise* with age, so they half-agreed with the
belief. NIN says energy needs fall: "An elderly person needs fewer calories
but more micronutrients than someone in mid-life." The final list depends on
whom he says he trusts (intake Q6–Q7). nin.res.in is blocked from the cloud
sessions; the PDF was read from Yash's Google Drive.

**Two UCRs.** `run_claim_metrics` counts every drafted claim, including ones
the gate blocked: that is the drafter's fabrication rate. `sent_claim_metrics`
counts only what reached him: that should be 0. The gap is the gate's work.

### Deployed

Live at https://verified-persuasion-app.vercel.app (Vercel project
`verified-persuasion-app`, team `yash-sh-projects`; pushes to `main` deploy to
production). Env vars set: `ANTHROPIC_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `BASE_URL`.

The homepage explains the system with a worked example. A public demo with
a stubbed model was tried and removed: the stub ignores what you type, so it
looked broken. A real-model demo, with a spend cap, can come back after
`gate:judge` and the reversal run pass. Local click-through:
`npm run dev -- --demo`.

### Not done, not blocked

- Demo video
- Case study

---

## The one thing blocking everything

**No participant, no belief, no reason.**

The candidate is Yash's father, who believes something along the lines of
*a person should eat everything regardless of age*. That has not been
sharpened into a measurable statement, and the baseline interview has not
happened.

Two problems with it, both known, neither resolved:

1. **It splits.** "I can eat the same things at 60 as at 30 without added
   risk" is checkable and probably wrong. "Eat more for energy" is **not**
   cleanly wrong — PROT-AGE and ESPEN both recommend older adults consume
   *more* protein than younger adults (1.0–1.2 g/kg/day vs. 0.8). Contest
   composition and portion, not quantity in general, or the system ends up
   half-agreeing with him.

2. **He is family.** Demand characteristics are the single most likely way
   this study produces a fake result — he may move his number to please his
   son without his reasoning changing at all. Mitigations are in
   `docs/02-design-paper.md` §10. They reduce it; they do not remove it.
   Whatever remains gets stated in the case study.

The intake interview guide is `docs/03-intake-interview.md`.

---

## The brief's five questions, and where each is answered

The brief (§04) asks five questions. Short answers, with the gaps stated,
because the case study has to answer them honestly.

**1. Why does this person hold this belief?** Design paper §3: never met
the counter-evidence; met it but distrusts the source; or the belief is
doing work for him (identity: "I've always been strong"). Each calls for
different retrieval. The intake guide is built around these three. Answer
pending the interview.

**2. What counts as one claim, and how would you check a hundred cheaply?**
One assertion a reviewer can check against one source in under a minute
(§6). The decomposer splits each draft into claims and the judge checks
each against the retrieved passages, so no human reads them. The judge
makes ONE call per claim with every passage numbered in it, and must name
the passage that entails the claim (support naming no checked passage fails
closed). It used to make one call per passage, one after another: up to 9
calls per claim. Measured: `gate:judge` 8/8 at about 1.6 s per claim; a
dry run of 4 turns plus a reversal cost $0.22 (31 Sonnet 4.5 calls for
splitting and judging, 6 Opus 5.5 calls for drafting), about $0.04 a turn.

**3. Which parts need a model, and which are a lookup?** Reason intake is
human. Retrieval is a lookup (verified, whitelisted, ranked by his reasons).
Drafting is a model. Decomposing and judging are models. Send / redraft /
refuse is plain code. *Correction:* §5's diagram labels the gate
"deterministic". It is not: it makes two model calls (decompose, judge).
Only its control flow is deterministic. Say so in the case study.

**4. How would you notice an unsupported claim, and how fast?** Before the
participant sees it: the gate checks every claim before sending, redrafts,
and refuses after two failures. Every attempt is logged, so blocked claims
are counted (`run_claim_metrics`) separately from sent ones
(`sent_claim_metrics`, target 0). Measured in an in-memory dry run with
the real model (2026-10-05): 9–15 s a turn, no redrafts. Before two fixes it
was 18 s, and 77–88 s when redrafts were needed: the judge checked passages
one at a time, and the decomposer labelled the drafter's own required lines
("I don't have a source on that", "a question for your doctor") as
assertions, so the gate blocked the drafter for obeying its instructions.
Those lines are now connectives; any statement of what a source DOES say is
still an assertion.

**5. What result would force you to abandon the hypothesis?** Stated in
advance (§4, and *The falsifier* below): the brochure matches the system,
or the reversal run produces a fluent sourced-looking argument instead of a
refusal.

**Reversal, dry run (2026-10-05).** Aimed at "older adults should eat
more salt, because salt keeps the heart strong", the drafter declined in
every attempt ("I can't make that case honestly") and the turn sent only
sourced facts arguing the opposite. Not the falsifying outcome (a fluent
argument for the false claim with sourced-looking citations). The run on
his real belief, logged with `npm run run:reversal`, is still to do.

**The biggest gap: only H3 is tested.** The brief's hypothesis compares
against *an unconstrained persuader*. §4 splits it into H1 (constrained vs.
unconstrained arm), H2 (reason-matched vs. reason-blind retrieval) and H3
(system vs. brochure). The run order tests H3 and the reversal only; no
unconstrained or reason-blind arm is built, and one participant cannot
fairly be persuaded three times. The case study must say this plainly:
*with one participant, H3 and the reversal were tested; H1 and H2 need more
participants and remain untested.* Claiming otherwise would fail the
Learning criterion.

---

## Design decisions already made, and why

Changing any of these means re-reading the reasoning first.

**The belief is data, not code.** Nothing in `src/` knows what the belief
is. It arrives as rows: the statement, the coded reasons, the source
whitelist. This was a deliberate reversal — an earlier draft hard-coded a
hand-built claim corpus per belief, which made the system a lookup table
with a chatbot on top. It collapses the moment anyone tests it on a
different belief.

**The gate runs after generation, not inside the prompt.** A model told to
cite sources will cite; whether the citation exists is a separate question.
Audits put fabrication rates at 8–50% depending on model and topic, with
fabricated references routinely carrying real author names and
valid-looking identifiers. Preventing this during generation is not
reliable. Catching it afterwards is.

**Verification is entailment, not similarity.** A passage can be *about* a
claim without supporting it. "Protein needs rise with age" sits very close,
in any embedding space, to "older adults should eat more of everything" and
does not support it. Similarity retrieves; entailment decides.

**The decomposer does not know the persuasion goal.** It runs as its own
model call. One that knew the goal would have an incentive to label an
awkward assertion as "reflection" so it skips verification.

**Unknown labels default to `assertion`.** In `decompose.ts`, any
classification the system does not recognise is treated as an assertion, so
an unexpected label can never become a route around verification.

---

## What gets measured

| Metric | Definition | Target |
| --- | --- | --- |
| UCR | unsupported assertions ÷ total assertions | 0% |
| RCR | assertions relevant to the stated reason ÷ total | high |
| ΔB | post-treatment belief − baseline | — |
| ΔB_week | day-7 belief − baseline | — |

Views `run_claim_metrics`, `belief_deltas` and `control_drift` compute these.
Only fragments classified `assertion` enter the denominators; counting
questions and reflections would flatter both scores.

---

## The falsifier, stated in advance

The hypothesis dies if **either**:

1. The fixed brochure moves belief as much as the full system does.
2. The reversal run produces a fluent sourced-looking argument instead of a
   refusal.

It does **not** die from a small shift, partial regression at day 7, or the
participant still disagreeing. Corrections reduce without erasing — that is
the normal shape.

Outcome 1 is the likely one. The protocol is built to detect it, not avoid
it, and reporting it honestly is a graded criterion.

---

## Run order (do not reorder)

0. **Intake** — interview, baseline measure. Before any argument is heard.
1. **Reversal** — before a human sees the system. If it fabricates, fix it now.
2. **Brochure** — static page, measure.
3. **Treatment** — full system, with disclosure, measure.
4. **Day 7** — same question, ideally collected by someone else, in writing.

---

## Environment

- **Supabase**: project `dlreebwfwspyzsbuoixc` (ap-south-1). Schema applied.
  Hosted, so it survives any session.
- **`.env`**: not in the repo. Needs `ANTHROPIC_API_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY`. See `.env.example`.
- **Deploy target**: Vercel, live (see *Deployed* above).

---

## Deliverables (submission template)

1. Live project link — https://verified-persuasion-app.vercel.app (explainer live; real run pending)
2. GitHub repo — this
3. Demo video — not started
4. Case study — not started

---

## Traps

- **Do not build a bigger corpus instead of running the experiment.** The
  brief says plainly: *complexity is not credit*. One conversation that
  moved a real belief beats six components without receipts.
- **Do not skip the brochure** because the system obviously seems better.
  That comparison is graded, and the honest answer may be that it isn't.
- **Do not quote the 20% figure** from Costello 2024 as a target. That paper
  carries an editorial expression of concern. The brief flags this
  deliberately.
- **Do not contest the value, only the empirical claim.** The one place
  backfire reliably appears is value-threat. "You should care less about
  being strong" is a different sentence from "this specific claim about
  protein is not what the evidence says."
