# Panel brief: add a task to another day from where you are; sections from To-do.txt

**Mel's answers (8 Oct 2026):** yes / yes / yes: two weeks together; the two-week calendar picker; add, rename and remove empty sections in To-do.txt.

**Request (as the problem):** while planning today, Mel thinks of things for next week and has no quick way to put them there: she'd have to open each day, type, and come back, and the week view she'd use only shows this week. And in To-do.txt, the list she ticks off, she can add tasks but not a section.
**Lane:** Medium · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Frontend engineer, Data steward, Test lead
**Gate:** worth it, smaller than it sounds. Sending a line to another day already exists (⌘-click a line → Move to… → A day…, built 6 Oct night) but nobody would find it, and it only moves lines already typed on today. The fix is a visible way in, from the places she's already typing, plus a week view that reaches next week.
**Today, outside Hanua:** a paper planner lets you flip to next Tuesday and jot; a phone's Reminders asks "when?" as you add. Both keep you where you are: you write it once, in the right place, and carry on.

## 1. Verdict
**Go, reshaped.** One small day picker (a two-week calendar: this week and next, past days greyed, plus "A date…") used in three places:
1. **To-do.txt's add row** gets a **When** pick (Today by default), so a task can go straight to Tue 13 Oct without leaving the list.
2. **Plan my day**: each written line gets a **→** on hover, "Send to a day", the same picker. The bulk bar's Move to… opens the same picker instead of a bare date box.
3. **The week view** shows **this week and next week** (two rows of seven), each day listing its first few tasks, not just "3 tasks".
And **To-do.txt gets + New section** at the foot (name it, Enter, then add its first task); an empty section's name can be renamed or removed there, with Undo.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Tasks sent ahead were forgotten until the day came | Daily-use coach | The week view lists each day's first tasks; "Also planned ahead" stays for later weeks; the day's page shows them with "from Thu" |
| 2 | Every ordinary add got an extra click | Experience designer | When defaults to Today and sits last in the Tab order; Enter still adds |
| 3 | Mel never found the → on a line | Experience designer | It shows on hover and on keyboard focus; the bulk bar and To-do.txt reach the same picker; the toast says where it went with "Open that day" |
| 4 | A task sent ahead on one Mac clashed with the other Mac editing that day | Data steward | The existing changeDay path saves with that day's revision; if it can't, nothing moves and the toast says so |
| 5 | Sections added in To-do.txt landed oddly in Plan my day | Frontend engineer | Same rule as Plan my day's + Add a section (the shorter column); fixed sections can't be renamed or removed from To-do.txt (Desk Settings does that) |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Serves the planner priority; builds on Move to (Being tested), no new data shape |
| 2 | Sceptic | reshape | It mostly exists; make it findable. One picker, reused, not three new controls. No "Next week" bucket without a day: a dated line is the one thing the planner already understands |
| 3 | Daily-use coach | go | Capture has to be as fast as thinking of it, or it goes back in her head. Seeing next week's tasks on the week view is what makes sending them ahead trustworthy |
| 4 | Experience designer | go | Lifecycle below; Mac-like: Esc closes the picker, arrow keys move between days, Enter picks |
| 5 | Frontend engineer | go | `public/desk/daypick.js` (new, the picker); `todotxt.js` `addTaskEl` gets When; `page.js` line hover → and bulk Move to use the picker; `weekEl` shows 14 days; all sends go through `changeDay` + `putLines` (as `sendLines` does) |
| 6 | Data steward | go | No new fields, `DESK_VERSION` unchanged: a task added for another day is a line on that day's file with `added` and `from` (the day it was written); a day ahead that doesn't exist yet starts as the planner already starts one |
| 7 | Test lead | go | Rules in `public/shared/desk.js` with tests: `pickerDays(today)` (two weeks from this Monday, past flagged), `addLineTo(day, section, line)`; a sample-preview round trip: add for next Tuesday from To-do.txt → Undo → add again → open that day, it's there; on sync-a / sync-b, the other Mac sees it |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | The week view: this week and next week together (two rows), or one week with ‹ › as now? | **Two weeks together** (‹ › still go further) |
| 2 | The day picker: a two-week calendar (click a day) plus "A date…" for later, or a list (Tomorrow, then day names, then A date…)? | **The two-week calendar**: you see the dates, and it matches the week view |
| 3 | Rename and remove sections in To-do.txt too, or only add? | **Add, rename, and remove an empty one** (with Undo), like Plan my day. Fixed sections stay in Desk Settings |

## 4b. Lifecycle (a task added for another day)
| Verb | Answer |
|---|---|
| Add | To-do.txt's add row (When), Plan my day's → on a line, the bulk bar's Move to…; also still typing on that day's page |
| See | The week view (two weeks, first tasks per day), "Also planned ahead" for later weeks, the day's page ("from Thu"), Up next's days ahead (faintly) |
| Change | On that day's page, as any line; or send it on again with → |
| Remove | Undo in the toast straight away; later, on its day (delete the text, Undo offered) or Clear this day (Undo) |
| Bulk | Pick lines, then Move to… → the same picker |
| Close out | On its day it's an ordinary line: ticked, carried by the morning sweep, or let go |
| Record | `added` (when written), `from` (the day it was written on), in the day's file, backed up nightly |
| Day 30 | A busy future week shows as counts plus the first three tasks per card; nothing nags |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| The two-week picker in To-do.txt, Plan my day (→ and bulk), the week view at two weeks with task titles, + New section / rename / remove empty in To-do.txt | Typing a date into the text ("pay rent mon"): fun but easy to misfire; earned if the picker still feels slow after a week |
| | An undated "Next week" or "Someday" list: needs a new place to keep things; earned if Mel finds herself picking arbitrary days |
| | Adding from Up next or the wall calendar's day window: earned if she reaches for them |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Rules + tests: `pickerDays`, `addLineTo` | `public/shared/desk.js`, `test/desk*.test.js` | `npm test` |
| 2 | The picker | `public/desk/daypick.js`, `styles.css` (dark twin, tokens only) | Keyboard and mouse both work |
| 3 | To-do.txt: When on the add row; + New section; rename / remove empty | `public/desk/todotxt.js` | Added for next Tue → toast with Undo and Open that day |
| 4 | Plan my day: → on a line; bulk Move to… uses the picker | `public/desk/page.js` | Sent; this page no longer shows it; Undo brings it back |
| 5 | Week view: two weeks, first tasks per day | `page.js` `weekEl`, `/api/desk/summary` (titles) | 1440 / 1024 / 375 measured |
| 6 | Exit check, release, close-out | | §7 |

No `npm install`, no new `.env` value, no Notion changes.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` incl. the new rules | `npm test` |
| 2 | Round trip on the sample: add for next Tue from To-do.txt, Undo, add again, open that day; send a line from Plan my day; bulk-send two | `sample-work` preview |
| 3 | The other Mac sees it | `sync-a` / `sync-b` |
| 4 | Week view and picker at 1440 / 1024 / 375, dark and light, At work (only Work sections offered) | Preview, measured |
| 5 | To-do.txt: new section, rename, remove empty, Undo; fixed sections can't be renamed there | Preview, twice in a row |

## 8. Close-out
Map (Daily planner, Desk objects), Session Diary with "Panel: Medium; seats that caught something", Preferences (Plan the day row: adding to another day), CLAUDE.md latest.
