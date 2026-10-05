# Case study — Verified Persuasion

Draft skeleton. Sections follow the brief's six grading criteria. Everything
marked **[RESULT]** waits on the real run; everything else is already true.
Fill the gaps with numbers from `npm run metrics`, quotes from the transcript,
and his words from the intake. Do not round a disappointing number into a
good one: the brief grades honesty about the result, not the result.

---

## 0. One paragraph

**[RESULT]** One participant (my father, 60+) believed *[target statement,
exact wording]*. Baseline [x]/100. After a fixed brochure of the same sources:
[y]. After a conversation with a system that may only say what it can trace to
a named, human-checked source: [z]. Seven days later: [w]. Of [n] claims the
system sent him, [k] were unsupported (UCR [k/n]%). Of [m] claims it drafted,
the gate blocked [b]. Pointed at a false claim, it [refused / ...].

---

## 1. Problem understanding: why he holds it

The brief asks why he holds the belief, not why it is wrong. Design paper §3
gives three mechanisms, and the intake was built to tell them apart:

1. He has never met the counter-evidence.
2. He has met it and distrusts the source.
3. The belief is doing work for him (identity, habit).

**[RESULT]** What the intake found, in his words:
- Q2, what "everything" includes: "…"
- Q6–Q7, whom he trusts and doesn't: "…"
- Q9, what age means to him: "…"
- Q11, what would change his mind: "…"
- Q13, why he holds it, one or two sentences: "…"

**[RESULT]** Which mechanism this is, and what it changed:
- Which candidate statement became the target, and why. If his real belief
  was T3 ("eating more keeps you strong"), say so: protein needs genuinely
  rise with age (ESPEN, PROT-AGE), so contesting it head-on would have been
  wrong.
- Which sources he trusts, and so which went on the shelf. ICMR-NIN was the
  default because it is India's own government nutrition body.
- Anything from Q12 (a doctor's advice) that limited what the system may say.

---

## 2. Source discipline: every claim traceable to a named source

**Design.** Every turn passes a gate before it is sent:

1. A model drafts a reply from retrieved, human-checked passages only.
2. A separate model splits the draft into fragments and labels each an
   assertion, question or reflection. It is not told the persuasion goal, so
   it has no reason to relabel an awkward assertion. Unknown labels count as
   assertions.
3. A judge model checks each assertion against the passages by entailment:
   does the passage say this, not merely sit near it.
4. If any assertion fails, the reply is redrafted with the failure named. After
   two failed redrafts the system says it cannot back that point up.
5. Every drafted claim is logged, sent or blocked, with its matched passage.

**What it cannot catch.** A claim entailed by a passage that was itself
misread. The gate proves the system said only what the shelf says; it cannot
prove the shelf is right. That rests on checking every quote by hand.

**Evidence that this risk is real.** Two "quotes" in the gate's own test
fixtures turned out to be paraphrases written from memory. One had silently
widened who the advice was for (ESPEN's "older people who are malnourished or
at risk of malnutrition because they have acute or chronic illness" became
"older adults who have acute or chronic illnesses"). A third, attributed to
the AusDiab paper, was not in the paper at all. Lesson: **a quote nobody
opened is not a quote.**

**Correction to the design.** The first design paper called the gate
deterministic. It is not: splitting and judging are model calls. Only its
control flow is fixed. The weak point is the judge, which is why its accuracy
is measured separately (below).

**[RESULT]** Numbers:

| | Value |
| --- | --- |
| Judge harness (`gate:judge`): cases passed | [p]/8 |
| Of those, unsupported claims the judge let through (critical) | [c] |
| Time per claim checked | [s] s |
| Claims drafted in his conversation | [m] |
| Claims blocked by the gate | [b] |
| Claims sent | [n] |
| Unsupported claims sent (UCR) | [k] ([k/n]%) |
| Seconds per turn, from the reversal run | [t] s |

The gap between drafted and sent is the drafter's fabrication rate, and the
gate's work.

---

## 3. Baseline discipline: the brochure

The brochure is a fixed page of the same verified quotes, no conversation, no
reason-matching. He read it first and scored, then had the conversation and
scored again (within-subjects, brochure first; design paper §8 explains why).
So the conversation's effect is the movement past what the brochure already
gave.

**[RESULT]**

| | Target | Controls (mean) |
| --- | --- | --- |
| Baseline | | |
| After brochure | | |
| After conversation | | |
| Day 7 | | |

**[RESULT] Which won:** one plain sentence. If the brochure matched the
system within noise, the hypothesis is dead by our own pre-stated falsifier,
and that sentence says so.

---

## 4. Reversal test

Before he saw anything, the system was pointed at a claim the shelf does not
support: **[RESULT] "…"**

**[RESULT]** What it did, verbatim, from `npm run run:reversal`: refused /
argued only with what the sources say / argued with sourced-looking claims the
sources do not support. The third would falsify the source-discipline half of
the hypothesis.

---

## 5. Product quality

- Live: https://verified-persuasion-app.vercel.app, with a public demo of every
  page (made-up belief, stand-in model, nothing stored).
- He used a personal link, told first that it is a machine and what it is for.
- Day-7 measurement on the same form, same wording, ideally collected by
  someone else and in writing.

**[RESULT]** What went wrong in his session, and what the transcript shows
about tone, length and refusals.

---

## 6. Learning: where evidence changed the hypothesis

Already true:

- **The fixtures.** The gate's test data failed its own standard (section 2).
  It changed process: every quote now carries how and when it was checked.
- **The shelf half-agreed with him.** The first shelf was mostly protein
  quotes, and protein needs *rise* with age. That supports "eat more", which is
  part of what he believes. The shelf had to move to energy, salt and sugar
  (ICMR-NIN Guidelines 11 and 16).
- **The gate is not deterministic** (section 2).

**[RESULT]** What the run changed. Which sub-claim moved, which didn't, and
what that says about relevance versus volume.

### What was not tested

The brief's hypothesis compares against an *unconstrained persuader*. Design
paper §4 splits it into:

| | Sub-claim | Tested? |
| --- | --- | --- |
| H1 | Constraining claims does not cost persuasion (vs. an unconstrained arm) | **No.** No unconstrained arm was built, and one person cannot be persuaded three times. |
| H2 | Relevance to his reason beats volume (vs. reason-blind retrieval) | **No.** Same reason. |
| H3 | The conversation beats a fixed brochure | **Yes**, within one person, brochure first. |

With one participant, H3 and the reversal were tested; H1 and H2 need more
participants and remain untested.

### Threats to validity

- **He is family.** He may move his number to please his son. Mitigations:
  scores on paper, unrelated control items, the open "what changed your
  thinking?" question compared with his baseline reasoning, and day 7 collected
  by someone else. These reduce the risk; they do not remove it.
  **[RESULT]** Did the controls move?
- **n = 1.** Nothing here generalises. It is a demonstration that the pipeline
  works end to end on a real person, with receipts.
- **Brochure first.** Whatever the brochure moved was already moved before the
  conversation started.
