# Panel brief: planner keys, usual hours, and a Close the day that learns

**Status:** awaiting Mel's yes (15 Oct 2026).

**Request (as the problem):** (A) Plan my day should forgive slips the way a Mac does: ⌘Z (held) steps back, an accidental Tab is easy to take back, and Tab keeps moving forward (subtask → Priority → Time). (B) Mel wants to set her usual day hours herself. (C) Close the day isn't earning its keep: make it quick enough to actually do, while still recording something worth learning from, and have Hanua (and Claude) notice patterns and propose changes so Mel doesn't have to be introspective.
**Lane:** Medium (A, B) + Large-shaped brief for C · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Data steward, Frontend engineer, Test lead, Privacy and safety, Release keeper
**Gate:** A worth it · B **already exists** (Desk Settings → Planner → *Your usual day*), worth a small reshape · C worth it, **evidence first** (below) and in two parts
**Today, outside Hanua:** A: every Mac app has ⌘Z; Hanua's page redraws after most edits, which wipes Safari's own undo, so ⌘Z often does nothing. C: the honest record of a day is being made **the next morning** by the sweep, not in the evening.

## 0. What the evidence says (Mel's real planner days, 6–16 Oct, counts only)

| # | Finding | From |
|---|---|---|
| 1 | Close the day went live 9 Oct; it has been used **once** (15 Oct, 8:08 pm, both lines filled, briefly) in 6 evenings | day files, `closed` |
| 2 | Ticks during the day are rare: 0 ticked on 8, 9, 12, 13, 14 Oct. The truth arrives next morning: on 15 Oct the sweep marked 8 as done and let 12 go | `done`, `settled` |
| 3 | Days were planned and locked in 6–11 Oct; **none since 12 Oct** (lines written: 12, 5, 3) | `blocks`, `locked` |
| 4 | The 7 pm "message" only shows if Hanua is on screen and awake at that moment, so most evenings nothing reaches Mel | `public/desk/close.js` `tick` |
| 5 | Usual hours are already in Desk Settings, but they only apply to **new** days ("today's are on the page"), so a change looks like it did nothing | `public/desk/settings.js`, `startDay` |

The headline isn't "Close the day needs more questions". It's: **the evening is the wrong moment to ask Mel for effort, and the facts we want are mostly already in the files.** Hanua can learn a lot without asking.

## 1. Verdict

**A — Go.** ⌘Z / ⇧⌘Z in Plan my day with Hanua's own history (typing, Tab, priority, time, ticks, moves, removals), held ⌘Z keeps stepping back. Backspace straight after a Tab undoes that Tab wherever the caret is. Tab on a line that can't go further in moves on to its Priority, then Time.
**B — Small reshape.** Keep the setting where it is; when Mel changes her usual hours, **today follows too** if today still has the old usual hours (Undo in the toast). Plus a quiet **Make these my usual** link beside My day when today's hours differ.
**C — Reshape, in two releases.** C1: a **30-second close** (one tap per open task, already suggested; three tap-chips instead of two typed lines; the morning sweep counts as a late close) and **day facts recorded silently**. C2: **Hanua notices** (rules, no Claude) in the weekly review and week view, and a **weekly Claude read** of the planner that writes proposals to Hanua OS for the next build session.

## 2. Premortem

| # | Three weeks later it failed. Why? | Seat | What this brief does |
|---|---|---|---|
| 1 | Close the day still asked for thought at 8 pm, so it was skipped | Daily-use coach | Suggestions pre-filled; one "Looks right → Close" tap; chips not prose; ≤30 s |
| 2 | The reminder never reached Mel (Hanua not on screen) | Experience designer | Reminder becomes a macOS notification from the server (works when Hanua is in the background); still one a day, off in Settings |
| 3 | Missed evenings meant missing data, so the insights were thin | Data steward | The morning sweep stamps `closed: { at, late: true }`; facts are computed from what's already saved, not from the close |
| 4 | ⌘Z undid something unexpected (the other Mac's change, or a whole paragraph) | Frontend engineer | History is this window only, cleared when the other Mac's version is taken; typing is grouped by pauses, like a Mac |
| 5 | Insights became a dashboard nobody opened | Sceptic | They appear where Mel already goes (the weekly review's last step, the week view), at most 3 lines, each with one action |

## 3. What the panel said

| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Serves the purpose's "on top of daily to-dos". C is the planner's longevity work (roadmap step 10 Patterns) pulled forward small, on evidence |
| 2 | Sceptic | reshape | Usual hours already exist: show Mel, don't rebuild. Don't add questions to an evening ritual that's at 1 in 6 — subtract |
| 3 | Daily-use coach | reshape | The real habit is the morning sweep. Make the close optional and fast, and let the sweep finish its job when it's skipped |
| 4 | Experience designer | go | Mac rules: ⌘Z steps back one change at a time, holding repeats; ⇧⌘Z redoes; typing undoes in word-sized chunks, not letter by letter. Tab that "does nothing but toast" is a dead key: move forward instead |
| 5 | Data steward | go | No new home for data: chips and `late` join the day file (`DESK_VERSION` 9, fixture of v8). Facts are derived (`dayFacts`), never stored twice. Claude's weekly note goes to Hanua OS (the project brain), not to Mel's books |
| 6 | Frontend engineer | go | History = snapshots at each `save()` of the page's day (sections, meetings, focus, order), max 100, memory only; ⌘Z restores, saves, redraws, refocuses the same line. `subKeys` Tab: when `indentLine` refuses, focus `.pl-pri` |
| 7 | Test lead | go | Rules tested: `historyStep` (grouping), Tab fallback, `dayFacts`, `weekFacts`, `suggestions`, the sweep's late close, v8 → v9 fixture. Preview: ⌘Z ten times after a mixed session returns the page exactly |
| 8 | Privacy and safety | go, with a must | At work, chips and facts of personal sections stay hidden; the weekly Claude read sends task text to Claude (Mel agreed 6 Oct 2026) but the note it writes uses **counts and themes, never task text** (the repo is public; Hanua OS isn't, but keep it clean) |
| 9 | Release keeper | go | Two releases: A+B+C1 now; C2 after a week of C1 facts. Settings change → `SETTINGS_VERSION` 4 |

Passes: Room designer (nothing new drawn), Backend engineer (beyond the notification route), guests.

## 4. Questions for Mel

| # | Question | Recommendation |
|---|---|---|
| 1 | Tab on a line that can't be indented (already a subtask, or the first task): move on to Priority, then Time? | **Yes, for every line** (one rule is easier to remember than "only subtasks"). ⌥Tab keeps working too |
| 2 | Close the day's two typed lines → three tap rows (**Day:** 🙂 / 😐 / 😩; **Got in the way:** Meetings ran over · Interruptions · Low energy · Plan too big · Waiting on someone · Nothing; **one line, optional**)? | **Yes.** Countable, under 10 seconds, and the optional line keeps the good stuff |
| 3 | Who proposes enhancements? | **Both:** Hanua's own rules in the weekly review (no Claude, instant) **and** a Sunday-evening Claude read on the Mac mini that writes a short "Usage notes" row in Hanua OS, which the next build session reads first and turns into proposals for you |

## 4b. Lifecycle

| Verb | For a day's close record (`closed`) and the Usage notes |
|---|---|
| Add | Close the day (evening), or the morning sweep stamps a late close; ad hoc: close any past unclosed day from the archive |
| See | Week view card "Closed ✓ / late"; archive shows chips and the line; weekly review's last step shows the week's facts; Usage notes in Hanua OS |
| Change | Open again (`reopenDay`, keeps chips); chips editable while open |
| Remove | Open again clears `at`, keeps the record of chips until re-closed; Usage notes are Notion rows (trash, never erased) |
| Bulk | All to tomorrow / Let all go (kept); "Looks right → Close" accepts every suggestion |
| Close out | The day file is the archive; nothing extra |
| Record | `closed { at, late, mood, blockers[], line }` in the day file (iCloud + nightly backup); facts derived on read |
| Day 30 | 30 days → weekly review shows trends (closed rate, top blocker, carried 3+); nothing piles up on the desk |

For ⌘Z history: Add (every save), See (none needed), Remove (cleared on day switch / "Use theirs"), Day 30 (memory only, 100 steps).

## 5. In and out

| In this change | Deliberately not (and what would earn it) |
|---|---|
| A: ⌘Z / ⇧⌘Z in Plan my day; Backspace after Tab; Tab → Priority → Time | ⌘Z in To-do.txt, Up next, Settings (they have Undo toasts; earn: Mel reaching for it there) |
| B: today follows a changed usual; Make these my usual | A second hours setting in Hanua Settings (desk settings live on the desk) |
| C1: suggested choices, one-tap close, chips, late close by the sweep, macOS notification, `dayFacts` | More reflection questions (evidence says fewer) |
| C2: `weekFacts` + up to 3 suggestions in the weekly review and week view; weekly Claude read → Hanua OS Usage notes | Claude writing to Mel's books or her day files (blocking 2); auto-scheduling tasks onto days without her tap |

**Suggestions C2 starts with (rules, each with one button):** a task carried 3+ times → *Pick a day / Split it / Let it go*; the same task written in 3 different weeks → *Make it a routine* (feeds roadmap step 8); planned minutes over the day's free time 3 days running → *Your days fit about N h of tasks*; "Plan too big" chosen twice in a week → the draft day warns earlier; no plan for 3 working days → nothing nags, just counted (and noted for Claude's read).

## 6. Build plan, in dependency order

| # | Step | Files | Done when |
|---|---|---|---|
| 1 | History rule (snapshot, group typing by ~1 s pauses or a new line) | `public/shared/desk.js` `historyStep` + test | tested |
| 2 | ⌘Z / ⇧⌘Z in Plan my day, held repeats; cleared on day switch and "Use theirs" | `public/desk/page.js`, `state.js` | 10 mixed edits undo and redo exactly |
| 3 | Backspace straight after Tab undoes it; Tab → Priority when indent refused | `page.js` `subKeys`, `lineKeyAction` + test | keys in preview |
| 4 | Usual hours: today follows if untouched; Make these my usual | `settings.js`, `page.js` | toast with Undo |
| 5 | `dayFacts`, close record v9 (`late`, `mood`, `blockers`, `line`; old `well`/`hard` read as the line), fixture v8 | `shared/desk.js`, `test/fixtures` | fixtures open the same |
| 6 | Close window v2: suggested choices, Looks right → Close, chips | `public/desk/close.js` | under 30 s by measure |
| 7 | Sweep stamps a late close; week view "late" | `desk/sweep.js`, `week.js` | tested |
| 8 | Reminder as a macOS notification (server, once a day, off in Settings) | `server/routes/desk.js`, `settings` | fires with Hanua hidden |
| — | *Release 1* | | |
| 9 | `weekFacts`, `suggestions` + weekly review / week view | `shared/desk.js`, `goals/review.js`, `week.js` | tested |
| 10 | Sunday Claude read (scheduled task on the Mac mini) → Hanua OS Usage notes | scheduled task, Notion | first note written |

Needs `npm install`? no. New `.env` value? no. Notion: a **Usage notes** database under Hanua OS (Claude makes it with Mel's yes; it's Claude's own, the integration needn't see it).

## 7. Test plan

| # | Check | How |
|---|---|---|
| 1 | `npm run check` (incl. `npm test`) | every release |
| 2 | New tests: history grouping, Tab fallback, dayFacts / weekFacts / suggestions, late close, v8 → v9 fixture | `npm test` |
| 3 | Sample server at 1440 / 1024 / 375, at home and At work | `sample-work`; never real Notion |
| 4 | What could break: subtasks Tab/Enter/Backspace, H/M/L picks, bulk bar, sweep, Close Undo, the other Mac's Use theirs / Keep mine | preview, `test/two-macs.test.js` |

## 8. Close-out

| # | Record | What to update |
|---|---|---|
| 1 | Map | Plan my day, Close the day, Desk Settings |
| 2 | Session Diary | "Panel: Medium/Large; seats that caught something: Sceptic (usual hours exist), Daily-use coach (the sweep is the real close), Experience designer (reminder never seen)" |
| 3 | Learning Log | Evidence: the evening ritual was used 1 in 6; the morning sweep is where days really get closed |
| 4 | Preferences | Plan my day keys; Close the day is quick and optional |
