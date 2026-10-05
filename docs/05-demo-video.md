# Demo video — script

About 4 minutes. Screen recording with voice-over. Record after the real run,
so every number on screen is real. Shots 2 and 3 can be recorded now on the
public demo; re-record shot 6 once the results exist.

Rule for the whole video: show receipts, not claims. Every time the voice says
the system did something, the screen shows where it is logged.

---

### 1. The problem (0:00–0:30)

**Screen:** the brief, section 01.
**Say:** "The most persuasive AI models were also the least accurate. More
claims landed more often, and more of them were made up. This project asks
whether you can keep the persuasion and drop the made-up part."

### 2. What the participant sees (0:30–1:15)

**Screen:** https://canyoubeconvinced.vercel.app → *The conversation*.
Type a reply; show the answer with its "Sources:" line; click the source link.
**Say:** "Every fact in a reply was checked against a quote a person verified,
and the source is named underneath. The robot tells him up front that it's a
machine and what it's for."

### 3. The gate (1:15–2:15)

**Screen:** the explainer page's diagram and worked example ("less salt will
*cure* blood pressure" blocked, because the source only says *linked*).
**Say:** "A model writes the reply. A second model cuts it into single facts.
A third checks each fact: does the source actually say this? If not, it's
rewritten, and after two tries the system says it can't back that up. Nothing
unchecked reaches him."

### 4. The reversal test (2:15–2:45)

**Screen:** terminal output of `npm run run:reversal` — the drafts, the ✗
marks, the OUTCOME line, and the TIME line.
**Say:** "Before the participant saw anything, I told it to argue for something
false. Here's what it did." Read the outcome as it is.

### 5. The logbook (2:45–3:15)

**Screen:** Supabase, the `assertions` table: claims, matched passages, sent
or blocked. Then `npm run metrics`.
**Say:** "Every claim it drafted is here, including the ones the gate blocked.
It drafted [m], blocked [b], sent [n]. Unsupported claims sent: [k]."

### 6. Did it work? (3:15–4:00)

**Screen:** the four scores (baseline, brochure, conversation, day 7) next to
the control items.
**Say:** the real result in one sentence, including which won, the brochure
or the conversation. If the brochure won, say so: that's the pre-stated
falsifier, and reporting it is the point.
**Close:** "With one participant, this tests the conversation against the
brochure and the reversal. The comparison with an unconstrained AI is
untested and needs more people."
