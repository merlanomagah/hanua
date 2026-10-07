# Panel brief: subtasks (one level) in the planner

**Mel's answers (8 Oct 2026):** yes / yes / yes: together with Foundations F4 (F4's part first); Tab always indents and ⌥Tab reaches Priority and Time; all subtasks ticked → the task ticks itself. **Start next session.**

**Request (as the problem):** some tasks are really a few steps. Mel wants to put the steps under the task (Tab on a line indents it under the task above) and fold them away when she doesn't need to see them, so the list stays short and the steps stay together.
**Lane:** Large (it changes the shape of every day file) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward (agent), Frontend engineer (agent), Test lead (agent), Privacy and safety, Release keeper
**Gate:** worth it. It serves the planner priority and Mel's real days (her 6 Oct page had an "Apartment Walkthrough Prep" section of 14 lines that were really steps of a few tasks). Scope and design only; no build until Mel says.
**Today, outside Hanua:** Apple Reminders and Notes do this: Tab indents, Shift+Tab outdents, a triangle folds. The goals Backlog in Hanua already works the same way (Tab / Shift+Tab, one level at a time), so it's a habit she has.

## 1. Verdict
**Go, reshaped and sequenced.** One level of subtasks in Plan my day (any day) and To-do.txt. Each subtask records **which task it's under** (its id), never just "indented", so nothing can be silently re-grouped by a move. A task with subtasks becomes a **heading**: its subtasks are what get planned, ticked and counted. Folding is a view choice on each Mac. Because this changes the day file's shape, it goes **together with Foundations F4** (the next step on the roadmap, which also changes the shape and the same functions): one version bump, one set of tests, one short window where the Macs must both update.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Moving or sending a task left its subtasks behind, or attached them to the wrong task | Data steward | Subtasks store their parent's id; every move / send / sweep / remove rule carries the family and is tested with a "no orphans" check after each step; three existing bugs fixed on the way (below) |
| 2 | Tab stopped reaching Priority and Time, so she couldn't set them quickly | Frontend engineer | ⌥Tab (the Mac's own "next item" key) reaches the picks; H / M / L still pick there; bulk bar unchanged |
| 3 | A task and its steps were planned twice, so the day looked full | Test lead | A task with open subtasks isn't planned itself; each subtask is (a blank priority borrows the parent's); counts in the week view count only real tasks |
| 4 | The other Mac, not yet updated, quietly flattened or dropped subtasks | Data steward, Test lead | An older Hanua shows them as ordinary lines (nothing lost) and can't save over the newer file until it updates (already the rule); release with both Macs on |
| 5 | Folding hid things she then forgot | Daily-use coach | A folded task shows "2 of 3 left"; folds last for today only |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go, after F4 | Same functions, same version bump as F4: do them as one, not twice |
| 2 | Sceptic | reshape | One level only (as asked); no subtasks of subtasks; phone indenting parked |
| 3 | Daily-use coach | go | Folding must show progress ("2 of 3"), and a finished family should tidy itself away like a ticked task does |
| 4 | Experience designer | go | Lifecycle below; Mac-like keys; ↑ ↓ skip folded rows; Enter on a subtask makes the next row a subtask; Backspace on an empty subtask outdents it |
| 5 | Room designer | go | Subtasks indent about one tick's width; the ruled lines don't move; the fold chip sits right of the text, before Priority ("1 of 3 ▾") |
| 6 | Data steward (agent) | go | Store `parent: id` on the line, keep the list flat (every ref, block and sweep key stays valid); deskShape repairs any bad link by making it an ordinary line, never by dropping it; three real bugs: moving fills the first blank row (would scatter a family), sending re-numbers a clashing id without telling its subtasks, sending un-ticks done lines |
| 7 | Frontend engineer (agent) | reshape | Tab always indents (not "only at the start of a line"); ⌥Tab to the picks; an indented empty row is remembered until typed on; finding a line by its position on screen must become finding it by id (folded rows aren't drawn); ~2 sessions |
| 8 | Test lead (agent) | reshape: after F4 | Fixtures of old day files first (each must open exactly the same after); the remove/clear/undo code in the page moves into tested shared rules; a "no orphans" check after every rule, plus a short random test |
| 9 | Privacy and safety | pass | All in Hanua's own day files; At work shows Work sections only, as now |
| 10 | Release keeper | go | DESK_VERSION 6 with F4; both Macs update together (they do within 5 minutes); no npm install, no .env change |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Build it together with Foundations F4 (next on the roadmap, same files, one version change), or on its own first? | **Together with F4**, F4's part first; about two sessions in all |
| 2 | Tab always indents (Reminders, Notes, the goals Backlog), and **⌥Tab** moves to Priority and Time? | **Yes** |
| 3 | When every subtask is ticked, should the task tick itself (and move to Completed in To-do.txt)? | **Yes**: one tick on any subtask undoes it |

## 4b. Lifecycle (a subtask)
| Verb | Answer |
|---|---|
| Add | Tab on a line in Plan my day (under the nearest task above); Enter on a subtask makes the next a subtask; in To-do.txt, hover a task → **+** adds a subtask under it; the bulk bar gets Indent / Outdent |
| See | Indented under its task in Plan my day, To-do.txt, the sweep ("Task › step"), Up next ("step · Task"), the draft day ("under Task") |
| Change | Edit as any line; Shift+Tab outdents; its own priority and time (blank priority borrows the task's) |
| Remove (+ Undo) | × on a subtask removes it; × on a task removes it and its subtasks ("and 3 subtasks"); one Undo brings all back |
| Bulk | Picking a task includes its subtasks for Move, Send, Clear, Done; not for priority or time |
| Close out | Ticking a task ticks its open subtasks (one Undo); all subtasks ticked → the task is done; sending or sweeping a task carries its open subtasks, ticked ones stay on the day they were done; a subtask sent alone arrives as an ordinary task |
| Record | `parent` in the day file with the usual added / done times; backed up nightly; F4's origin ids keep "carried N times" true for subtasks too |
| Day 30 | Folds are today-only, so nothing stays hidden; a task with many old steps shows "n of m" |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| One level; Tab / Shift+Tab; ⌥Tab to the picks; fold with "n of m"; ticking rules; planning by subtask; carry / send / sweep / remove keep families; To-do.txt shows and adds them; bulk Indent / Outdent | Deeper nesting (earned if one level keeps feeling too shallow) |
| | Indenting on a phone (no Tab key; parked until she plans from the phone) |
| | Subtasks in the goals board (it has its own levels) |

## 6. Build plan (with F4)
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Fixtures of every old day-file version, saved as today opens them | `test/fixtures/`, `test/desk.test.js` | Each opens identically after every later step |
| 2 | F4: origin ids, markers instead of deleting when sending / clearing | `public/shared/desk.js` | F4's tests |
| 3 | `parent` in deskShape + the repair rule; DESK_VERSION 6 | `shared/desk.js` | Repair and round-trip tests |
| 4 | Family-aware rules: move, send (fix re-numbering and un-ticking), sweep, remove, clear, tick, indent / outdent; page code stops filtering lines itself | `shared/desk.js`, `page.js`, `todotxt.js` | "No orphans" + "same texts" after every rule; random test |
| 5 | Plan my day: Tab / ⌥Tab, fold chip, indented rows, lines found by id | `page.js`, `styles.css` | Preview, twice in a row, Safari keys checked by Mel |
| 6 | To-do.txt, draft day, Up next, week counts, archive | `todotxt.js`, `draft.js`, `agenda.js` | Preview at 1440 / 1024 / 375 |
| 7 | Exit check, release with both Macs on, close-out | | §7 |

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | Old files open unchanged; v6 round trip; a v6 file read the old way keeps every line in place | `npm test` (fixtures) |
| 2 | Every moving / removing rule keeps families whole; a full section takes all or nothing | `npm test` |
| 3 | A newer file is refused by an older Hanua and left untouched | `npm test` on a temp folder |
| 4 | Tab / Shift+Tab twice in a row; fold; send a task twice; sweep a task with a ticked step | Preview (sample only) |
| 5 | Two servers on one sample folder, one on old main: subtasks show flat there, its save is refused with the Restart message | `sync-a` / `sync-b` |
| 6 | ⌥Tab and Tab in Safari | Mel |

## 8. Close-out
Map (Daily planner), Session Diary with the Panel line, Preferences (Plan the day row: subtasks), Learning Log if the "store the link, not the position" lesson holds, CLAUDE.md.
