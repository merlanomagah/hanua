# Panel brief: Plan my day schedules the day

**Request (as the problem):** Mel lists what has to happen today, but the list doesn't say *when*. She wants Hanua to turn the list plus the day's meetings into a timed plan she can follow, with a clean list to work from and a focus timer.
**Lane:** Large · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Backend engineer, Test lead, Privacy and safety, Release keeper, Agile coach (guest), Bula (guest). Run in one pass by Claude (not as separate agents), to keep it quick.
**Gate:** worth it, smaller. It serves the purpose ("keep Mel on top of her daily to-dos"), but Plan my day was rebuilt this afternoon and hasn't been used for a single morning yet. So: build the plumbing in one go, keep every new field optional, and hold back the extras (coins, Apple Calendar) until the plan has been used.
**Today, outside Hanua:** Mel's work calendar holds the meetings; tasks live in her head or on paper, and the gaps between meetings get eaten by whatever shouts loudest. Time-blocking puts the important things into those gaps on purpose.

## 1. Verdict
**Go, reshaped.** Each to-do line gets two small optional pickers: **Priority** (High / Medium / Low) and **Time** (15m, 30m, 45m, 1h, 1½h, 2h). A **Meetings & events** section (time, how long, what) sits beside the tasks. **Save & plan** fills the gaps between meetings, and anything already in your calendars today, with your three Tasks first, then High, Medium and Low. A little **To-do.txt** window opens with the timed list. The blocks show in **Up next**. A **Focus timer** (pomodoro) sits on the desktop.

## 2. Premortem: three weeks later this failed. Why?
| # | Why it failed | Seat | What this brief does about it |
|---|---|---|---|
| 1 | Filling in priority and time for every line felt like admin, so Mel stopped | Daily-use coach | Both optional. Blank Time counts as 30m and blank Priority as Medium. Pickers are one tap each, and they show only on lines that have text |
| 2 | The plan was wrong by 10 am (a meeting ran over) and was never fixed | Experience designer | **Save & plan** can be pressed again any time: it re-plans from *now*, keeps ticked things ticked, and moves only what's left |
| 3 | Effort points meant two things and the goals' sizing got muddled | Agile coach | The planner uses **minutes**, not story points. Points stay a Goals thing (relative size). An hour is an hour |
| 4 | Ticking planner lines for coins turned into gaming the shop | Agile coach, Sceptic | **No coins for planner lines** (Claude's call, as asked). Coins stay with finished goals, so the treat fund keeps its meaning. Revisit after 2–3 weeks of use |
| 5 | At work the whole planner was hidden, so the schedule was useless where it's needed most | Privacy (blocking 5) | Each section and each meeting gets a **Work** tick. At work only Work items show and get planned; the rest of the day shows as "Busy". At home everything shows |
| 6 | Planned blocks were written into Notion or Apple Calendar and cluttered them | Data steward (blocking 2, 4) | Blocks are **today's plan only**, kept in today's file on this Mac and shown in Up next. Nothing is written to Notion or Apple Calendar. A "send to Calendar" can come later if it's missed |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Data steward | reshape | Each line gets `pri` (h/m/l) and `mins`. Meetings are `{time, mins, title, work}`. Blocks are worked out by a rule, never typed, and saved with the day so Up next and To-do.txt agree. Old files still open |
| 2 | Backend engineer | go | No new server parts beyond saving the bigger day file. Calendar events already reach the page (`calendarItems`) |
| 3 | Frontend engineer | go | A pure, tested rule `planDay(...)` does the scheduling. Starting point: the work day **8:30–5:30**, editable at the top of the window, from now if that's later. 5-minute gaps between blocks. A 10-minute break after about 90 minutes of work. What doesn't fit goes under "Didn't fit today" |
| 4 | Experience designer | go | To-do.txt is a small TextEdit-style window on the desktop (drag it, close it, reopen it from a desktop icon). Each line shows its time, its tick box and its priority dot. Ticking it here ticks it in Plan my day |
| 5 | Room designer | go | The timer is a round widget with a ring that empties: 25 minutes of focus, then a 5-minute break, with Start / Pause / Reset. While it runs, a small countdown shows in the top rail so it's visible from any room. No sound unless you ask (question 3) |
| 6 | Bula (guest) | go | Fits the Bula Daily Planner's rhythm: the focuses guide the plan, and the three Tasks come first |
| 7 | Test lead | go | Tests for `planDay`: gaps around fixed meetings, priority order, Tasks first, re-planning from now, ticked items left alone, overflow, the work day's end, and At work only Work |

Passes: Release keeper (standard push), Backend (beyond row 2).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Effort as **minutes** (15m–2h) rather than the Goals' 1/2/3/5/8/13 points? | **Minutes.** The schedule needs real time, and points in Goals stay clean |
| 2 | Where does the **Focus timer** live: a widget on the desk's desktop, or on the wall (the home view)? | **On the desk's desktop**, beside the plan, with the countdown in the top rail so it follows you anywhere |
| 3 | A sound when a focus session ends? | **A soft chime, on by default, with a mute switch on the widget.** Without sound a finished session is easy to miss |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Priority and Time on lines; Meetings & events; Work ticks; Save & plan; blocks in Up next; To-do.txt; Focus timer | Coins for planner lines (2–3 weeks of use first); writing blocks to Apple Calendar or Notion (if Mel misses them in her phone's calendar); dragging blocks around in Up next (press Save & plan again instead) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Rule `planDay` + day shape (`pri`, `mins`, `work`, meetings, blocks, day start/end) + tests | `public/shared/desk.js`, `test/desk.test.js` | `npm test` passes |
| 2 | Pickers on lines; Meetings & events section; Work ticks; Save & plan | `public/planner.js`, `styles.css` | Saves and plans on the sample server |
| 3 | Blocks in Up next | `public/planner.js` `renderAgenda` | Blocks show between events |
| 4 | To-do.txt window and its desktop icon | `index.html`, `planner.js`, `styles.css` | Ticks agree both ways |
| 5 | Focus timer widget + rail countdown | `index.html`, `planner.js`, `styles.css` | Runs, pauses, resets, survives a reload |
| 6 | At work check; 1440 / 1024 / 375; push; Restart Hanua | | |

No `npm install`. No new `.env` value. No Notion changes.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `planDay` cases (premortem 2, 5) | `npm test` |
| 2 | Sample server: plan a day with 2 meetings and 6 lines, tick one, re-plan | browser |
| 3 | At work: only Work items planned and shown | browser |
| 4 | 1440 / 1024 / 375 | browser |

## 8. Close-out
Map rows (Daily planner, Desk objects, Agenda), Preferences (time-blocking, the timer), Session Diary with the Panel line, CLAUDE.md.
