# Demo video: script

**Format:** a screen recording with voice-over, about 5 minutes (Loom, OBS
or QuickTime). A face bubble in the corner is optional. Not a whiteboard
video: the point is to show the real system and where everything is logged.
The site's own animation and illustrations do the explaining.

**Order:** the problem → how the system is built → see it work → the test and
its result → what I learned.

**One rule for the whole video:** show receipts, not claims. Every time the
voice says the system did something, the screen shows it happening or shows
where it was logged.

**Before recording**
- Top up the Anthropic credit (a live run costs about ₹20–30).
- Open these tabs in order:
  1. The brief, section 01
  2. https://canyoubeconvinced.vercel.app (the homepage)
  3. GitHub: `src/journey/sourcing.ts` (the trusted-site lists)
  4. GitHub: `src/gate/` (the gate's code), and `docs/04-case-study.md` §2 (the judge test)
  5. https://canyoubeconvinced.vercel.app/start.html (signed in, fresh account)
  6. Supabase → Table editor → `beliefs` (the participant's row, `sourcing_log` column)
  7. Supabase → `assertions`, filtered to the participant's run
  8. GitHub: `docs/04-case-study.md` (§3 table, §4 reversal)
- For the live part, use a **different belief from the participant's**, so the
  demo doesn't touch study data. Good choice: *"Charging my phone overnight
  ruins the battery."*
- Browser zoom at 110–125% so text is readable in the video.

---

## Part 1. The problem (0:00–0:30)

**Screen:** the brief, section 01.

**Say:** "Research on AI persuasion found something uncomfortable: the models
that changed minds most also made the most things up. More claims meant more
chances to land, and more claims nobody could support. My question: can you
keep the persuasion and drop the made-up part? So I built an AI that may only
say what it can prove, and tested it on a real person."

---

## Part 2. How I built it (0:30–2:30)

### 2a. The big picture (0:30–0:50)

**Screen:** homepage, scroll to **"How it works"** (Write → Cut → Check →
Send or rewrite).

**Say:** "The system has two jobs. First, find trusted evidence for whatever
belief someone brings. Second, check every single reply against that evidence
before the person sees it."

### 2b. Finding sources without trusting the AI (0:50–1:25)

**Screen:** GitHub, `src/journey/sourcing.ts`: scroll the `SOURCE_LISTS`
(health, technology, money, safety, science).

**Say:** "Every topic has a fixed list of trusted sites I chose: WHO, ICMR,
NIH, the NHS, Mayo Clinic, RBI, SEBI and others. When someone states a
belief, an AI searches only those sites and proposes short quotes.

But AI models misquote. They paraphrase from memory and sometimes invent
sentences. So nothing it proposes is trusted. The server, with no AI
involved, downloads each page itself and keeps a quote only if it appears
there word for word. That's a lookup, not a model. A reworded quote is thrown
out."

### 2c. The gate: checking every reply (1:25–2:05)

**Screen:** homepage example animation (press *Replay*). Then GitHub
`src/gate/`.

**Say:** "Each reply goes through four steps.
One: an AI drafts the reply, using only the checked quotes and answering the
person's own reasons.
Two: a second AI cuts it into single pieces and labels them: facts,
questions, and lines like 'I don't have a source on that'.
Three: a judge checks every fact against the quotes. It has to name the exact
quote that says it, not just one on the same topic. If it can't name one, the
fact fails.
Four: if any fact fails, the reply is rewritten. If it fails twice, the AI
just says it can't back that up.
Here: 'older people need fewer calories' passes. 'Less salt will *cure* blood
pressure' is blocked, because the source says *linked*, not *cures*. And every
fact, sent or blocked, is logged."

### 2d. Testing the judge itself (2:05–2:30)

**Screen:** case study §2, the judge results (`gate:judge`, 8/8; the Haiku
note).

**Say:** "The judge is the weak point, so I tested it on eight trick claims
built from real quotes: a dropped qualifier, a widened group of people, a
removed 'may', an invented number, correlation turned into causation. It must
catch all of them. It scores 8 out of 8. A model a third of the price scored 7,
and its miss was the dangerous one, so I kept the stronger judge. A reply
costs about two to three rupees to write and check."

---

## Part 3. See it work (2:30–3:25): live

**Screen:** /start.html. Do each step briefly as you speak.

1. **Belief.** Type *"charging my phone overnight ruins the battery"*;
   confirm the one-sentence version.
   **Say:** "Anyone can log in with Google and type a belief. It turns away
   political and identity beliefs."
2. **Why.** Answer two questions.
   **Say:** "Before arguing, it asks *why* they believe it, because the brief
   cares about why a belief is held, not why it's wrong."
3. **0–100 page.** Point at the five statements.
   **Say:** "The belief is hidden among four unrelated decoy statements. The
   AI never mentions them, so they should stay still. Remember these."
4. **Finding the evidence.** Let it run (cut the wait in editing).
   **Say:** "Here's the sourcing you saw in the code: search, download, check
   word for word."
5. **Reading page, then chat.** Scroll the brochure; send one message.
   **Say:** "First a fixed page of the checked quotes, which is the baseline.
   Then the conversation: every fact names its source, and the source's own
   words are highlighted."

---

## Part 4. The test and its result (3:25–4:35)

### 4a. The participant (3:25–3:45)

**Screen:** case study §1.

**Say:** "The real test: one person I know, not family, took part alone. They
believed that eating breakfast before brushing sends mouth germs into your
stomach and causes stomach ache. Their reason: brushing removes germs that
build up overnight. They learned it from family, and they didn't think
anything would change their mind."

### 4b. The receipts (3:45–4:05)

**Screen:** Supabase `sourcing_log`, then `assertions`. Point at the blocked
row.

**Say:** "Thirteen quotes were proposed, and eight passed the word-for-word
check. Mayo Clinic and the CDC refused the download, so their quotes were
dropped. In the conversation, seven facts were sent, and all seven are backed
by a quote. This one was blocked: 'you swallow mouth germs whether or not
you've brushed'. It's plausible, but no source says it. That's exactly the
kind of gap-filling the gate exists to stop."

### 4c. The numbers, honestly (4:05–4:35)

**Screen:** case study §3 table.

**Say:** "They rated the belief 100. After the reading page: still 100. After
a four-minute conversation: 60. That looks like a clear win for the
conversation. But look at the decoys: 'cracking your knuckles causes
arthritis' went from 0 to 60, and nobody mentioned knuckles. By the rule I set
before the test, a change only counts if the decoys stay still. So this result
is inconclusive, and the case study says so. Seven days later they still
rated it 60. I asked that on a call, without the decoys, so it can't settle
the question either."

**Screen:** case study §4, the reversal quote.

**Say:** "I also told the AI to argue that their belief is *true*. It agreed
with the true parts, then said: 'I can't honestly say breakfast before
brushing causes stomachache.' It wouldn't argue for what it couldn't source."

---

## Part 5. What I learned, and close (4:35–5:00)

**Screen:** homepage.

**Say:** "Three things. The cheapest part of the design, the decoys, decided
how to read the result. The gate's most useful catch wasn't an error; it was a
reasonable-sounding guess. And no unsupported claim reached the participant.
Whether this persuades better than a page of facts, one noisy participant
can't tell us, but the system is built to find out honestly. Code, data and
case study are linked below."

---

**After recording**
- Trim the sourcing wait in Part 3.
- Add captions if the tool offers them.
- Put the video link in the submission, next to the live site, the repo and
  the case study.
