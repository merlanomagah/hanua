# Panel brief: Close the day (roadmap step 7)

**Mel's answers (9 Oct 2026):** yes / yes / yes: a let-go task stays on its day struck through; closing with undecided tasks is fine (the morning sweep takes them); the 7 pm reminder is a desk note plus one message, no Mac notification.

**Request (as the problem):** the day has no ending. Unticked tasks just roll into the next morning's sweep, nothing records how the day went, and later steps (the weekly summary, Patterns) have nothing to read about it. Mel wants a closing habit: from 4 pm, tick what's done, decide on the rest, one line on what went well and one on what got in the way, and the day is closed (her answers, 6 Oct: offered from 4 pm, a reminder at 7 pm if not done; the times in Settings).
**Lane:** Large (each day file learns a field; touches Plan my day, To-do.txt, the morning sweep, Desk Settings and the desk's notes) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward (agent), Frontend engineer (agent), Test lead (agent), Privacy and safety, Release keeper
**Gate:** worth it: Mel asked for it, it's the next roadmap step, and the weekly summary (step 9) needs closed days. Whether it becomes a habit can only be learned by using it, so the evidence is named below (§8).
**Today, outside Hanua:** nothing closes the day; what's left is met the next morning by the sweep. That works, but late, and it says nothing about how the day went.

## 1. Verdict
**Go, slightly reshaped.** A small **Close the day** window (like To-do.txt: never a pop-up over everything, never opening by itself). From 4 pm a quiet **Close the day** button appears in To-do.txt's header and Plan my day's day bar; from 7 pm, if the day isn't closed, a desk note says so (and one gentle message, once). In the window: each open task (with its subtasks) to tick, or to send **Tomorrow**, to **A day…**, or **Let go**, or leave for the morning; two optional lines; then **Close the day**, with one Undo for all of it, and **Plan tomorrow →**. One change from the original idea: the morning sweep keeps working by **task**, not by day. A closed day where everything was decided simply has nothing left to offer; but a task added after closing (or on the other Mac) is never hidden just because the day was closed.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | It nagged: a window kept appearing at 4 pm and she started ignoring it | Daily-use coach | Never opens itself; a quiet button from 4 pm; at 7 pm one desk note and one message a day; a blank reminder time turns it off |
| 2 | Closing took longer than the day deserved | Experience designer | Every task can be left undecided (the morning sweep catches it); both lines are optional; one press closes |
| 3 | A task vanished: sent to a full day, or lost when the other Mac saved over the close | Test lead, Data steward | Already fixed today: what doesn't fit stays (0137cff). The other Mac's "Keep mine" warns that the day was closed there; sends skip a task already on that day |
| 4 | "Let go" wiped the record of what was done | Data steward | Let go marks the task as let go on its own day (the sweep's word), it stays there struck through; ticked subtasks keep their ticks |
| 5 | The weekly summary couldn't tell what happened | Data steward | Each decision already has a record (ticked time, where it was sent, let go); the close adds one line: when, and the two lines. "Carried N times" now counts tasks moved with → too |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Step 7 as planned; one Medium-sized window on top of rules that already exist (send, tick, let go) |
| 2 | Sceptic | reshape | Don't hide by "closed": decide by task. No macOS notifications (permission prompts, adds little over the desk note) |
| 3 | Daily-use coach | go | The habit lives at the end of the day: a button that's there when she looks, a note if she forgets, never a pop-up. End with Plan tomorrow → so closing leads somewhere |
| 4 | Experience designer | go | Choose, then close: nothing moves until the one Close button; one Undo; a closed day says "Closed 6:12 pm ✓" with Open again (keeps the two lines) |
| 5 | Room designer | go | A desk window like To-do.txt (dark with the Mac); on phones it sits along the bottom with big choice buttons |
| 6 | Data steward (agent) | reshape (light) | Store only `closed: { at, well, hard }` on the day; decisions use the existing rules (tick, send, the sweep's "let go"); one moment for the whole close; destination first, then today; never close a day ahead; `timesCarried` must count tasks moved with → (they leave the old day) |
| 7 | Frontend engineer (agent) | go | Its own non-modal window (`public/desk/close.js`); the times in a **new** settings group, not inside Desk (an older Hanua on the other Mac would drop them); a minute check for 4 pm / 7 pm; at work, Work sections only |
| 8 | Test lead (agent) | reshape, then go | Found the lost-tasks bug (fixed and released). Tests first: a fixture of today's day files before the version changes, the times with the clock passed in, families through every decision, the other Mac's "Keep mine" |
| 9 | Privacy and safety | go | At work only Work tasks show; the two lines are personal, so the window is put away at work unless it's the work day's own close (the lines aren't shown) |
| 10 | Release keeper | go | `DESK_VERSION` 7 and settings version 3: both Macs must update the same day (they do within 5 minutes; an older Mac refuses to save rather than lose anything). No `npm install`, no `.env` |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | A task you **Let go**: stays on that day struck through as "let go" (a record), or comes off the page? | **Stays, struck through** (the day stays true; the sweep won't offer it again) |
| 2 | Can you close with some tasks still undecided (they wait for the morning sweep)? | **Yes**: closing should take a minute, not be a chore |
| 3 | The 7 pm reminder: a desk note plus one message, or also a Mac notification (asks permission in Safari)? | **Desk note + one message**; no Mac notification for now |

## 4b. Lifecycle (a day's close)
| Verb | Answer |
|---|---|
| Add | The Close the day button (from 4 pm; any time from the window's title bar if she wants it early), or the 7 pm note |
| See | To-do.txt's header "Closed 6:12 pm ✓"; the week view's card says Closed; the archive shows the two lines |
| Change | Open again (keeps the lines), edit, close again; ticking still works after closing |
| Remove (+ Undo) | Undo straight after closing puts everything back (both days); later, Open again; let-go marks undone one at a time |
| Bulk | All to tomorrow / Let all go in the window's foot |
| Close out | Undecided tasks fall to the morning sweep; tomorrow's tasks wait there; Plan tomorrow → |
| Record | `closed.at`, `well`, `hard`; ticked times; `gone` (sent, to where); let go (`settled`); all in the day file, backed up nightly |
| Day 30 | A month of closed days is what the weekly summary (step 9) reads; days never closed simply show no ✓ |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| The window, the 4 pm button, the 7 pm note + one message, Desk Settings times (blank reminder = off), choose-then-close with one Undo, Plan tomorrow →, Open again, at work Work only, closing yesterday after midnight, the "Keep mine" warning, `timesCarried` counting sends | A Mac notification (if the desk note gets missed for a week) |
| | Mood or energy scores (the two lines first; add only if the weekly summary wants a number) |
| | Auto-closing at midnight (closing is Mel's act; the sweep covers forgetting) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Fixture of a v6 day (made up) written with today's code; fixture test grouped by version | `test/fixtures/` | `npm test` |
| 2 | Rules: `closed` in `deskShape`, `DESK_VERSION` 7; `closeDay(d, decisions, now)` / `reopenDay`; `canClose(day, today)`; `closeMoment(now, times, closed)` (offer / remind); let go as the sweep's mark; sends skip a task already there by origin; `timesCarried` counts sends; `daySummary` says closed | `public/shared/desk.js`, tests | Each choice, families, Undo, the clock boundaries (15:59, 16:00, 19:00, 23:59, 00:01) |
| 3 | Settings group `close: { from, remind }`, `SETTINGS_VERSION` 3; Desk Settings times (`timeField`, lean pm) | `public/shared/settings.js`, `public/desk/settings.js` | An older Hanua keeps them |
| 4 | A save of today that can be waited on; the "Keep mine" warning when the other Mac's day is closed | `public/desk/state.js` | Two-Mac test round trip |
| 5 | The window, the buttons, the note and message, a minute check | `public/desk/close.js` (new), `todotxt.js`, `page.js`, `app.js` notes, `index.html`, `styles.css` (dark) | Preview at 1440 / 1024 / 375, twice in a row, lights off |
| 6 | Week card ✓ Closed, archive lines | `week.js`, `archive.js` | Preview |
| 7 | `npm run check`, release with both Macs on, close-out | | §8 |

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | Old days open the same (incl. a v6 fixture) | `npm test` |
| 2 | Each decision keeps families whole, same texts across days, no orphans; Undo; send twice doesn't double | `npm test` |
| 3 | The clock: offer from 4 pm, reminder from 7 pm once, nothing after closing, Mel's own times, blank reminder | `npm test` (clock passed in) |
| 4 | A closed day round trips; an older page or server is refused | `test/routes.test.js` |
| 5 | Two Macs: close on one, the other sees it; a stale save is refused with the closed day as "theirs" | `test/two-macs.test.js` |
| 6 | The window in the preview, with the minute check called at 4:01 and 7:01 pm | Sample preview (hidden pane can't prove the real timer) |
| 7 | Mel in Safari: set the times a few minutes ahead, close a real day, Plan tomorrow →, next morning's sweep | Mel |

## 8. Close-out
Map (Daily planner; Desk Settings), Session Diary with the Panel line, Preferences (the closing habit), CLAUDE.md. **Evidence it helps:** how many of the next 14 days get closed (the week view's ✓); look again ~23 Oct.
