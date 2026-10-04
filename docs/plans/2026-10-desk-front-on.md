# Panel brief: a front-on desk with a MacBook, a lighter rail, music by the record player

*Hanua Panel, 5 Oct 2026 (late evening). Follows `2026-10-desk-planner-and-wall.md`; where they differ, this one wins.*

**Request (as the problem):** the rail feels crowded; the plant and the music controls are in the wrong places; the slide to the desk doesn't feel like the kitchen's; and the flat-lay desk doesn't read as a desk in the same room. Mel wants the room seen front-on: bricks coming down to an oak desk, a MacBook Pro whose screen is the planner, the agenda on a ruled sheet pinned to the wall, the lamp on the desk.
**Lane:** Large · **Seats:** core seats; Frontend engineer and Test lead ran as separate agents; Data steward in one pass (no data changes: same day files, same Notion)
**Gate:** worth it. It reshapes a part built an hour ago, before any real use, which is cheap now and would be costly later. Nothing stored changes.

## 1. Verdict
**Go, in five steps:** calendar ✕ → rail → shelves and music card → the slide → the front-on desk. The notebook's data, rules and tests stay exactly as they are; only where they're drawn changes.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Removing rail icons crashed the page at load (code still looked for the buttons) | Test lead, Frontend | Every listener on a removed button is deleted or guarded in the same step; the console is checked |
| 2 | Goals, kitchen, library or the Feed became hard to find | Experience designer | They keep their other ways in: GOALS / KITCHEN edge tabs and swipes, the bookcase's library button, ⌘S, the record player, To the desk |
| 3 | The slide still felt like a jump | Frontend | The wall starts exactly where it is on screen (no scroll jump), both panes move the same distance with the kitchen's curve, no fade |
| 4 | The MacBook screen was too small to plan on | Room designer | A 14" MacBook Pro at real scale against a 45 cm lamp: the screen is the biggest object on the desk; the planner fills it |
| 5 | The music card lost its styles or text when it moved | Frontend | Its styles move with it, a fixed narrower width, the title ends in … and shows whole on hover |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Build in five steps, each checked |
| 2 | Sceptic | go | The rail's removed icons all have another way in, so nothing is lost |
| 3 | Experience designer | go | Esc while typing on the laptop must not leave the desk; leaving the desk puts focus back on To the desk |
| 4 | Room designer | go | Front-on: bricks continue, the oak top is a band with a front edge and shadow; laptop centred-left, lamp right (taller than the laptop screen), pinned sheet above the laptop; lights off dims the room but the laptop screen keeps a soft glow |
| 5 | Data steward | pass | Same day files, same Work book path, same 5-minute wait |
| 6 | Frontend engineer | go | Earnings · Ask · home/lock/focus as a 1fr auto 1fr grid so Ask is truly centred; music card beside the record player; the slide uses a fixed starting point then one transform |
| 7 | Test lead | go | Guard removed buttons; check the canary's perches (coin, laptop lid, the sheet's pin); typing, Enter, Esc and the agenda's arrow keys don't fight |
| 8 | Privacy and safety | go | At work only Work on the laptop; the sheet keeps "Busy" for other events |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | The laptop screen: ruled lines like paper, or a clean app with faint row lines? | **Clean app, faint row lines.** Text still sits in the middle of each row; ruled paper is now the agenda sheet on the wall |
| 2 | The cup, the sticky pad and today's meal slip: where do they go? | **Cup on the desk left of the laptop; meal slip pinned on the wall beside the agenda sheet; sticky pad cut** |

## 5. In and out
| In | Not (and what would earn it) |
|---|---|
| Calendar zoom ✕ in the top-right corner | |
| Plant and can on the books' shelf; music controls as a glass card by the record player; even gap between the two shelves | |
| Rail: earnings left, Ask centred, home, lock (sleep) and the home/work switch right; other icons removed | The ▾ earnings panel stays |
| The slide reworked to match the kitchen's | |
| Front-on desk: bricks, oak desk top, MacBook Pro screen = the planner, agenda on a pinned ruled sheet (swipe days), lamp on the desk right | The notebook picture and the iPad (cut) |
| Phones: laptop screen and sheet full width, still one scrolling page | |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Calendar ✕ | `app.js` renderCalendar, `styles.css` | Top-right while zoomed |
| 2 | Rail and guards | `index.html`, `styles.css`, `app.js`, `kitchen.js`, `planner.js`, `shelf.js`, `bird.js` | No console errors; Ask centred within 2px |
| 3 | Shelves, music card | `index.html`, `styles.css`, `app.js` renderMusic | Vine and drop right; card within 40px of the player |
| 4 | The slide | `planner.js` showDesk, `styles.css` | No jump when scrolled down; same curve as the kitchen |
| 5 | Front-on desk | `index.html`, `styles.css`, `planner.js` | 1440 / 1024 / 375, lights off, At work |

Needs `npm install`? no. New `.env`? no. Notion: nothing new.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | desk rules unchanged |
| 2 | Sample preview at 1440 / 1024 / 375, lights off, At work | measured by script |
| 3 | Every way in: goals, kitchen, library, Feed, desk, music | triggered by script |
| 4 | Typing, Enter, Backspace, Esc while typing, the 5-minute Work send | sample server |
| 5 | Canary perches, Touch ID and ⌃L | preview |

## 8. Close-out
Map: Top shelf, Ask Claude bar, Wall calendar, Plant, Record player, Desk objects, Daily planner, Agenda. Preferences: the desk is seen front-on; the rail is light. Cut list: rail icons, notebook picture, iPad, sticky pad (if Q2 agreed). Diary with the Panel line.
