# Verified Persuasion: A Design and Evaluation Paper

> **Snapshot taken 2026-10-04.** The living version is at
> https://claude.ai/code/artifact/3f722a59-1015-48ea-ae8c-6beb138c2689
> and may have moved on. If the two disagree, the live doc wins.
>
> One note on what this snapshot loses: the architecture diagram in
> §5 is a rendered widget in the live doc and cannot survive a markdown
> export. The four stages are described in prose below, and the same
> structure is drawn in the repo README.

---

## Abstract

The December 2025 Hackenburg result is usually read as a trade-off between persuasion and truth. It is not a trade-off. It is a confound: the same mechanism that made models persuasive — packing more checkable claims into a conversation — also made them wrong more often, because a model asked for more claims eventually produces claims it cannot support.

This paper argues that the two can be separated, and specifies a system that separates them. The claim: relevance, not volume, is what persuades. A system that asserts only claims answering the reason a person gives for their belief, and refuses every claim it cannot trace to a named source, should move belief as far as an unconstrained persuader while making measurably fewer unsupported claims.

What follows is the evidence for that claim, a model of why beliefs resist facts, an architecture that puts the deterministic, probabilistic and human parts in the right places, an experimental protocol with its falsifier stated in advance, and a build plan.

## 1. The observation, restated precisely

Hackenburg et al. deployed 19 language models across 707 political issues, collecting 76,977 responses from 42,357 people, then fact-checked 466,769 of the claims those models made. Three findings matter here, and they are usually collapsed into one.

**First: density is the mechanism.** Models were most persuasive when they packed arguments with a high volume of factual claims. Personalising arguments on user data had a comparatively small effect. Scaling model size barely moved persuasion at all — a separate paper by the same group found sharply diminishing returns from parameter count.

**Second: the levers that raised persuasion lowered accuracy.** Persuasion post-training raised persuasiveness by up to 51%, information-focused prompting by up to 27%, and both systematically degraded factual accuracy.

**Third — and this is the part the naive reading misses: inaccuracy did not correlate with the persuasive effect.** The models were less accurate and more persuasive, but the inaccurate claims were not what did the persuading. Density did.

That third point is the whole opening. If falsehood were the active ingredient, this project would be asking for a system that persuades less. It is not. The active ingredient is *how many relevant checkable claims land*, and falsehood is a by-product of demanding more claims than the model can support.

A second research line makes the same separation from the other direction. Costello, Pennycook and Rand's follow-up work isolated what drives belief change in AI dialogues: the only condition that substantially undermined the effect was prompting the AI to persuade *without presenting facts*. When the model relied more on facts and evidence, people changed their minds more often, and those who were persuaded overwhelmingly cited the factual arguments as the reason.

The design space this opens is narrow and specific: hold density high, make every claim traceable, and refuse the rest.

## 2. What the literature establishes

Five results constrain the design. Each one closes off a shortcut that would otherwise look attractive.

| Finding | Source | What it rules out |
| --- | --- | --- |
| Density drives persuasion; personalisation and scale barely do | [Hackenburg et al., *Science* 390:6777 (2025)](https://www.science.org/doi/10.1126/science.aea3884) | Reaching for a bigger model, or a personalisation layer, as the lever |
| Removing facts kills the effect; rhetorical and social framing do not carry it | [Costello, Pennycook & Rand, *Just the Facts* (2025 preprint)](https://osf.io/preprints/psyarxiv/h7n8u_v1) | Tone engineering, empathy scripts, persona design as the product |
| Personalisation changes *which facts arrive*, not how they sound | [Salvi et al., *Nature Human Behaviour* 9:1645 (2025)](https://doi.org/10.1038/s41562-025-02194-6) | Treating "knowing the user" as a style problem rather than a retrieval problem |
| The effect survives the person knowing they are talking to a machine | [Boissin et al., *PNAS Nexus* 4(11):pgaf325 (2025)](https://academic.oup.com/pnasnexus/article/4/11/pgaf325/8285733) | Any need for deception; disclosure is free |
| The headline 20% durable reduction carries an editorial expression of concern | [Costello et al., *Science* 385:eadq1814 (2024)](https://www.science.org/doi/10.1126/science.adq1814); [concern](https://www.science.org/doi/10.1126/science.aej2383) | Treating a published effect size as a target to hit |

The Salvi finding deserves a second look because it is the most counter-intuitive. Without personal data, GPT-4 beat human debaters but not significantly (p=0.31). With personal data, the odds of shifting a position rose 81.2%. The authors found **no change in the model's style** — only in which issues it raised. Personalisation was a fact-selection mechanism wearing a personalisation costume.

That has a direct architectural consequence. Knowing the person should route the *retrieval*, not the *prose*. The system does not need a warmer voice for a defensive user; it needs a different shortlist of claims.

One more constraint, from the same Salvi paper: the effect fell below significance again on strongly held topics. Whatever belief this system is pointed at, its strength at baseline is a moderator, not a nuisance variable — it belongs in the measurement, not in the discussion section.

## 3. Why beliefs resist facts

The folk model says people dig in when corrected. That model is wrong, and building around it would produce a timid system.

**The backfire effect mostly does not replicate.** Wood and Porter ran five experiments with more than 10,100 subjects across 52 issues chosen precisely because backfire should appear there. They found no correction capable of triggering it. Nyhan and Reifler, whose 2010 paper originated the idea, later collaborated on follow-up work that again found no backfire. The current reading is that people largely accede to corrections, even corrections that cut against their commitments.

So the design problem is not *how do I correct someone without provoking them*. It is a narrower and more tractable question: **why has this person not already updated, given that corrections generally work?**

Three answers, and they call for different retrieval:

1. **They have never encountered the specific counter-evidence.** The belief is unexamined rather than defended. Correction works almost immediately; the job is supplying facts that are new to them.
2. **They have encountered it and discounted the source.** The belief is defended at the level of provenance, not content. The job is a source they already accept — which is a retrieval constraint, not a rhetorical one.
3. **The belief is doing work for them.** It licenses something they want (a habit, a purchase, an identity: "I have always been strong"). Facts that do not touch the thing being protected slide off, regardless of how many arrive.

This is what the challenge document means by *why they hold it, not why it is wrong*, and it is the single highest-leverage input to the system. The person's stated reason determines which claims are even eligible to be retrieved.

There is a fourth mechanism worth naming because it bounds what success can look like. Walter and Tukachinsky's meta-analysis finds corrections reduce but do not fully erase misinformation's influence — the continued-influence effect. A belief that moves 30 points and settles back 10 over a week is the normal shape of a real result, not a failure.

**Where backfire does appear** is the one case worth designing against: value-threat. Recent work found that when an LLM's value-framing opposed a participant's stance, some participants reported *increased* commitment — a backfire triggered not by the correction but by value-misalignment. The practical rule: contest the empirical claim, never the value the person attaches to it.

## 4. The hypothesis and its falsifier

**Hypothesis.** A system that (a) asserts only claims answering the reason the person gives for their belief and (b) refuses any claim it cannot trace to a named source will move belief as far as an unconstrained persuader, while making measurably fewer unsupported claims.

It decomposes into three independently testable sub-claims, which matters because they can fail separately:

| # | Sub-claim | Measured by | Falsified if |
| --- | --- | --- | --- |
| H1 | Constraining claims to verifiable ones does not cost persuasion | Belief shift, constrained arm vs. unconstrained arm | The unconstrained arm moves belief materially further |
| H2 | Relevance to the stated reason beats volume | Belief shift per claim asserted, reason-matched vs. reason-blind retrieval | Reason-matched retrieval needs as many claims for the same shift |
| H3 | The interaction beats a static document | Belief shift, system vs. fixed brochure | The brochure matches or beats the system |

**The global falsifier, stated in advance.** If the constrained system produces a belief shift that a fixed brochure of the same claims matches within the measurement noise, then interactivity, reason-modelling and verification added nothing, and the hypothesis is dead regardless of how clean the verification pipeline is.

That is the outcome most likely to actually occur, and the protocol is built to detect it rather than to avoid it.

**A second falsifier, for the verification half.** If the reversal run — pointing the system at a claim the evidence does not support — produces a fluent argument with sourced-looking citations rather than a refusal, then source discipline was a prompt-level aspiration, not a property of the system.

**What would not falsify anything.** A small belief shift. Regression toward baseline at one week. The person disagreeing at the end. These are expected; the continued-influence literature predicts partial and decaying effects. Only the two conditions above kill the hypothesis.

## 5. System architecture

The design question the challenge document asks — *which parts need a model at all, and which are a lookup you are dressing up* — has a specific answer here. The model composes prose. It does not decide what is true, and it does not decide what is relevant.

Four stages, with one blocking gate:

```
  1. Reason intake  →  2. Retrieval  →  3. Draft turn  →  4. Gate
  (human, once)        (determin-       (model: the       (two model calls,
                        istic)           only writer)      fixed rules, blocking)
                                                                  │
                                              ┌───────────────────┴──────────┐
                                              ▼                              ▼
                                     all claims matched            unmatched claim
                                     → sent to the person          → stripped, logged,
                                                                     turn redrafted
```

The gate is the whole product. Everything else is conventional.

**Stage 1 is human and happens once.** You sit with the person and ask why they believe what they believe, before any system exists. This is not onboarding copy; it is the input that makes stage 2 possible. Their answer is transcribed and hand-coded into one or more reason categories.

**Stage 2 is a lookup.** Retrieval is keyed by which reason each claim answers. Given the coded reason, it returns the eligible shortlist from whitelisted sources. No model judgement enters here — if a claim has no retrieved passage behind it, it cannot be said, which is what makes the refusal behaviour a property of the architecture rather than of a prompt.

**Stage 3 is the only component that writes to the participant.** An LLM composes a conversational turn from the retrieved material. It is free with the prose and unfree with the content.

**Stage 4 decomposes what it wrote back into atomic claims and checks each against the retrieved passages.** Any claim not entailed by a passage is stripped and the turn is redrafted. The gate blocks; it does not warn. A logged refusal is a data point, not an error.

*Correction (2026-10-05).* An earlier version of this section called the gate deterministic and the draft the only model step. Both were wrong. Decomposing and judging are model calls too, so the gate is probabilistic in what it judges. What is deterministic is its control flow: an unknown label counts as an assertion, any error or malformed verdict counts as unsupported, and nothing is sent unless every assertion passed. The gate can still be wrong, and the place it would be wrong is the judge, which is why `npm run gate:judge` exists.

The asymmetry is deliberate: a model that invents a claim mid-sentence is normal behaviour, and no prompt reliably prevents it. Catching it after generation is tractable. Preventing it during generation is not.

## 6. What counts as one claim

The challenge document asks two questions that turn out to be the same question: *what counts as one claim*, and *what decides that it is true*.

**A claim is one assertion that a reviewer can check against one source in under a minute.** That is the operational definition, borrowed from the decompose-then-verify literature (FActScore, SAFE, VeriScore), which converged on atomic decomposition for exactly this reason: a compound sentence cannot be marked true or false, only its parts can.

Each retrieved passage carries, at minimum:

| Field | Purpose |
| --- | --- |
| `quote` | The verbatim text from the source |
| `source_name`, `source_url` | What the system names when it asserts from this |
| `source_domain` | Checked against the whitelist |
| `applies_to` | Population the evidence was measured on |
| `human_verified` | True only once a person has opened it and confirmed |

The `applies_to` field exists because a system must be able to represent *a claim the evidence supports only for some people*. Without it, a finding measured in healthy older adults silently becomes a claim about everyone — which is one of the near-miss failures the gate is built to catch.

**A warning the domain forces.** Choosing the belief badly makes an honest corpus impossible to build. A belief like *at my age I can eat whatever I want* splits into one clearly unsupported half and one half where the evidence runs the other way: the PROT-AGE and ESPEN position papers recommend older adults consume **more** protein than younger adults — 1.0 to 1.2 g/kg/day against the standard 0.8 — so "eat more" is not straightforwardly wrong. Better to discover this while gathering sources than mid-conversation.

## 7. The verification gate

The gate answers the challenge document's question *how would you notice an unsupported claim, and how fast*. The answer is: before the person sees it, every time, by construction.

Four steps run on every drafted turn:

1. **Decompose.** Split the drafted turn into atomic claims. This is a second, separate LLM call with a narrow job and no knowledge of the persuasion goal — a decomposer that knows the goal has an incentive to label an awkward assertion as "reflection" so it skips verification. Decomposition quality is the known weak point in this literature; over-decomposition and context-stripping are documented failure modes, so the prompt targets verifiability rather than maximum atomicity, following VeriScore's approach over FActScore's.
2. **Classify.** Each fragment is marked as a factual assertion, a question, a reflection of the person's own words, or connective tissue. Only factual assertions proceed. This matters more than it sounds: most of a good conversational turn is not assertion, and sending it all to matching produces noise.
3. **Verify.** Each assertion is checked against the retrieved passages by **entailment**, not similarity. Does a passage actually establish this specific phrasing, or merely sit near it in vector space? Similarity alone passes paraphrases that drift beyond what the source says — a finding in one cohort restated as universal, "associated with" restated as "causes", "may" restated as "does" — which is the exact failure the gate exists to catch.
4. **Enforce.** If every assertion is supported, the turn is sent with its source names attached. If any is not, the turn is rejected and redrafted with the offending claim named. After two failed redrafts, the system says it cannot support that point and moves on — a visible refusal, logged.

**The refusal log is a primary result, not telemetry.** Its contents answer the second falsifier directly. The rate of blocked claims per conversation, and what they were, is the evidence that source discipline was structural.

**What this cannot catch.** A claim entailed by a passage that was itself misread or mis-scoped when it entered the system. The gate enforces traceability to retrieved text; the accuracy of that text rests on the whitelist and the human verification step. This is a real limitation and belongs in the case study rather than being hidden by the architecture diagram.

**Why not just prompt the model to cite sources.** Because the audit data says that does not work. Under retrieval-disabled conditions, fabrication rates for medical citations ran from 8% to 50% depending on model, and 42.4% of fabricated references carried a wrong identifier that looked valid. A model asked to cite will cite. Whether the citation exists is a separate question, and the gate is what asks it.

## 8. Experimental protocol

Four runs, in this order. The reversal run comes before the treatment run so that a system which fails it is caught before a real person is exposed to it.

**Run 0 — Reason intake.** A recorded conversation with the participant asking only why they hold the belief. No persuasion. The transcript is coded into reason categories, which key retrieval. Baseline belief is measured here, before they know what the system will argue.

**Run 1 — Reversal.** Point the system at a claim the evidence does not support. Record verbatim what it does. Three outcomes are possible and all are reportable: it refuses; it argues with hedges; it argues confidently with source-shaped citations. The third falsifies the source-discipline half of the hypothesis and must be reported as such.

**Run 2 — Baseline brief.** The participant reads a fixed one-page document containing the same top claims, same sources, no interactivity, no reason-matching. Belief measured immediately after. This is the brochure, and it is the comparison that decides whether the system earned its complexity.

**Run 3 — Treatment.** A conversation with the full system, with disclosure. Belief measured immediately after, and again at seven days.

**On disclosure:** the participant is told plainly they are speaking with a machine that will try to change their mind. Boissin et al. found the effect survives this — belief reduction held whether participants believed they were talking to an AI or a human — so there is no experimental cost to honesty here, only an ethical gain.

**Order and contamination.** Runs 2 and 3 on the same person contaminate each other: whatever the brochure moves is already moved when the conversation starts. Two options, and this is a genuine design choice rather than a detail:

- **Between-subjects** — different people get brochure and system. Clean comparison, needs at least two participants, and the comparison is confounded by whatever differs between them.
- **Within-subjects, brochure first** — one person, brochure then conversation, with the conversation's effect measured as additional movement past the brochure's. Weaker claim, but it is the honest question anyway: *does the conversation add anything the document did not already give?*

The within-subjects version is recommended for a single-participant study, because it measures the increment the system must justify rather than an absolute effect it cannot cleanly claim.

**Claim accounting.** Every assertion in every run is logged and counted.

## 9. Metrics

Four numbers, all falling out of the `assertions` and `measures` tables.

| Metric | Definition | Target |
| --- | --- | --- |
| **UCR** | Unsupported Claim Rate — unsupported assertions ÷ total assertions | 0% |
| **RCR** | Relevant Claim Rate — assertions answering the stated reason ÷ total assertions | high |
| **ΔB** | Belief at post-treatment minus belief at baseline | — |
| **ΔB_week** | Belief at seven days minus belief at baseline | — |

UCR is the source-discipline proof. RCR is the one that actually tests the hypothesis — "relevance beats volume" means nothing unless each claim is scored for relevance to the person's stated reason, which requires a per-claim judgment, not an impression of the transcript.

Only fragments classified as assertions enter either denominator. Counting questions and reflections would flatter both scores.

## 10. Measurement and threats to validity

**The instrument.** A 0–100 confidence scale on the belief statement, worded identically at all three time points, following the Costello protocol. One number, three times: before, immediately after, at seven days. Alongside it, one open-ended prompt — *what, if anything, changed your thinking* — because Costello's follow-up work found that participants who shifted overwhelmingly named the factual arguments, and that attribution is evidence about mechanism, not colour.

**Three threats, in descending order of how likely they are to wreck this study.**

**1. Demand characteristics — the dominant threat.** A single participant who knows the researcher, knows the hypothesis, and wants the project to go well will move their number. Orne's compliant-subject role describes this exactly. It is worse in a within-subjects design, where the participant sees every condition and can infer what is being tested, and worse again when there is any relationship between researcher and participant.

Mitigations, none of them complete:

- The seven-day measure is collected by someone else, or through a written form rather than a conversation.
- The scale is embedded among three or four unrelated belief items so the target is not the only thing being asked about. If the target moves and the controls do not, that is signal; if everything drifts, it is answer-style drift.
- The open-ended response is examined for whether the reasoning changed, not just the number. A participant who slides the number but cannot say what moved them is showing compliance, and that is detectable.
- The seven-day gap does some work on its own: politeness decays faster than genuine updating.

**Whatever remains after these, state it in the case study.** A single-participant study with a known researcher cannot rule out demand effects. The honest report says how large the shift was and how much of it could be compliance, rather than presenting the number bare.

**2. Regression to baseline is expected, not failure.** The continued-influence literature predicts that corrections reduce without fully erasing. A shift that partly reverses by day seven is the normal shape.

**3. Baseline strength as moderator.** Salvi et al. found personalisation effects fell below significance on strongly held topics. A belief held at 95/100 has less room to move than one held at 70, and a small shift on a strongly held belief is not a smaller result than a large shift on a weak one. Record initial strength and report the shift against it.

**On n=1.** A single-participant study cannot support a claim about people in general, and the write-up should not make one. What it can support is a claim about *this system*: that it ran end to end, that its refusal behaviour was structural, and that it did or did not beat a document on the one case tested. That is what the challenge document asks for — one conversation that moved a real belief, with receipts.

## 11. Rubric mapping

| Criterion | Where it is answered | Artefact that proves it |
| --- | --- | --- |
| Problem understanding | Run 0 intake, coded reasons | The transcript and the `reasons` rows derived from it |
| Source discipline | The gate | The `assertions` table: every sent claim with its matched passage |
| Baseline discipline | Run 2 | Brochure text plus both belief numbers, and a stated verdict on which won |
| Reversal test | Run 1 | Verbatim system output on an unsupported claim |
| Product quality | Run 3 | End-to-end conversation with a real person and a day-7 number |
| Learning | §4 revisited | A written account of which sub-claim the evidence moved, and where |

The last row is the one most often faked. It requires that the hypothesis stated here be compared, in writing, against what actually happened — including the case where H3 fails and the brochure wins.

## 12. Open risks

1. **The participant is a family member or someone close.** Demand characteristics get worse, and the relationship makes an honest day-7 answer harder to obtain. A participant with more distance is methodologically better. If proximity is unavoidable, the day-7 measure should be collected in writing, by someone else, and the limitation stated plainly.
2. **The belief turns out to be partly correct.** Common, and survivable if caught early. Gathering sources is the detector.
3. **The gate blocks so much that conversation quality collapses.** If most drafted turns fail verification, the whitelist is too narrow or retrieval is returning the wrong passages. Symptom to watch from the first test conversation, not the week before submission.
4. **Nothing moves.** A belief held at 90+ may not shift in one conversation. Report the number obtained, not the one hoped for.

## Sources

- Hackenburg, K. et al. [The levers of political persuasion with conversational artificial intelligence](https://www.science.org/doi/10.1126/science.aea3884). *Science* 390(6777), eaea3884, 2025.
- Hackenburg, K. et al. [Scaling language model size yields diminishing returns for single-message political persuasion](https://doi.org/10.1073/pnas.2413443122). *PNAS* 122(10), 2025.
- Costello, T. H., Pennycook, G. & Rand, D. G. [Durably reducing conspiracy beliefs through dialogues with AI](https://www.science.org/doi/10.1126/science.adq1814). *Science* 385(6714), eadq1814, 2024. See also the [editorial expression of concern](https://www.science.org/doi/10.1126/science.aej2383).
- Costello, T. H., Pennycook, G. & Rand, D. [Just the facts: how dialogues with AI reduce conspiracy beliefs](https://osf.io/preprints/psyarxiv/h7n8u_v1). Preprint, 2025.
- Boissin, E. et al. [Dialogues with large language models reduce conspiracy beliefs even when the AI is perceived as human](https://academic.oup.com/pnasnexus/article/4/11/pgaf325/8285733). *PNAS Nexus* 4(11), pgaf325, 2025.
- Salvi, F. et al. [On the conversational persuasiveness of large language models](https://doi.org/10.1038/s41562-025-02194-6). *Nature Human Behaviour* 9, 1645, 2025.
- Wood, T. & Porter, E. [The elusive backfire effect: mass attitudes' steadfast factual adherence](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2819073). *Political Behavior*, 2019.
- Swire-Thompson, B., DeGutis, J. & Lazer, D. [Searching for the backfire effect: measurement and design considerations](https://www.sciencedirect.com/science/article/pii/S2211368120300516). *Journal of Applied Research in Memory and Cognition*, 2020.
- Min, S. et al. [FActScore: fine-grained atomic evaluation of factual precision in long-form text generation](https://arxiv.org/abs/2305.14251). EMNLP, 2023.
- Wei, J. et al. [Long-form factuality in large language models (SAFE)](https://arxiv.org/abs/2403.18802). 2024.
- Walters, W. H. & Wilder, E. I. [Fabrication and errors in the bibliographic citations generated by ChatGPT](https://doi.org/10.1038/s41598-023-41032-5). *Scientific Reports* 13, 2023.
- Bauer, J. M. et al. [Evidence-based recommendations for optimal dietary protein intake in older people (PROT-AGE)](https://www.sciencedirect.com/science/article/pii/S1525861013003265). *JAMDA* 14(8), 2013.
- Deutz, N. E. P. et al. [Protein intake and exercise for optimal muscle function with aging (ESPEN)](https://www.espen.org/files/PIIS0261561414001113.pdf). *Clinical Nutrition* 33(6), 2014.
