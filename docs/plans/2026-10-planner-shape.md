# Panel brief: the planner page's new shape (roadmap step 3)

**Status:** approved by Mel 6 Oct 2026 (A, Jump issues is Work, day N in the sweep only) and built the same day. One change from the brief: with the Tasks gone, Meetings & events sit beside the focuses (not full width under them), which is what brings General up.

**Request (as the problem):** the page carries a part Mel never uses (Tasks to complete), times are minutes rather than words she thinks in, the sections she needs every day have to be made by hand, and nothing records *when* things happened, so later insight (step 9–10) has nothing to read.
**Lane:** Medium (one room, its own saved files; no Notion) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Data steward, Frontend engineer, Test lead, guest Jump
**Gate:** worth it. Mel's own requests from her first real planning session (6 Oct), on a part she's actually using (priority 3, the daily planner). The "a week of use before more features" pattern was raised: these refine what she used, they don't add rooms, and Record is plumbing that can't be backfilled.
**Today, outside Hanua:** the Bula Daily Planner on paper: focuses, then lists by area. Today in Hanua she wrote 3 focuses, General (3), Apartment Walkthrough Prep (14), Spark NZ marked Work (8); Tasks to complete empty; almost every line 15m.

## 1. Verdict
Go, as one change to how a day is saved (version 3), so old days are converted once and the page, sweep, To-do.txt, Up next and the widget all move together.

## 2. Premortem
| # | Three weeks on, it failed because… | Seat | What this brief does |
|---|---|---|---|
| 1 | 5 Oct's Tasks vanished from the archive, or the sweep asked about them again | Data steward | Old Tasks become the first General lines **keeping their ids `k0`–`k2`**, so the sweep's "already dealt with" marks still match. Tested |
| 2 | A tab or server on the old version dropped the new fields | Test lead | `DESK_VERSION` → 3: mismatched saves are refused and said out loud (built in step 1) |
| 3 | Labels like "Half hour (30m)" made each line's picks wide and lines cramped, worst at 375px | Experience designer | The closed pick shows the word only ("Quick"); the list shows "Quick (10m)". Checked at 1440 / 1024 / 375 |
| 4 | Empty sections piled up: every new day copied yesterday's headers, including an unnamed empty one (already happening: today has one) | Daily-use coach | A new day carries the fixed sections and only those of hers that had something written |
| 5 | Timestamps were recorded but nothing ever read them | Chair | Accepted: they're for Close the day (step 7), the weekly summary (9) and Patterns (10), and can't be added later |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | One version bump for all four; order: shape + migration (shared, tested) → page → sweep / To-do.txt / Up next / widget |
| 2 | Sceptic | reshape | Fixed sections come from `config/areas.json` for now (`planner.fixedSections`); Settings (step 6) edits them later. No new UI to manage them yet |
| 3 | Daily-use coach | go | Your real lines were all 15m, so the label set must include 15 (question 1). "Day 3" on carried tasks goes in the sweep only, never as a red count on the page |
| 4 | Experience designer | go | Fixed sections have no × and a fixed name (a small lock-free look, just no ×). General moves to the top left where Tasks were; focuses keep the full width above |
| 5 | Data steward | go | Days stay on this Mac (no other home; backed up since step 1). New fields: each line's `added` and `doneAt`, `from` (first day) on carried lines, `plans` (each Save & plan kept, newest 10), `settledAt` |
| 6 | Frontend engineer | go | `key` / `keyWork` / `k0` refs leave `state.js` `refInfo`, `planEntries`, To-do.txt, the widget and `openItems`; `planDay` drops "Tasks first" (High already goes first) |
| 7 | Test lead | go | Tests for: conversion of old days, the sweep after conversion, fixed sections made and adopted by name (your existing "Spark NZ" keeps its id and lines), empty sections not carried, timestamps, plan history cap, version 3 |
| 8 | Guest Jump | go | "Jump issues" holds Mel's own jottings, not Jump OS data; marked Work so it shows at work (question 2) |

Passes: none.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Time labels. Your lines today were almost all 15m. Which set? **A:** Quick (10m) · Short (15m) · Half hour (30m) · Solid (45m) · Hour (1h) · Big (2h). **B:** the same with Short at 20m (your existing 15m lines would then show as Short (20m)) | **A**: it matches how you actually estimated today (four to an hour) |
| 2 | Is **Jump issues** a Work section (shows at work, like Spark NZ)? | Yes |
| 3 | Carried tasks: show "day 3" only in the morning sweep, or also faintly on the line? | Sweep only for now; Patterns (step 10) will show what keeps rolling over |

## 4b. Lifecycle
| Verb | For lines, sections and plans |
|---|---|
| Add | Type on any line, any time (ad hoc is the normal case); fixed sections appear by themselves each day; your own with + Add a section |
| See | Today's page; earlier days in the Archive; unfinished ones in the morning sweep (with their first day) |
| Change | Text, priority, time in place. **Gap:** moving a line to another section → step 4 (multi-select gets "Move to…") |
| Remove | Clear a line's text; × on your own empty sections. Fixed sections can't be removed (renamed in Settings, step 6). **Gap:** no Undo for a cleared line beyond ⌘Z while typing → step 4 with the sweep's Undo |
| Bulk | Step 4 (multi-select, H / M / L) |
| Close out | Step 7 (Close the day); until then the morning sweep |
| Record | **This step:** when each line was added and ticked, where a carried line started, every plan kept, when sweep decisions were made. Backed up nightly |
| Day 30 | ~30 small files; sections no longer pile up; the sweep still looks back only 7 days |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Tasks to complete removed (old days converted, still readable) | A replacement "top 3": the High priority lens does it |
| Time labels with minutes in brackets; meeting lengths keep plain times (15m … 2h) | Typed minutes |
| Fixed sections General, Spark NZ, Jump issues from config | Editing them in Hanua (Settings, step 6) |
| Recording: `added`, `doneAt`, `from`, `plans`, `settledAt` | Showing any of it beyond the sweep's "day N" (steps 7, 9, 10) |
| New days carry only sections with something written, plus fixed ones | |

## 6. Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Shape v3: convert `key` → General lines `k0`–`k2`; `TIME_PICKS` + labels; `MEETING_PICKS`; `fixedSections` ensured and adopted by name; `startDay` carries only used + fixed sections; `stampLine`; `plans`; `from`; `settledAt`; `openItems` / `planDay` without Tasks; `DESK_VERSION` 3 | `public/shared/desk.js`, `test/desk.test.js` | `npm test` green |
| 2 | Server passes `fixedSections` to the shape | `server/index.js`, `config/areas.json` | today's file gains the fixed sections |
| 3 | Page: no Tasks; General top left; fixed sections without ×; label picks; stamps on type and tick; Save & plan keeps history | `public/desk/page.js`, `public/styles.css` | sample at 1440 / 1024 / 375 |
| 4 | Sweep "since Mon · day 3"; bring-forward keeps `from`; To-do.txt, Up next, widget without Tasks | `page.js`, `todotxt.js`, `agenda.js`, `state.js` | ticking anywhere still ticks everywhere |
| 5 | Archive shows converted days | `page.js` | 5 Oct reads right |

Needs `npm install`? No. New `.env` value? No. Notion changes? None.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | conversion, sweep after conversion, fixed sections, carrying, stamps, plan cap, labels |
| 2 | Mel's real 5 and 6 Oct files open correctly | read through the new `deskShape` in a test script (no writes) |
| 3 | Sample server at 1440 / 1024 / 375 | `sample-planner` (port 3041), never the real Notion |
| 4 | What could break elsewhere | Up next blocks, To-do.txt ticks, Today's plan widget, at-work view (Work sections only), the version check |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | the desk / Plan my day row |
| 2 | Cascade | a new config key: `planner.fixedSections` (Settings will own it in step 6) |
| 3 | Session Diary | "Panel: Medium; seats that caught something: …" |
| 4 | Preferences / cut list | Tasks to complete cut (6 Oct 2026, Mel never used it) |
