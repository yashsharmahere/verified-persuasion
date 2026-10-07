# Demo video: script

**Format:** a screen recording with voice-over, about 4½ minutes (Loom, OBS
or QuickTime). A face bubble in the corner is optional. Not a whiteboard
video: the point is to show the real system working and where every claim is
logged. The site's own animation and illustrations do the explaining.

**One rule for the whole video:** show receipts, not claims. Every time the
voice says the system did something, the screen shows it happening or shows
where it was logged.

**Before recording**
- Top up the Anthropic credit (a live run costs about ₹20–30).
- Your own test belief must be cleared so you can start fresh (ask Claude).
- Open these tabs in order:
  1. https://canyoubeconvinced.vercel.app
  2. https://canyoubeconvinced.vercel.app/start.html (signed out)
  3. Supabase → Table editor → `beliefs` (the participant's row, `sourcing_log` column)
  4. Supabase → `assertions`, filtered to the participant's run
  5. https://github.com/yashsharmahere/verified-persuasion/blob/main/docs/04-case-study.md
- For the live part, use a **different belief from the participant's**, so
  the demo doesn't touch study data. Good choice: *"Charging my phone
  overnight ruins the battery."*
- Browser zoom at 110–125% so text is readable in the video.

---

### 1. The problem (0:00–0:30)

**Screen:** the brief, section 01.

**Say:** "Research on AI persuasion found something uncomfortable: the
models that changed minds most also made the most things up. More claims
meant more chances to land, and more claims nobody could support. This
project asks whether you can keep the persuasion and drop the made-up part,
by building an AI that may only say what it can prove."

### 2. The idea in 20 seconds (0:30–0:55)

**Screen:** the homepage. Let the example animation play: one claim backed,
one blocked.

**Say:** "Every reply the AI drafts is split into single facts. Each fact is
checked against a quote from a trusted source. 'Older people need fewer
calories' is backed, so it goes through. 'Less salt will *cure* blood
pressure' is blocked, because the source only says *linked*. If a fact can't
be backed, it isn't said."

### 3. What a participant does (0:55–2:30): live

**Screen:** /start.html. Do each step as you speak.

1. **Login.** Click *Continue with Google*.
   **Say:** "Anyone can take part. Logging in is only so they can come back a
   week later on any device."
2. **How this works.** Pause on the four cards, then click *I agree*.
3. **The belief.** Type *"charging my phone overnight ruins the battery"*.
   Show the one-sentence version, then confirm.
   **Say:** "It restates the belief as one sentence they can rate, and it
   turns away political and identity beliefs, and questions about someone's
   own treatment."
4. **Why they believe it.** Answer two or three questions briefly.
   **Say:** "The brief asks why people hold a belief, not why it's wrong. So
   before arguing, it asks: why do you believe this, where did it come from,
   whom do you trust, what would change your mind."
5. **The 0–100 page.** Point at the five statements.
   **Say:** "Their belief is hidden among four unrelated statements, which the
   AI never mentions. If only the belief moves later, that's persuasion. If
   everything moves, it's noise. Remember this; it matters at the end."
6. **Finding the evidence.** Let the checklist run (about a minute; you can
   cut the wait in editing).
   **Say:** "Now it finds sources by itself. An AI searches only a fixed list
   of trusted sites for this topic: here, Apple, Samsung, standards bodies.
   It proposes quotes. Then the server, with no AI involved, downloads each
   page and keeps a quote only if it's there word for word. A made-up or
   reworded quote is thrown out."
7. **The reading page (brochure).** Open it, scroll, rate.
   **Say:** "First they read a fixed page of the same checked quotes. No
   conversation. This is the baseline the chat has to beat."
8. **The chat.** Send one or two messages. Point at the bold source names,
   the highlighted exact quotes, and the source links under each reply.
   **Say:** "Every fact names its source, and the source's exact words are
   highlighted. If it doesn't have a source, it says so."

### 4. The receipts (2:30–3:20)

**Screen:** Supabase, the participant's belief row → `sourcing_log`.

**Say:** "This is the real participant's run. Thirteen quotes were proposed
and eight passed. Mayo Clinic and the CDC refused the download, so their
quotes were dropped, even though they were probably right. No quote is used
unless the server has read it on the page."

**Screen:** Supabase → `assertions` for the participant's conversation.
Point at the blocked row: *"Swallowing saliva and oral microbes happens
whether or not you've brushed."*

**Say:** "Every fact the AI drafted is logged: sent or blocked, and by which
quote. Seven facts were sent, and all seven are backed. This one was blocked.
It sounds reasonable and is probably true, but no source says it. That's the
exact kind of gap-filling that makes persuasive AI inaccurate, and the gate
stopped it."

### 5. The result, honestly (3:20–4:20)

**Screen:** the case study, §3 table.

**Say:** "The participant believed that eating breakfast before brushing
sends mouth germs into your stomach and causes stomach ache. They rated it
100. After the reading page: still 100. After a four-minute conversation:
60."

(pause)

"That looks like a clear win for the conversation. But look at the decoys.
'Cracking your knuckles causes arthritis' went from 0 to 60, and nobody
mentioned knuckles. So we can't honestly credit the drop to the
conversation. This run is inconclusive, and the case study says so. The
seven-day rating comes next."

**Screen:** case study §4, the reversal quote.

**Say:** "We also pointed the AI at the participant's own belief and told it
to argue that it's *true*. It agreed with the true parts, then said: 'I
can't honestly say breakfast before brushing causes stomachache.' It
wouldn't argue for something the sources don't support."

### 6. Close (4:20–4:40)

**Screen:** the homepage.

**Say:** "Zero unsupported claims reached the participant, the gate caught
a plausible-sounding one, and the AI refused to argue for a claim it couldn't
source. Whether it persuades better than a plain page of facts, one noisy
participant can't tell us. The system is built to find out honestly, which
is the point. Code, data and case study are linked below."

---

**After recording**
- Trim the sourcing wait.
- Add captions if the tool offers them.
- Put the video link in the submission, next to the live site, the repo and
  the case study.
- If the day-7 rating has come in, add one line at the end of §5 ("A week
  later: [x]") or record a 10-second addendum.
