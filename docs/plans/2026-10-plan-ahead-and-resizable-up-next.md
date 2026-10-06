# Panel brief: Plan ahead, and a resizable Up next

Two requests from Mel, 6 Oct 2026 (evening). They're briefed together and can be approved separately.

**Mel's answers (6 Oct 2026, evening), built the same evening:**
| # | Mel said | Built as |
|---|---|---|
| 1 | Yes: drag Up next's corner | A handle at Up next's bottom corner (the side away from the screen's edge): snaps to the grid, stops at neighbours, Undo; double-click → its usual size; arrow keys on the handle |
| 2 | Build both, mind the lifecycle | Up next resizing and Plan ahead both built now, with the lifecycle table below. Close the day stays roadmap step 7 and will end with "Plan tomorrow →" |
| 3 | "Do both" (keep order *and* times), plus a reorder button in Up next | A day locked in ahead keeps its order and times; on the morning, if a block now runs into a meeting, a toast says so and offers Re-plan (`clashes`). **↕ Reorder** in Up next: today's blocks as a list to drag (or ↑ ↓, Alt+↑/↓); they're re-planned in that order over the same stretch of the day (not "from now": in the evening that would empty the day), with Undo and a "n no longer fits" note |
| 3b | Double-click Plan my day → a view of the week, click the day to plan | Replaces the day switcher: the week (Mon–Sun, ‹ › for other weeks, "Also planned ahead" for later days); past days open in the Archive; at work the file opens today's page (the week would show personal days) |
| 4 | To-do.txt: + on hover at the right of each section header, add at the bottom after setting priority and time | The title bar's + went. Each section header shows + on hover; the add row sits under the section (text, priority, time; Enter adds and stays open for the next; Esc closes); empty sections show so they can be added to; Undo, and on a locked-in day "Place it" opens the draft day |

---

# Part 1. Up next you can resize

**Request (as the problem):** Up next is the wrong size for how Mel uses it, and the only way to change it (⋯ or right-click → Small / Medium / Large) either isn't findable or the three sizes don't fit.
**Lane:** Small · **Seats:** Chair, Experience designer, Frontend engineer, Test lead
**Gate:** worth it. It's the desk's most-used widget. It does go against a Living preference ("widgets come in Small / Medium / Large, not free resizing"), so Mel decides (question 1).
**Today, outside Hanua:** on a Mac, widgets come only in fixed sizes, but windows resize from a corner. Up next is more like a window, because it's a tall list you read.

## Verdict
Go. Up next gets a corner handle like To-do.txt has. Dragging it snaps to the desk's 16px grid and stops at the nearest neighbour, so nothing overlaps and nothing else moves (the same rule as dropping). The size is kept with the layout, and Small / Medium / Large stay in ⋯ as quick picks and as a way back. Only Up next gets this. The other widgets keep their three sizes.

| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Experience designer | go | Show a visible corner grip on hover, the same as To-do.txt's. A hidden ⋯ menu is probably why this was asked for. Double-clicking the grip goes back to the size it had before |
| 2 | Frontend engineer | go | `layoutShape` in `public/shared/layout.js` keeps only `x, y, size`. It needs `w, h` (as shares of the desk, like x/y, so a different screen keeps the shape). The size is clamped between Small's size and half the desk wide × the full desk height. The Large "third of the screen" stays the default until Mel drags |
| 3 | Test lead | go | Add tests in `test/layout.test.js` for: a custom size surviving `layoutShape`, the clamping, and a resize stopping at a neighbour (overlaps) |

Chair: pass. Under 900px (phones) nothing changes, because the desk isn't arranged there.

## Lifecycle
| Verb | For Up next's custom size |
|---|---|
| Add | Drag the corner |
| See | It's kept with the layout. "Save current layout as default" keeps it too |
| Change | Drag again, or pick S / M / L in ⋯ |
| Remove (+ Undo) | ⋯ → Medium (or any preset) clears it. Reset layout offers Undo, the same as today |
| Bulk / Close out / Record / Day 30 | Not needed: it's one setting kept in this browser |

## Build
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | `w, h` in the layout rules and `sizeOf` honours them, with tests | `public/shared/layout.js`, `test/` | `npm test` passes |
| 2 | Corner grip on Up next: drag, snap, stop at neighbours, save | `public/desk/arrange.js`, `styles.css` | It works at 1440 and 1024. At 375 there's no grip |

No `npm install`, no `.env` changes.

---

# Part 2. Plan my day for another day

**Request (as the problem):** On Tuesday evening Mel can't plan Wednesday. Plan my day only ever shows today, so tasks and meetings for a later day either wait in her head, or they sit in today's list and come back in tomorrow's sweep.
**Lane:** Medium (desk only, but it touches the day's state, the page, the draft day and Up next) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Data steward, Frontend engineer, Test lead
**Gate:** worth it, with one sequencing point. Planning tomorrow is the natural last step of **Close the day** (roadmap step 7, next anyway): "tick, decide on the rest, plan tomorrow". So this should be built as the foundation of step 7, not as a separate feature. Close the day then ends with a "Plan tomorrow →" button.
**Today, outside Hanua:** Mel writes tomorrow's things somewhere else, or keeps them in her head. Hanua's morning sweep partly does this job (unfinished items come forward), but only after the day has passed, never ahead of it.

## Verdict
Reshaped into two pieces that share one change underneath:

1. **A day switcher in Plan my day**: ‹ **Today** › with **Tomorrow** one click away and a date picker for any day ahead. A future day is the same page: focuses, Meetings & events, sections, priority and time, Save & plan, and the draft day using *that day's* calendar from *its* start time. There's no morning sweep and no focus timer on a future day, and the title bar says "Planning Wed 07-Oct". To-do.txt, the timer and the morning auto-open stay on today.
2. **Send to a day**: the bulk bar's **Move to…** gets *Tomorrow* and *A day…*, so a line from today (or the sweep) can be sent ahead. It waits in that day's file and shows there when the day comes, under its own section header and remembering where it came from (`from`).

Under the hood: `public/desk/state.js` holds **today** (what Up next, To-do.txt and the timer use) and separately the **day being planned** (what Plan my day and the draft day edit), each with its own save and its own `rev`. The server already saves any day. Nothing new is stored anywhere else.

## Premortem: it's three weeks later and this failed. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Mel planned Thursday on Tuesday, but on Thursday the plan's times were wrong because a meeting had moved in the calendar | Data steward | A future day's **Lock in keeps the order, not the times**. On the morning, the times are worked out again from the day's start and the calendar *then*. If something no longer fits, Up next says so and offers Re-plan (question 3) |
| 2 | She was editing tomorrow and ticked something thinking it was today | Experience designer | Unmissable: the title bar reads "Planning Wed 07-Oct", the paper gets a faint tint, and **Back to today** sits where the date was. Ticking is off on a future day, because nothing can be done before the day comes |
| 3 | Tuesday's unfinished things showed up in both Wednesday's plan and Wednesday's sweep | Data steward | Sending a line ahead marks it settled in today's file, the same way → Today does now (`settled`), so the sweep never offers it twice. Tested |
| 4 | Pre-planned days piled up, half-filled, and she forgot they existed | Daily-use coach | Days ahead that have anything written show as a small list in the switcher (Wed 7 · Fri 9) and as a dot on those days in Up next's ‹ ›. The Archive stays for past days only |
| 5 | The two-Mac sync saved tomorrow over today, or the other way round | Frontend / Test lead | Each day keeps its own `rev`, and a `hanua:room` change only refreshes the day it names. The two-Mac test script (sync-a / sync-b) gets a step for this |

## What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go, as step 7's foundation | This serves the purpose sentence directly ("on top of my daily … to-dos"). It isn't polish |
| 2 | Sceptic | reshape | Don't build a calendar of future plans. Meetings with a time belong in Apple Calendar (a signpost, not a store), and Up next already reads them. Plan ahead is for *tasks, focuses and the order*. A meeting typed on a future day is fine, but the page suggests "Add to Calendar ↗" for anything more than a week away |
| 3 | Daily-use coach | go | The real habit is the evening before, so make Tomorrow one click and make it the default when the switcher opens after 4 pm. Further ahead is rarer, and a date picker is enough |
| 4 | Experience designer | go | One page with a clear "planning another day" state, not a second window. Up next swiping to that day shows its planned order faintly ("planned: 6 tasks") until the day comes |
| 5 | Data steward | go | Same file per day (`data/room/desk/<day>.json`), already backed up and shared. `startDay` already handles a future day (headers from the last day before it). `leftovers` must not run for a future day. No `DESK_VERSION` bump unless a field is added |
| 6 | Frontend engineer | go, careful | `state.js` is "the only module that assigns" `desk` / `deskDay`, and page.js, draft.js and agenda.js all read them as today. The split must be explicit: `today` for agenda / To-do.txt / timer, `planning` for page / draft. This is the riskiest part. Build it first, with no visible change, and check today still works end to end |
| 7 | Test lead | go | New rules go in `public/shared/desk.js`, with tests: `sendToDay` (settles in the source, adds to the target with `from`), "no sweep on a future day", and future lock recomputing times. Sample server only, never real data |

Passes: Room designer, Backend engineer (the routes already take any day), Privacy (At work rules apply unchanged to the day being planned), Release keeper (routine).

## Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Up next: drag its corner to any size (snapped to the grid, never overlapping), or keep only the three sizes and make them easier to find? | **Drag its corner**, for Up next only. The three sizes stay in ⋯ |
| 2 | Plan ahead: build it now on its own, or as the first part of Close the day (step 7), ending with "Plan tomorrow →"? | **As the first part of Close the day.** Same work, and the evening habit gets one door |
| 3 | When you lock in a future day, should Hanua keep your **order** and work the times out on the morning (from that day's calendar then), or freeze the **times** you saw? | **Keep the order, times on the morning.** Calendars move, but your order is the decision |

## Lifecycle: a day planned ahead
| Verb | For a future day's plan |
|---|---|
| Add | Plan my day → Tomorrow / pick a day. Or send lines ahead from today (Move to… → Tomorrow / A day…), including from the sweep and Close the day |
| See | The switcher lists days ahead that have something written. Up next's ‹ › shows a dot and "planned: n tasks". On the day itself it's simply today's page |
| Change | Everything, the same as today's page (lines, priority, time, order, meetings, sections) until the day comes |
| Remove (+ Undo) | Lines and meetings: × with Undo, as now. A whole day ahead: **Clear this day** (with Undo) empties it. Its file is kept, marked empty, never deleted |
| Bulk | The bulk bar works on a future day: Move to… can move lines back to today, or to another day |
| Close out | When the day arrives it *is* today: the plan opens, the times are worked out again, and the normal sweep and Close the day apply. A day ahead that's later in the past with nothing done goes through the normal sweep |
| Record | Lines keep `added`, plus `from` (the day they were sent from). `plans` records "planned ahead on Tue 06-Oct". Backed up with the rest |
| Day 30 | Most days ahead will be tomorrow. Days further out stay few, and the switcher shows only days with something written. Longer-range plans belong in Goals or the Calendar |

## In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Day switcher (Today / Tomorrow / pick a day) in Plan my day | Recurring tasks: that's step 8, Routines |
| Draft day and Lock in for a future day (order kept, times on the morning) | A week view of plans ahead: only if she plans more than a day ahead often (look at the `plans` records ~early Nov) |
| Move to… → Tomorrow / A day… | Ticking on a future day: nothing can be done yet |
| Up next shows days ahead faintly; dots on ‹ › | Writing future meetings to Apple Calendar: a separate decision (it would write to Calendar) |
| Close the day → "Plan tomorrow →" (if question 2 = yes, built with step 7) | |

## Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Split state: `today` and `planning` days, each with its own load / save / `rev`; no visible change | `public/desk/state.js`, readers in `page.js`, `draft.js`, `agenda.js`, `todotxt.js` | Today works end to end in the sample (plan, lock, tick, sync-a/b) |
| 2 | Rules: `sendToDay`, no sweep ahead, the lock keeps the order, times on the day; with tests | `public/shared/desk.js`, `test/desk.test.js` | `npm test` passes |
| 3 | The day switcher and the "planning another day" state; fixed items from that day's calendar (`ensureApple(day)`) | `public/desk/page.js`, `draft.js`, `styles.css` | Planning Wed from Tue works, and today is untouched |
| 4 | Move to… → Tomorrow / A day… | `page.js` bulk bar | Sent lines show on that day and leave today's sweep |
| 5 | Up next: dots and "planned: n" for days ahead; on the morning, times worked out again and a Re-plan note if needed | `public/desk/agenda.js` | Checked by setting the sample's clock forward |
| 6 | (With step 7) Close the day ends with Plan tomorrow → | later brief | |

No `npm install`, no `.env` changes, no Notion changes.

## Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | Rules in `public/shared/` |
| 2 | Sample server at 1440 / 1024 / 375 | launch config `sample-planner`; never real data |
| 3 | Two Macs: tomorrow edited on A, today on B, with no cross-over | `sync-a` / `sync-b` |
| 4 | What could break: today's save, the sweep, To-do.txt ticking, the morning auto-open, At work | Walk through each in the sample |

## Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | the desk / Plan my day rows (and Up next) |
| 2 | Preferences | the widgets-in-sizes line (Up next resizes freely, if question 1 is yes); the plan-the-day line (plan ahead) |
| 3 | Session Diary | "Panel: Small + Medium; seats that caught something: …" |
| 4 | Roadmap | `docs/plans/2026-10-planner-roadmap.md` step 7 (if question 2 is yes) |
