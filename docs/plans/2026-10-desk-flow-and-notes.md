# Panel brief: the desk opens where you are, notes on the wall, a draft day to arrange (parts D–G)

**Request (as the problem):** after the first changes (parts A–C), the desk doesn't remember the state of the day (every reload means Plan my day → To-do.txt by hand, and the To-do.txt file was taken away), To-do.txt repeats Up next, windows can't be put away, the focuses and reminders aren't in sight, the notes and menu slip can't be moved, things can overlap, and Save & plan decides the order of the day without Mel. Plus the step 4 items from the roadmap.
**Lane:** Large (the planning flow, the desk's layout, a second use of Reminders); seats inline · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Test lead
**Gate:** worth it: every item comes from using it this morning. The Sceptic notes one reversal: the To-do.txt file comes back (it was removed on her earlier note 18g; with no file there was no way back in).
**Today, outside Hanua:** a Mac's desktop: windows minimise to the Dock, icons and widgets keep to a grid, things open where you left them.

## 1. Verdict
Go, in four releases: **D** the desk remembers the day (opens the right window, minimise to the dock, To-do.txt as a plain list, the timer as a timer, Today's plan widget cut) → **E** notes on the wall (focuses and reminders as post-its, everything on one grid that can't overlap, Save layout as default) → **F** the draft day (Save & plan shows the proposed day to reorder before it's locked in; add a task from the desktop the same way) → **G** the rest of step 4 (multi-select and H / M / L, Undo on the sweep and a cleared line, Move to…, delete a meeting row, meetings from Up next).

## 2. Premortem
| # | Three weeks on, it failed because… | Seat | What this brief does |
|---|---|---|---|
| 1 | Hanua opened a window she didn't want every time she looked at the desk | Daily-use coach | Only once per morning (first visit to the desk that day), and only the one that fits: planned and locked in → To-do.txt; started but not locked in → Plan my day; nothing yet → nothing. After that, windows stay as she leaves them |
| 2 | The grid made notes and widgets jump about when one was dropped | Room designer | A drop goes to the nearest free grid spot; nothing else moves (a Mac's own rule) |
| 3 | The draft day was another screen to get through every morning | Daily-use coach | It opens already sorted (High → Low, quick first within each); "Lock it in" is one click if it looks right |
| 4 | Reminders on the wall went stale (done on the phone, still on the wall) | Data steward | The post-its are read from Reminders each time the desk shows; ticking one ticks it in Reminders |
| 5 | A minimised window was lost | Experience designer | It sits in the dock beside Stickies until restored; it's remembered across reloads |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | D first (it's what bit today), then E, F, G |
| 2 | Sceptic | reshape | Today's plan widget goes (Mel), and the focus post-its replace it. The timer keeps Focus / Break, as a tap on its label |
| 3 | Daily-use coach | go | Sort "quick first within a priority" is a known way to build momentum; Mel can always drag |
| 4 | Experience designer | go | The draft day: the order list on the left (drag), the day as it would run on the right, updating as she drags; "Didn't fit" visible under it; Lock it in / Back to editing |
| 5 | Room designer | go | One grid for the whole desk (files, widgets, notes, the menu slip); focus post-its top right under the files |
| 6 | Data steward | go | Default layout and open windows are view preferences: this browser. The day's plan gets a state: draft or locked (in the day's file) |
| 7 | Frontend engineer | go | Plan my day is a dialog; minimising hides it and keeps its contents; windows share one window helper (drag, resize, minimise) |
| 8 | Test lead | go | Tests: auto-open rule, quick-first ordering, nearest-free-spot on the grid, plan state |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | In the draft day, drag the **order** (Hanua fits them round your meetings in that order, the day updating as you drag), or drag blocks onto **exact times**? | Order: quicker, and the buffers and breaks stay right. Exact times later if you miss them |
| 2 | Which reminders go on the wall as post-its? | Open ones due today or overdue, from your usual list; tick one to complete it |
| 3 | "Save current layout as default": every time Hanua opens, the desk goes back to it (moves during the day are for that day only). And Reset layout returns to your default. Right? | Yes |

## 4b. Lifecycle
| Verb | Windows | Post-its (focus, reminder, yours) | The day's plan |
|---|---|---|---|
| Add | files, Save & plan | focuses from Plan my day; reminders from Add reminder (or the phone); yours from Stickies | Save & plan → draft; + Add task from To-do.txt |
| See | open, or minimised in the dock | the wall, on the grid | draft day; Up next once locked |
| Change | move, resize | move (grid); edit yours | drag the order; Back to editing |
| Remove | close (red), minimise (yellow) | tick a reminder; take yours down (Undo) | Re-plan replaces it (earlier plans kept, step 3) |
| Close out | — | focus notes change with the day | Close the day (step 7) |
| Record | — | — | every plan kept with its state |
| Day 30 | same | reminders only while open | — |

## 5. In and out
| In | Deliberately not |
|---|---|
| D: auto-open once a morning; open windows and minimised ones remembered; minimise to the dock; To-do.txt file back, plain list (no times); timer as a timer (tap to start / pause, reset and bell icons); Today's plan widget cut | |
| E: focus post-its (top right), reminder post-its, stickies and the menu slip movable; one grid, no overlaps; Save current layout as default | |
| F: Save & plan opens the draft day (High → Low, quick first), drag to reorder, Lock it in; + Add task in To-do.txt (text, priority, time, section) placed the same way | Exact-time dragging (question 1) |
| G: multi-select + H / M / L, Tab to Time; Undo for the sweep and a cleared line; Move to…; delete a meeting row; add / move meetings from Up next | |

## 6. Build order
| # | Release | Main files |
|---|---|---|
| D | the desk remembers the day | `public/desk/window.js` (new: drag, resize, minimise, remember), `todotxt.js`, `timer.js`, `planner.js`, `page.js`, `index.html` |
| E | notes on the wall, one grid | `public/shared/layout.js` (free spot, tested), `arrange.js`, `lists.js`, `app.js` notes |
| F | the draft day | `public/shared/desk.js` (order, plan state, tested), `page.js`, new `desk/draft.js` |
| G | step 4 | `page.js`, `agenda.js` |

Needs `npm install`? No. New `.env` value? No.

## 7. Test plan
`npm test` for the new rules; `sample-work` at 1440 / 1024 / 375; check Up next, the sweep, at-work view, and that a minimised Plan my day keeps what was typed.

## 8. Close-out
Map (desk row), Preferences (the desk keeps to a grid; windows minimise; the day is locked in after a draft), Session Diary with the Panel line.
