# Panel brief: the wall rearranged, a typed menu with tips, a calendar that zooms

**Request (as the problem):** the wall's top is uneven and the notes are out of sight; drawing meals is fiddly; Mel wants to learn to eat well while planning; the calendar's squares are too small to read; Epic dates clutter the calendar.
**Lane:** Large · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward (agent), Frontend engineer (agent), Test lead (agent), Privacy and safety, Release keeper; guest Agile coach (#6)
**Gate:** worth it. #3 smaller (tips and soft checks in the room plus a short Notion guide; no Claude meal ideas yet). #6 smaller (a level rule; the tick only if it turns out to be needed).
**Today, outside Hanua:** the menu is a 1-day-old probe; Mel's own first report ("drawing is finicky") is its first evidence, so this reshapes the probe rather than building on top of it.

## 1. Verdict
Reshaped, go. Built in two parts so nothing is built twice: **Part A** rearranges the wall, turns the menu into typed meals with tips, and takes Epics and Features off the calendar. **Part B** adds the calendar zoom once Part A's layout has settled (the zoom animates the column Part A rebuilds).

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Typed meals vanished (week changed or page closed before saving) | Test lead, Frontend | Save as you type (short pause) and on week change / closing; reload test |
| 2 | Tips felt preachy, so the menu was avoided | Daily-use coach | Tips framed as ideas ("Room for fish this week?"), never counts of what's missing, never red |
| 3 | The zoom felt slow or stuck in Safari, or there was no obvious way back | Experience, Frontend | ~350 ms; click the month again, ✕ or Esc; instant with reduced motion; tested in Safari |
| 4 | Notes above the TV pushed the TV below the first screen and the money got glanced at less | Room designer | Measured at 1440×900; said plainly to Mel; notes layout kept compact |
| 5 | A Feature with a real deadline disappeared from the calendar | Agile coach | Question 1; the level rule is one line to change |
| 6 | Zoomed calendar showed personal events at work | Privacy | Zoom reads the same `calendarItems` (through `records` / `focusGoals`), so Busy blocks stay Busy |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Serves "show beautifully, organise". The menu and canary are probes; reshaping the menu now is responding to evidence, not building on a guess |
| 2 | Sceptic | reshape | No Claude meal ideas, no Notion menu database, no tick until asked twice. Reuse the calendar's existing peek titles for the zoom |
| 3 | Daily-use coach | reshape | Tips must be warm and optional; the menu's use is still the probe (judged ~26 Oct) |
| 4 | Data steward | reshape | Meals saved on this Mac like the plant and drawings (`data/room/menu/<Monday>.json`), the only home they have, so no copy and no signpost breach. Keep the one drawn week (28 Sep PNG), shown read-only. Level rule over a Notion tick: a tick needs a new column, mapping, and existing rows would all read "unticked" |
| 5 | Frontend engineer | go, two parts | Notes and menu move inside the left column (width for free); the zoom uses a class plus slide/FLIP animation, not an overlay, so nothing slides over the bookcase; month name becomes a real button |
| 6 | Test lead | reshape | Menu tips and the calendar rule live in `public/shared/` with tests; week names validated; the desk's day panel also uses the calendar list, so Epics leave it too |
| 7 | Room designer | go | Markers stay on the tray as objects; text in marker ink; check with lights off |
| 8 | Privacy and safety | go | Menu and tips stay covered at work; zoom keeps Busy blocks |

Passes: Release keeper (no `npm install`, no `.env` change).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Calendar: just a rule (Tasks and PBIs show, Epics and Features don't), or also a tick on every goal? | The rule now. A tick needs a new Notion column and every existing goal would start unticked. Add it later if a Feature's deadline ever needs to show |
| 2 | Typed meals: Cormorant italic in marker ink (keeps the three typefaces), or a marker-style handwriting font (a fourth)? | Cormorant italic: matches the room and the Settled typeface rule |
| 3 | A short "Eating well guide" page in Notion (beside the Goals guide) for the longer reasons and sources? | Yes: same pattern as the goals coach; tips in the room link to it |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| Greeting shelf and Ask box up (lamp's curved text level with the Notion / Pūtea pills); notes under Ask, above the TV | Moving the calendar side |
| Menu board as wide as the left column (TV + remote), under the TV | |
| 21 typed boxes (Mon–Sun × Breakfast / Lunch / Dinner), markers and eraser kept on the tray as decoration (the canary still pecks the marker); ‹ › weeks; Wipe with Undo | Drawing (cut: finicky). Old drawn week shown read-only |
| Eating-well tips: the plate idea, gentle weekly prompts matched against what's typed, link to the guide | Claude suggesting meals (earned if the tips get opened most weeks) |
| Calendar: Epics and Features off (also off the day panel) | Per-goal tick (Question 1) |
| Click the month: left column slides away, calendar grows to the wall with titles in each square; click again / ✕ / Esc returns | Zoom on phones (the calendar is already full width there) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Calendar rule + test | `public/shared/goals.js`, `public/app.js`, `test/` | Epics/Features gone from calendar and day panel |
| 2 | Wall moves | `public/index.html`, `public/styles.css` | Arc top level with pills at 1440; notes above TV; menu under TV at column width |
| 3 | Menu storage route | `server/index.js` (`/api/menu/:week`, week validated, small JSON) | Saves and reads back; bad week names refused |
| 4 | Typed menu | `public/whiteboard.js`, html, css, `public/bird.js` (drop drawing "busy" check) | Type, reload, still there |
| 5 | Tips | `public/shared/menu.js` (rules, tested), `public/whiteboard.js`, Notion guide page | Tips change as meals are typed; covered at work |
| 6 | Part B: calendar zoom | `public/app.js`, css | Smooth in and out, Esc, reduced motion, Focus respected |

Needs `npm install`? No. New `.env` value? No. Notion changes Mel must make: none (the guide page is written by Claude under the Hanua page).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` with new tests: calendar rule, menu tips, week-name check | `npm test` |
| 2 | Menu route refuses bad week names, round-trips a saved menu | script against the sample server |
| 3 | Sample server at 1440 / 1024 / 375, lights on and off, At work | `.claude/launch.json` → `sample` |
| 4 | Zoom in/out, Esc, ‹ › while zoomed, focus returns | preview, measured by script |
| 5 | Elsewhere: canary perches, look down, Today list, Timeline/Backlog keep Epics, plant and can on the moved shelf | preview |

## 8. Close-out
| # | Record | What |
|---|---|---|
| 1 | Map | Wall, Calendar, Menu whiteboard rows |
| 2 | Cascade | Preferences (menu no longer hand-drawn; cut list: drawing), CLAUDE.md layout |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Learning Log | Probe evidence: drawing was too fiddly after 1 day |
