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

## State as of 2026-10-04

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

**`npm run gate:judge` has never run.** It needs an `ANTHROPIC_API_KEY`
and calls a real model, because the question it answers — is the judge
strict enough on near-misses — cannot be answered by a stub. Until it
runs, those 7 cases are assumptions.

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
and every case carries a `source_checked` flag. One case,
`correlation-to-causation`, is still `false` and its quote needs checking
against the AusDiab paper.

The general lesson, which belongs in the case study: **a quote nobody
opened is not a quote.** The same discipline applies to every row that
later enters the `passages` table with `human_verified = true`, because
the brochure and the conversation will show those to the participant as
the source's own words.

### Not done, and blocked

Retrieval, the conversation loop, and the brochure. All three need the
belief and the participant's stated reason, and neither exists yet.

### Not done, not blocked

- Deploy for the live-project-link deliverable (needs a UI first)
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
- **Deploy target**: Vercel, not yet set up.

---

## Deliverables (submission template)

1. Live project link — not started
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
