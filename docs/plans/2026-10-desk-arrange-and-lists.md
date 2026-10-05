# Panel brief: a roomier desk you can arrange, a shopping list and reminders, and faster planning (roadmap steps 4 and 5)

**Request (as the problem):** after a real morning with it (6 Oct), the planner and the desk feel cramped (narrow columns, an empty middle), the desk can't be arranged the way Mel works, To-do.txt loses the sections she planned in, and two everyday jottings have no home: a running shopping list and a quick reminder. Steps 4 (faster marking, Undo) and 5 (desktop and Up next) from the roadmap touch the same code, so they're planned together.
**Lane:** Large (a new data source, Apple Reminders; the desktop's layout; three areas). The Data steward, Frontend engineer and Test lead seats were run inline this time, not as separate agents, to keep it quick; their checklists were followed. · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Backend engineer, Test lead, Privacy and safety
**Gate:** worth it. Every item comes from using it, on the part Mel uses daily (priority 3). The Sceptic's note: this is a lot at once, so it's built and released in four parts (section 6), each usable on its own.
**Today, outside Hanua:** shopping and reminders: to confirm (question 1). Arranging: macOS's own desktop and widgets (drag anywhere; widgets come in set sizes).

## 1. Verdict
Go, in four releases: **A** room to breathe (spacing, To-do.txt with section headers), **B** arrange and resize the desk, **C** Shopping list and Add reminder, **D** faster planning (step 4) and two-way meetings (step 5).

## 2. Premortem
| # | Three weeks on, it failed because… | Seat | What this brief does |
|---|---|---|---|
| 1 | After moving things around, a widget ended up off-screen at a different window size, or it all got messy | Room designer | Positions kept as a share of the desk (not pixels), always pulled back on screen; files snap to a grid; **Reset layout** puts everything back |
| 2 | Dragging fought with clicking: a double-click to open a file started a drag, swiping Up next moved the widget | Frontend engineer | A drag only starts after the pointer moves 5px; widgets move by their title strip (Up next's swipe stays inside it); keyboard: arrow keys move a selected file |
| 3 | The shopping list was on the Mac, but she was at the shop with her phone | Daily-use coach | Recommend Apple Reminders (question 1): the same list on her iPhone, Siri can add to it, shareable |
| 4 | Reminders quietly didn't work because macOS permission was never given | Backend engineer | Same pattern as the calendar helper: a one-time macOS prompt, and a clear note in the window if it's off (says so out loud) |
| 5 | Wider windows broke the 1024 and phone layouts | Test lead | Every release checked at 1440 / 1024 / 375; phones keep one scrolling page (no dragging there) |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Four releases in this order: spacing helps every morning at once; arranging next (Mel asked twice: 18f and today); lists; then planning speed |
| 2 | Sceptic | reshape | Widgets get **sizes** (Small / Medium / Large, like a Mac's), not free resizing; windows (Plan my day, To-do.txt, Shopping list) resize freely from a corner. Fewer odd shapes to design for |
| 3 | Daily-use coach | go | The shopping list must be where the shopping happens (phone). "Add reminder" is a file you double-click: a small window, what and when, done in five seconds |
| 4 | Experience designer | go | To-do.txt gets the section headers (General, Spark NZ, …) in plan order; the planner page uses up to ~1400px with wider columns; Up next shows titles on one line with times aligned |
| 5 | Room designer | go | Default layout redrawn with the space: widgets column wider (≈360px), To-do.txt ≈520px; files stay top right, in a grid |
| 6 | Data steward | go if question 1 is A | Shopping and reminders belong in Apple Reminders (their home on Mel's phone); Hanua shows and adds, never keeps a copy. Desk layout is a view preference: this browser's storage is right for it |
| 7 | Backend engineer | go | Extend the existing EventKit helper (`scripts/calendar.swift`) with reminders: list a list's open items, add, complete. Read-only by default; adding and ticking are Mel's own actions |
| 8 | Test lead | go | Tests for layout maths (fractions, clamping, snapping) in `public/shared/`; the helper never runs in tests (`APPLE_CAL=0` already) |
| 9 | Privacy and safety | go | Shopping and reminders are personal: put away at work, like stickies |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Where should the **shopping list** and **reminders** live? **A:** in Apple Reminders (a "Shopping" list, and your usual list for reminders): on your iPhone at the shop, Siri can add, shareable; Hanua shows and adds to them. **B:** in Hanua only, on this Mac (like stickies) | **A** |
| 2 | **Add reminder**: what + when (Today / Tomorrow / pick a date and time) into Apple Reminders, so your iPhone and Mac remind you at that time. Is that what you meant? | Yes, as described |
| 3 | Arranging: files and widgets drag anywhere (files snap to a grid), widgets in Small / Medium / Large, windows resize from the corner, and a **Reset layout**. OK? | Yes |

## 4b. Lifecycle
| Verb | Desk layout | Shopping list (A) | Reminders (A) | Planner lines (step 4) |
|---|---|---|---|---|
| Add | — | type and Enter in the window; also Siri / phone | Add reminder file | type; Move to… another section |
| See | the desk as left | the window; Reminders on the phone | Reminders app; today's show in Up next (light) | page, sweep, archive |
| Change | drag, resize, size picker | edit text in place | in Reminders (↗ opens it) | text, priority, time; several at once |
| Remove (+ Undo) | Reset layout (with Undo) | tick = bought; Undo | in Reminders | clear a line, with Undo; sweep Remove / Let all go with Undo |
| Bulk | Reset layout | Clear ticked | — | multi-select: priority, time, move, tick |
| Close out | — | ticked ones drop off after the shop (kept in Reminders as completed) | completed in Reminders | Close the day (step 7) |
| Record | — | Reminders keeps completed items | Reminders keeps them | step 3's record |
| Day 30 | same layout, kept per browser | only open items show | Reminders' job | — |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| A: wider planner page, roomier To-do.txt and Up next, section headers in To-do.txt; To-do.txt opens as a window only (no desktop file needed, 18g) | |
| B: drag files and widgets, widget sizes, resizable windows, Reset layout, positions kept in this browser | Free-form widget resizing (sizes cover it); arranging on phones |
| C: Shopping list window and Add reminder file, both on Apple Reminders | Hanua's own copy of either (signpost rule); prices or a budget (Pūtea's job) |
| D: multi-select + H / M / L, Tab to Time; Undo on the sweep and for a cleared line; Move to…; delete a meeting row; meetings added / moved / deleted from Up next too; move a block by hand | Drag-and-drop between sections (Move to… covers it) |

## 6. Build plan, in dependency order
| # | Release | Files | Done when |
|---|---|---|---|
| A | Spacing; To-do.txt headers and window-only | `styles.css`, `desk/todotxt.js`, `index.html` | screenshots at 1440 / 1024 / 375 |
| B | Layout maths (tested) → draggable files and widgets → widget sizes → resizable windows → Reset layout | `public/shared/layout.js` (new, tested), `public/desk/arrange.js` (new), `styles.css` | positions survive a reload and a window resize |
| C | Reminders in the EventKit helper → `/api/reminders` (list, add, complete) → Shopping list window → Add reminder file and window | `scripts/calendar.swift`, `server/calendar.js`, `server/index.js`, `public/desk/lists.js` (new) | Mel's macOS prompt answered once; items match her phone |
| D | Step 4 on the page, then meetings both ways and moving a block in Up next | `public/desk/page.js`, `agenda.js`, `shared/desk.js` | tests; the sweep's Undo works |

Needs `npm install`? No. New `.env` value? Yes for C, if A: `REMINDERS_SHOPPING` (the list's name, default "Shopping") and `REMINDERS_LIST` (default: your default list). macOS will ask once to let "Hanua Calendar" use Reminders.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | layout maths; step 4 rules (multi-select, Undo, Move to) |
| 2 | No test touches Apple Reminders | sample servers set `APPLE_CAL=0`; sample lists instead |
| 3 | Sample server at 1440 / 1024 / 375 | `sample-work` (port 3043) |
| 4 | What could break elsewhere | Up next's swipe, double-click to open, the focus timer, at-work view, the sleep screen over a moved widget |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | the desk row; a new Apple Reminders data source row (Owned by: Apple Reminders) |
| 2 | Cascade | new data source: Map, `.env`, macOS permission |
| 3 | Session Diary | "Panel: Large (seats inline); seats that caught something: …" |
| 4 | Preferences | the desk can be arranged; widgets in sizes; shopping on Reminders |
