# Panel brief: the planning desk, and a tidier wall

*Hanua Panel, 5 Oct 2026 (evening). Mel's ten requests after restarting. This brief also replaces the parked daily-planner brief (`docs/plans/2026-10-daily-planner.md`) where the two disagree.*

**Request (as the problem):** the wall feels cramped (clocks, greeting and shelf too tight; the Ask box takes a row of its own; the calendar's header is lopsided), waking Hanua takes an extra step, getting to the desk is a scroll, and the desk is decoration rather than the place Mel plans her day.
**Lane:** Large · **Seats:** all core seats + guests Bula voice and Agile coach (Data steward, Frontend engineer and Test lead ran as separate agents)
**Gate:** worth it. The desk is Context priority 3 (Daily planner) and the parked brief's condition is partly met (Land role in Sydney has 4 PBIs and 14 Tasks). Items 1–8 are polish on parts Mel uses every day; cheap and reversible. Touch ID straight away is **probe it**: whether Safari allows it without a tap can only be learned by trying.
**Today, outside Hanua:** Mel plans in the Bula Daily Planner way (three priorities, today's one thing, a brain dump), on paper or in her head; agendas live in Notion. The paper habit gives her a fixed shape every morning. The notebook keeps that shape.

## 1. Verdict
**Go, reshaped slightly.** The wall tweaks go in as asked. The desk becomes its own pane you slide to (like the kitchen and goals), with one seamless oak top, a notebook on the left drawn so typing sits exactly on its lines, and an iPad lying flat with the day's agenda that swipes between days. The notebook's data has one home each: Focus areas, Key tasks and General jottings live on this Mac per day (like the menu); the Work list *is* the Work book in Notion, and goal Tasks due today keep showing there to tick.

## 2. Premortem
Three weeks later this failed, or Mel stopped using it. Why?
| # | Why it failed | Seat that owns it | What this brief does about it |
|---|---|---|---|
| 1 | Typed text floated between the lines and it looked cheap, so Mel stopped typing | Room designer, Frontend | Lines are drawn by the same measure that sets each row's height, so text sits on them by construction; checked in Safari at three widths |
| 2 | Two lists of the same tasks (notebook and Work book drifted apart) | Data steward | Work list reads the Work book; a new Work line becomes a Work book row (Enter, with Undo). No local copy |
| 3 | Yesterday's unfinished jottings piled up into a guilt list | Daily-use coach | Carried items show once, faintly, with "today" or "let it go"; focus areas never carry, they show yesterday's faintly as a hint |
| 4 | The desk slide fought the kitchen swipe and the scroll, and felt broken | Frontend, Test lead | One pane rule (wall or kitchen, then desk); every order of switching tested; phones keep scrolling |
| 5 | Bula's product copy ended up in the public GitHub repo | Privacy and safety | The prompt lines under each heading are read from a Notion page, like Our tastes; plain headings if it isn't connected |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Ten asks, one brief; build in batches (wall → lock → rail → desk pane → notebook → iPad) so each can be checked |
| 2 | Sceptic | reshape | The day window's agenda and the iPad would show the same thing twice; the iPad shows events only for today (tasks are in the notebook) |
| 3 | Daily-use coach | go | It fits the morning; carry-over needs a way out (today / let it go), never a red count |
| 4 | Experience designer | go | Desk slide needs a way back (flick up, home button, Esc); the iPad swipes with a trackpad, a finger, and ‹ › for keyboard |
| 5 | Room designer | go | Seamless desk: `desk.png` sized once to cover, no repeat. iPad Pro 13" is 28 × 21.5 cm, beside a 21 × 15 cm notebook: the iPad is a little larger than the pad. Plant on the record player shelf at real scale (30 cm beside a 45 cm player). Clock gap halved |
| 6 | Data steward | reshape | One home per item (see Verdict); Work list never a local file; the day file holds only Focus, Key tasks and General |
| 7 | Frontend engineer | go | Move the top rail out of the room so it spans the screen and the bookcase sits under it; Ask's answer drops down from the rail; desk as a pane copies the kitchen's swap |
| 8 | Backend engineer | go | `/api/desk/:day` like `/api/menu/:week`; a create route for Work book rows; prompts read from Notion like `/api/menu/tastes` |
| 9 | Test lead | go | Rules in `public/shared/desk.js` with tests first: day keys, shaping, carry-over, day stepping across month/year ends, 29 Feb and daylight saving, what shows at work |
| 10 | Privacy and safety | reshape | At work: only the Work list and Work agenda; Focus, Key tasks and General covered. Bula copy stays out of the repo |
| 11 | Bula voice (guest) | go | Clear headings first; a quiet Bula prompt under each (e.g. "Three things. That's the cord."), never above it |
| 12 | Agile coach (guest) | go | Key tasks = today's sprint of three; pick from goal Tasks or type |

Passed: Release keeper (standard close-out).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | The date in the calendar's bottom-left: just the "MONDAY 5 OCTOBER" heading, or the whole list of today's items under the month? | **The whole list.** The iPad on the desk now shows the day, and clicking any day still opens its window. The calendar ends at the month's squares, so the books can overlap freely |
| 2 | Work list: typing a line and pressing Enter adds it to your Work book in Notion straight away (with Undo), the same way + works in the Backlog. OK? | **Yes.** One home for work tasks; Enter is the confirm, Undo is the safety net |
| 3 | The Bula prompt lines under the headings: keep them in a Notion page Hanua reads (so Bula's product copy isn't in the public repo), or write them into the code? | **Notion page** ("Hanua planner prompts" on the Hanua page, connected to the integration). Until it's connected, the headings show alone |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Clocks lifted to the status pills' line, gap halved; greeting centred on the lamp and the shelf | Moving the status pills |
| Plant and can beside the record player, plant bigger, vine along that shelf | |
| Touch ID asked as soon as Hanua sleeps, falling back to the first key press if Safari wants a tap | Removing the PIN |
| Top rail across the whole screen, bookcase underneath it, Ask + mic in the rail; coin icon out if crowded (earnings stay; the tin still opens the shop) | Ask on phones stays on the wall |
| Calendar: month centred, year small under it, arrows at the sides; bottom-left date removed (Q1) | |
| Desk as a pane: one slide down and back | On phones (under 900px) the page keeps scrolling |
| Seamless desk; receipt, pencil, clips gone; the sticky pad, cup, lamp and meal slip stay | The weekly spend receipt (the TV keeps money) |
| Notebook: Focus (3), Key tasks (3), General and Work to-dos with ticks, lines drawn to fit the text | A "One small beautiful thing" line (add if Mel wants it) |
| iPad agenda, swipe or ‹ › between days | Editing events on the iPad (opens the day window instead) |
| | Planned-for dates on goal Tasks (the parked idea): key tasks are typed or picked for now |

## 6. Build plan, in dependency order
| # | Step | Files / Notion | Done when |
|---|---|---|---|
| 1 | Wall tweaks: clocks, greeting, plant/can, calendar head, bottom date | `index.html`, `styles.css`, `app.js` renderCalendar, `plant.js` | Measured by script at 1440/1024/375 |
| 2 | Touch ID straight away | `lock.js` sleep / touchWake | Fails quietly to the PIN in Chromium; Mel checks Safari |
| 3 | Top rail spans the screen; Ask + mic in it | `index.html`, `styles.css`, `app.js` ask, `bird.js` coin perch | One line at 1024; no sideways scroll |
| 4 | Rules + tests | `public/shared/desk.js`, `test/desk.test.js` | `npm test` passes |
| 5 | Day file route; Work book create route; prompts route | `server/index.js`, `server/notion.js` | Sample server answers |
| 6 | Desk as a pane | `app.js` (lookDown → showDesk), `kitchen.js`, `goals/board.js`, `styles.css` | Every switching order works |
| 7 | Seamless desk; removals | `styles.css`, `index.html`, `app.js` renderWeek | |
| 8 | Notebook | `app.js` renderTodo → renderPlanner, new notepad image without lines | Text on the lines at every width |
| 9 | iPad agenda | `app.js` (day list shared with the day window) | Swipes across month ends |

Needs `npm install`? no. New `.env` value? no. Notion: (Q3) a "Hanua planner prompts" page connected to the Hanua integration. A new image: the notepad without printed lines (made from `notepad.png`).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | new `desk.test.js` plus the existing tests |
| 2 | Sample server at 1440 / 1024 / 375, lights on and off, At work on and off | `.claude/launch.json` → `sample`; never real Notion |
| 3 | Lock: opens asleep, PIN works, a failed Touch ID falls back without a loop | preview |
| 4 | Ticking a goal Task in the notebook still gives coins, "how big did it feel", Undo, and updates the top rail | preview |
| 5 | Canary perches, calendar zoom, kitchen and goals swipes, meal slip | preview |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Clock and greeting; Books and record player shelf; Plant; Top shelf; Calendar; Today's list → Daily planner (Unknown → Being tested); Agenda; Week receipt (cut); Sleep screen |
| 2 | Cascade | New planner page in Notion → integration connection |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences / cut list / image library | The desk is a planner; receipt, pencil, clips cut; notepad without lines added |
