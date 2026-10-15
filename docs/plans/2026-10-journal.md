# Panel brief: the Journal (a file on the desk)

**Status:** approved by Mel 15 Oct 2026 and built the same evening, reshaped by her answers: (1) she journals in a paper notebook, not regularly, so the Journal is **weekly**: one ruled page a week; (2) Notion; (3) the five fale areas, as **sections on one ruled page**, each with a question to start the thinking, plus Write freely and Carry forward; (4) **Claude may read it**, to help her clear her head and see how she works: **Reflect ✦** reads the week back, on her press only. So Hanua reads the page's words back from Notion (the Data steward's "write once, never read" was for the counts-only answer). Notion: the Journal database and "Hanua journal prompts" page on the Hanua page (Mel connects the Hanua integration to both).

**Request (as the problem):** Mel wants a place to reflect more deeply than Close the day's taps, on specific areas of her life (she named Personal, Family, Work, Relationships), with questions that help her go further, grounded in a Pacific / Bula way of reflecting rather than generic journalling.
**Lane:** Large (a new desk window, a new data home, possibly a Notion database) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward *(independent)*, Frontend engineer *(independent)*, Test lead *(independent)*, Privacy and safety, Release keeper, guest Bula
**Gate:** **Probe it.** Worth it (the purpose's "keep Mel on top of her life", and Close the day evidence: one typed line isn't where reflection fits). But whether a journal gets used can only be learned by using it: smallest reversible version, evidence named, look again ~12 Nov.
**Today, outside Hanua:** not known; asked (question 1 in chat). It decides whether this replaces a habit or starts one.

## 0. What the research says (sources at the end)

| # | Finding | What it means for Hanua |
|---|---|---|
| 1 | Expressive writing helps a little, not a lot; benefits depend on the person, and repeated circling of the same painful details (rumination) can make things worse | Prompts lead to **making sense and a next step**, never "describe it again"; no streaks, no daily pressure |
| 2 | People who reflect a lot can be *less* self-aware when they ask "why"; "what" questions ("what mattered", "what do I need") lead to insight | Every prompt is a **what / who / where** question, never a bare "why" |
| 3 | A gratitude practice once a week helped; three times a week didn't (it became a chore) | The Journal never nags; the weekly review shows what was written, not what wasn't |
| 4 | Bula's own reflection design (Master Copy Library, Weekly Reflection page): questions "a trusted elder would ask", values inside the question, concept names small and after; the "carry forward / put down" loop | Prompts are written in that voice and live in **Notion** (Bula copy never goes in the public repo); each entry can end with *carry forward / put down* |
| 5 | The **Fonofale** model (Samoan-derived, Karl Pulotu-Endemann; used by the Ministry for Pacific Peoples): family is the foundation, culture the roof, posts for spiritual, physical, mental and other; the point is **balance**, no part stands alone | Mel's four areas map onto a fale. Hanua can *show* the balance (which posts got attention this month) without asking her to work it out |
| 6 | Bula's Research & Integrity Standards: only verified concepts; Rotuman concepts are still placeholders; never speak *for* "the Pacific" | Only settled concepts (talanoa, vā, vanua) appear, quietly; Fonofale is named as what it is (Samoan-derived, adapted here); nothing Rotuman until sourced |

## 1. Verdict

**Go, as a probe.** A **Journal** file on the desk opens a window like To-do.txt. Pick an area (or Write freely), one prompt shows (↻ another), write, Save. Past entries are listed underneath, newest first. A small **fale** drawing at the top shows which areas you've written about this month: the posts fill in as you write. Nothing nudges. It's personal: put away at work and asleep, and Claude never reads the words.

## 2. Premortem

| # | Three weeks later it failed. Why? | Seat | What this brief does |
|---|---|---|---|
| 1 | She never opened it: one more file on a busy desk | Daily-use coach | Two doors where reflection already happens: Close the day's "Anything else?" → *Write more in Journal*; the weekly review's last step shows the fale and links in |
| 2 | Prompts felt generic, or the same one kept coming back | Guest Bula | A library in Notion she can edit, several per area, rotating by day; ↻ another; written in Bula's voice, "what" questions |
| 3 | Words were lost (sleep reloaded the page mid-entry) | Frontend engineer | The draft is kept as she types and comes back after a reload; Save is explicit; Undo on save, edit and delete |
| 4 | Something personal showed at work, or reached Claude | Privacy and safety, Data steward, Test lead | Never in the bookcase's list (Ask Claude reads every book); hidden and not even fetched at work or asleep; a release check fails if the journal can reach Claude |
| 5 | It turned into homework or rumination | Sceptic | No streaks, no counts of missed days, short prompts that end in a next step |

## 3. What the panel said

| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go (probe) | A new room on an evidence base of zero use: smallest version, evidence named. The readers disagreed on where entries live: Mel decides (Q2) |
| 2 | Sceptic | reshape | Not a fourth reflection ritual: Close the day = taps, weekly review = goals, Journal = by choice, when there's something to say. Each links to the next, none duplicates |
| 3 | Data steward *(read the code)* | go, Notion | Entries in a **Notion Journal database**: Notion owns them (signpost rule), its trash for delete, on her phone, no iCloud clash copies. Text in the page body only, never a column; Hanua writes once on Save and never reads the words back (edit in Notion) |
| 4 | Frontend engineer *(read the code)* | go, room file | Copy Close the day's window; one `journal.json` in the iCloud room folder like the stickies (works at once, edit in Hanua). Must: draft survives sleep's reload; ⌘S caught (today it opens the Spotlight); personal windows leave the dock and aren't restored at work |
| 5 | Test lead *(read the code)* | reshape (small) | Pick **one** store. The sample-server guard only blocks `/pages` writes: widen it to body blocks first if Notion. New check rule: the journal stays private (not a book, not reachable from Claude, samples "(invented)") |
| 6 | Experience designer | go | Mac-like: ⌘S saves, Esc closes (draft kept), ⌘Z native in the text box; one prompt at a time, area chips, a big calm writing space |
| 7 | Room designer | go | The fale is a small line drawing (posts, roof, floor) in the room's ink and terracotta, not a chart; the file icon is a notebook; dark mode via the existing tokens |
| 8 | Privacy and safety | go, with musts | Blocking 5 (personal at work / asleep) and a new rule: journal words never sent to Claude without Mel's per-entry tick (Q3) |
| 9 | Guest Bula | go | Voice from the Master Copy Library; concept names small, after the prompt; Fonofale credited, adapted not claimed; no Rotuman concepts until sourced (Integrity Standards) |
| 10 | Release keeper | go | One release, after Mel's two Notion steps if Notion (create/connect) |

Checked against the code before this brief: Ask Claude sends every book (`server/routes/books.js` /api/ask), Hanua reloads itself while asleep (`public/updates.js`), the guard matches only `/pages` (`server/notion.js` `changesPage`), ⌘S opens the Spotlight (`public/app.js`).

## 4. Questions for Mel

| # | Question | Recommendation |
|---|---|---|
| 1 | Do you journal anywhere today (paper, Notes, Notion, an app)? | (information: shapes whether this replaces or starts a habit) |
| 2 | Where should entries live? **Notion Journal** (on your phone, Notion's trash and history, edit there; you connect Hanua to it once) or **Hanua's iCloud folder** (works straight away, edit in Hanua, Mac only) | **Notion**: it's where your writing already lives and the signpost rule says so |
| 3 | Areas as a fale: **Family** (the floor), **Self** · **Relationships** · **Work** (the posts), **Spirit & culture** (the roof), plus Write freely? | **Yes**: your four, plus the roof the Fonofale says holds them |
| 4 | Claude and the Journal | **Counts only** (which areas, how often), never the words; a per-entry "Claude may read this" tick can come later if you want reflections back |

## 4b. Lifecycle

| Verb | For a journal entry |
|---|---|
| Add | Journal file (or ⌘J later), from Close the day's *Write more*, from the weekly review; any area or Write freely; ad hoc any day |
| See | The window's list (newest first, by area); Notion (if Notion) on any device |
| Change | Notion: open the entry in Notion. Room file: reopen and edit in place, Undo |
| Remove | Notion's trash (Undo within the hour from Hanua) / room file: marked gone, never erased |
| Bulk | Not needed |
| Close out | None: entries simply accumulate |
| Record | Date, area, the prompt shown, the words (body only), written in Hanua or elsewhere; backed up by Notion (or the nightly room backup) |
| Day 30 | ~5–15 entries; the list filters by area; the fale shows the month's balance; "a month ago today" resurfacing is deliberately later |

## 5. In and out

| In the probe | Deliberately not (and what would earn it) |
|---|---|
| Journal file + window, areas, rotating prompts from Notion, ↻ another, Save with Undo, the list, the fale, carry forward / put down line | Search, tags, mood scores (use earns it) |
| Draft kept through sleep and reload | Voice dictation (the rail's mic exists; add if she asks) |
| Close the day → *Write more*; weekly review shows the fale | Nudges, reminders, streaks (research says no) |
| Counts in Usage notes (areas, entries per week) | Claude reading entries (Q4; a per-entry tick later) |
| Hidden at work and asleep | Work entries at work (Privacy seat to revisit) |

## 6. Build plan (dependency order)

| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Guard first: sample servers refuse `/blocks` writes and database creation; check rule "journal stays private" | `server/notion.js`, `test/notion-guard.test.js`, `scripts/check.js` | tests |
| 2 | Rules: `journalShape`, `promptFor(area, day, skips)`, `journalShown`, `faleOf(entries, month)` | `public/shared/journal.js`, `test/journal.test.js` | tests |
| 3 | Store (Q2): Notion `journal` key in `config/areas.json` (never `areas[]`), create with body, list via a whitelist, trash within the hour — or the room file via `server/room.js` + `ROOM_KINDS` | `server/routes/journal.js` | route round-trips on the sample server |
| 4 | Prompts route from the Notion page "Hanua journal prompts" (all bullets per heading) | `server/routes/journal.js` | sample prompts "(invented)" |
| 5 | Window, file, fale, draft, keys, personal windows out of the dock at work | `public/desk/journal.js`, `window.js`, `planner.js`, `index.html`, `styles.css` | exit check |
| 6 | Doors: Close the day's *Write more*, weekly review's fale | `close.js`, `goals/review.js` | — |
| 7 | Notion: the prompts page (Claude drafts it from the Master Copy Library, Mel edits), the Journal database (if Notion) | Notion | Mel connects Hanua to both |

Needs `npm install`? no. New `.env` value? no. **Mel to do (if Notion):** connect the Hanua integration to the Journal database and the prompts page (••• → Connections → Hanua).

## 7. Test plan

| # | Check | How |
|---|---|---|
| 1 | `npm run check` incl. the new privacy rule | every release |
| 2 | Shape, prompt rotation, at-work / asleep, fale counts | `test/journal.test.js` |
| 3 | Sample server never writes to Notion (incl. body blocks) | `test/notion-guard.test.js` |
| 4 | Not a book: `/api/areas` and Ask never contain journal rows | `test/routes.test.js` |
| 5 | Preview 1440 / 1024 / 375, dark, At work (no journal element, no `/api/journal` request), asleep + reload (draft back) | `sample` preview |
| 6 | Not provable in the preview: real Notion save and trash, real iCloud between Macs, typing feel | said plainly; Mel tries one entry |

## 8. Close-out

Map: new row Journal; Daily planner (the doors); Usage notes (counts). Learning Log if the probe teaches something. Preferences: the Journal row. Evidence: entries per area per week for 4 weeks, written in Hanua vs elsewhere; look ~12 Nov.

## Sources

- Fonofale: Ministry for Pacific Peoples, *Fonofale presentation to Pacific Wellbeing Talanoa* (May 2021); Open Polytechnic, *The Fonofale model of health*; Springboard Trust summary.
- Expressive writing: Frattaroli (2006) meta-analysis; Smyth (1998); German Medical Science review (2006) on modest effects and rumination.
- Gratitude frequency: Lyubomirsky, Sheldon & Schkade (2005), as described by Lyubomirsky (Time, Slate).
- "What" not "why": Tasha Eurich, *Insight* (2017), via TED Ideas.
- Bula Collective (Notion): Product Design Principles; Master Copy Library; Cultural Storytelling Strategy; Research & Integrity Standards; Cultural Research Log.
