# Verified Persuasion

A system that argues someone out of a wrong belief, using **only claims it can trace to a named source**. If it can't source a claim, it doesn't say it.

100xEngineers C7 Capstone · Module 3

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
  Their reason          Retrieval             Draft              Gate
  (human interview) →  (whitelisted    →   (the only    →   (deterministic,
                        sources only)       model step)      blocking)
                                                                  ↓
                                                    all claims sourced? → send
                                                    any claim not?      → strip,
                                                                          redraft,
                                                                          log it
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

---

## Nothing here knows what the belief is

The belief, its reasons, and its source whitelist are **rows in a database**, not code. Swap them and the system works on a different belief. That's deliberate — a system hardcoded to one topic isn't a system, it's a lookup table with a chatbot on top.

---

## Setup

```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY and Supabase keys
npm run gate:test        # does the gate catch bad claims?
```

### Before you point it at a person

`npm run gate:test` runs the gate against known-good and known-bad claims in `data/gate-cases.json`. Swap that file when you change belief.

The cases that matter are the **near-misses** — a claim that overstates its passage by one degree. "Associated with" → "causes". "In healthy older adults" → "in everyone". "May be higher" → "is higher". Those are what a real conversation produces, and what a loose checker waves through.

Two kinds of failure, and they are not equally bad:
- **False negative** (good claim marked unsupported) → the system goes mute. Annoying.
- **False positive** (bad claim marked supported) → unsourced claims reach the person. This is the one that invalidates the project.

---

## The runs, in order

| # | Run | What it is | Why it's ordered here |
|---|---|---|---|
| 0 | **Intake** | Human interview: *why* do you believe this? Baseline score. | Must happen before they hear any argument |
| 1 | **Reversal** | Point the system at a claim with no evidence. Record verbatim what it does. | Before a human sees it — if it fabricates, you fix it now |
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
- Collect the 7-day measure **in writing, by someone else**
- Bury the target belief among 3–4 unrelated control items — if the target moves and the controls don't, that's real (see the `control_drift` view)
- Check whether their **open-ended explanation** changed, not just the number. Someone who slides the scale but can't say what moved them is showing compliance
- Whatever remains, state it in the write-up

---

## Schema

| Table | Holds |
|---|---|
| `participants` | Pseudonym, consent, disclosure |
| `beliefs` | The exact statement, domain, source whitelist |
| `reasons` | Their coded reason + **verbatim words** |
| `passages` | Quotes from whitelisted sources, with a human-verified flag |
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
