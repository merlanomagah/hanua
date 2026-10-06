# Panel brief: To-do.txt tidy, the desk's notes, Up next and a record player widget

**Request (as the problem):** after real use, To-do.txt gets cluttered (finished tasks mixed in, the date scrolls away, the add form takes room) and some desk things don't pull their weight (reminder post-its, cut-off focus notes, a small Up next, music only in the dock).
**Lane:** Medium · **Seats:** Chair, Sceptic, Daily-use coach, Experience, Room designer, Frontend, Test lead, Privacy, Release keeper
**Gate:** worth it (notes from use of a Being-tested part; one cut). **Approved by Mel 6 Oct 2026, all three recommendations.**

## Mel's answers
| # | Question | Answer |
|---|---|---|
| 1 | Completed starts closed or open? | Closed ("Completed (4)"), remembered for today if opened |
| 2 | Up next a third of the screen always, or as its Large? | Its Large, and Large is the default, at the right, full height |
| 3 | Fold sections in Plan my day too? | To-do.txt only for now |

## What was built (all on the desk)
| # | Part | Files |
|---|---|---|
| 1 | Reminder post-its cut (page, `/api/reminders/due`, `getDueReminders`); Shopping list and Add reminder stay | `desk/wallnotes.js`, `index.html`, `styles.css`, `server/index.js`, `server/calendar.js` |
| 2 | Focus post-its: a 3×5 card's shape, one size for all three, type steps down to 13px then the cards grow (≤3×) so every word shows (`fitFocus`) | `desk/wallnotes.js`, `styles.css` |
| 3 | To-do.txt: a header that never scrolls (day, date, time, "n to go"); + at the right of the title bar opens Add a task under the header (Esc closes); each section folds (triangle at the right, "n left" when folded); ticked lines go to Completed at the foot, with Undo; unticking there sends a line back; folds kept for today only (`todo-txt-folds`) | `desk/todotxt.js`, `styles.css` |
| 4 | Up next: Large = a third of the **screen** wide (the desk is narrower, beside the bookcase; at most half the desk) and the desk's full height, at the right; the default on screens 1200px+; Small on smaller ones (as before). Placed first so the rest arranges round it; the dock centres in the space left (`--dock-room`). One-time move of saved layouts and the saved default (`desk-layout-v2`): Up next to the right, anything in its way to just left of it at the same height. Hanua's own layout: Up next, then the files' column, then weather / timer / record player (Small) | `shared/layout.js` (`sizeName`, `THIRD`, tested), `desk/arrange.js`, `styles.css` |
| 5 | Record player widget (`#w-records`, `desk/records.js`): the flat-lay turntable, the record spins while music plays, song under it, ⏮ ⏯ ⏭; clicking the deck opens the crate. Drawn from the same state as the wall's card (`hanua:music` from `renderMusic`). Removed from the dock | `desk/records.js`, `app.js`, `planner.js`, `index.html`, `styles.css` |
| 6 | The desk re-arranges whenever something on it changes size (ResizeObserver), so late-drawing items never grow into a neighbour; the meal slip is no longer squeezed when arranged on mid-size screens | `desk/arrange.js`, `styles.css` |

## Known limit
At 1024 × 768 the desk (744 × 722 beside the bookcase) is too full for everything without overlap: the grid's fallback lets the last item overlap rather than vanish. Fine at 1440. Sizes (⋯) or fewer stickies make room.

## Tests
`npm test` (99 pass; new: Up next's sizes). Preview `sample-work`, measured by script at 1440 / 1024 / 375 (pane hidden): To-do.txt tick → Completed → Undo, fold, + / Esc; three focus cards one size, text in full; no overlaps at 1440 (fresh layout and migrated layout); no sideways scroll at 375.
