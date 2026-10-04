# Panel brief: a desktop monitor with "Plan my day", sticky notes, the agenda at the right

*Hanua Panel, 5 Oct 2026 (night). Follows `2026-10-desk-front-on.md`; where they differ, this one wins.*

**Request (as the problem):** the laptop didn't feel right. Mel wants a big desk monitor showing a real-looking desktop, where a "Plan my day" folder opens a large landscape planner; sticky notes on and around the monitor, with a way to add new ones to the wall; the agenda as lined paper at the right above the lamp; and no shadow at the wall/desk crease.
**Lane:** Large · **Seats:** core seats; Data steward and Frontend engineer as separate agents
**Gate:** worth it. It keeps the planner's data and rules as they are and gives it more room (a landscape overlay instead of a small screen). Sticky notes are new data: see Q1.

## 1. Verdict
**Go.** The monitor is drawn in code like the TV (a stand, a bezel, a desktop with wallpaper and folder icons). "Plan my day" opens the planner as a large landscape window (a dialog: Esc or ✕ closes it), two columns: Focus and Key tasks | General and Work. Same files, same 5-minute Work send, same tests. Sticky notes stay on this Mac in one file and stay up until taken down (with Undo).

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Double-click felt fiddly, or did nothing on touch or keyboard | Experience designer | Folders are real buttons: double-click, Enter/Space, or a single tap on touch |
| 2 | Typing in the planner window jumped or lost the cursor | Frontend | The planner keeps its id and code; only where it shows changes |
| 3 | Sticky notes piled up | Daily-use coach | Capped at 12; take one down with Undo |
| 4 | Esc closed the window and slid the desk away too | Test lead | Esc closes only the window while it's open |
| 5 | Personal stickies showed at work | Privacy and safety | Covered at work, like General |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Data steward | pass | Notes typed on the desk live nowhere else, so a Mac file is right (like the planner's jottings); not a copy. The old cut was about browser-only notes. Taken-down notes are marked, not erased |
| 2 | Frontend engineer | go | Move the existing planner into a dialog rather than building a second one; folder icons as buttons; reuse the TV's look under a new name |
| 3 | Room designer | go | A 27" monitor (61 cm) beside a 45 cm lamp is close to real scale for once; stickies 7.6 cm square on the bezel and wall |
| 4 | Sceptic | go | Other folders open things that already exist (Goals, Kitchen, Library, Feed): no new features, and the rail's removed icons get a home |
| 5 | Privacy and safety | go | Stickies and the planner's personal sections covered at work |

Passed: Backend (one small file route), Release keeper.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | New sticky notes stay on this Mac (not Notion) and stay up until you take them down. OK? | **Yes.** Quick to jot; a note that becomes a real task can go in the Work line or the Feed |
| 2 | More folders on the desktop besides "Plan my day": Goals, Kitchen, Library, Feed, each opening what already exists? | **Yes.** It gives the icons cut from the rail a home |
| 3 | Where the stickies sit | **The first three on the monitor's bezel corners, the rest on the wall around the monitor; "+ note" on the bezel adds one** |

## 5. Build plan
| # | Step | Files |
|---|---|---|
| 1 | Planner into a dialog; open/close | `index.html`, `planner.js`, `styles.css` |
| 2 | Monitor and desktop folders; laptop and crease shadow out | `index.html`, `styles.css`, `planner.js` |
| 3 | Agenda at the right above the lamp | `styles.css` |
| 4 | Sticky notes: rule + test, `/api/stickies`, the notes | `public/shared/desk.js`, `test/desk.test.js`, `server/index.js`, `planner.js` |
| 5 | Canary perches, lights off, 1440 / 1024 / 375, At work | `bird.js`, `styles.css` |

No `npm install`, no `.env`, nothing new in Notion.
