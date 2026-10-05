# Panel brief: Settings on the desk (roadmap step 6)

**Request (as the problem):** the things Mel sets once and would like to change herself (her fixed sections, her usual working hours, the words for times, the timer's lengths, which Reminders lists the desk uses) are buried in code, config or `.env`, so every change is a request to Claude. Her words (6 Oct): "enabling me to update info and functionality myself". The same idea for Pūtea is separate.
**Lane:** Medium (one new window, one small settings file; it touches the planner, the timer and the lists) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Data steward, Frontend engineer, Backend engineer, Test lead
**Gate:** worth it. It removes a whole class of small requests. The Sceptic's condition: only settings for things that exist; Close the day's times arrive with Close the day (step 7), not as empty fields now.
**Today, outside Hanua:** a Mac's System Settings (grouped panes, changes apply at once), and asking Claude.

## 1. Verdict
Go. A **Settings** app in the dock (a gear) opens a window like the others, grouped into Planner, Focus timer, Lists and Desk. Changes save as you make them, each group can go back to Hanua's defaults (with Undo), and they're kept on this Mac beside the planner's days (so the nightly backup has them), never in the public repo.

## 2. Premortem
| # | Three weeks on, it failed because… | Seat | What this brief does |
|---|---|---|---|
| 1 | Renaming a fixed section split it in two: today's "Spark NZ" stayed as her own section and an empty "Spark" appeared | Data steward | A rename also renames today's section with the old name (its lines stay); tested |
| 2 | Settings had so many options she never opened it | Daily-use coach | Only what she asked for or has changed today; four short groups |
| 3 | A setting quietly didn't apply until a restart | Backend engineer | The page and server read the same file; a change shows at once (sections, hours, words, timer) |
| 4 | A typo in a list name broke the Shopping list | Backend engineer | The Lists group picks from her real Reminders lists (a menu, not typing) |
| 5 | She changed something and couldn't get back | Experience designer | "Back to Hanua's defaults" per group, with Undo |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Built before Close the day and Routines, which add their own groups here |
| 2 | Sceptic | reshape | No settings for things not built (Close the day's times); no free-form minutes for time picks (question 2) |
| 3 | Daily-use coach | go | The gear sits in the dock where she already goes; one place, not scattered menus |
| 4 | Experience designer | go | Fixed sections as a list: rename in place, Work on/off, move up/down, remove, + Add. Each group has its Reset. Saves on change with a quiet "Saved" |
| 5 | Data steward | go | `data/room/settings.json` on this Mac (backed up nightly); `config/areas.json` and `.env` stay as the defaults underneath |
| 6 | Frontend engineer | go | One window via `window.js`; settings reach the page through `/api/settings` and a `hanua:settings` event |
| 7 | Backend engineer | go | The EventKit helper lists Reminders lists (`reminder-lists`); server reads settings before `.env` |
| 8 | Test lead | go | Tests for the settings shape (tidying, defaults), renaming a fixed section, and the timer and hours defaults |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | What should the Planner group hold? Fixed sections (names, Work, order), your usual day (start and end), and the time words. Anything else you change often? | Those three |
| 2 | Time picks: change the **words** only (e.g. "Quick" → "Tiny"), or the **minutes** too (e.g. a 20m pick)? | Words now; minutes if you find yourself wanting a different set |
| 3 | Desk group: keep a switch for "open the right window on my first visit each day" (on), and Hanua's default layout? | Yes, both |

## 4b. Lifecycle
| Verb | Settings |
|---|---|
| Add | + Add a fixed section; everything else is a change |
| See | the Settings window (gear in the dock) |
| Change | in place, saved at once; applies at once |
| Remove | remove a fixed section (it becomes an ordinary section today, nothing lost); Back to defaults per group, with Undo |
| Bulk | Back to defaults (a group) |
| Close out | n/a |
| Record | `data/room/settings.json`, backed up nightly; not history (not needed) |
| Day 30 | the same small file |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| Planner: fixed sections (rename, Work, order, add, remove), usual day start / end, time words | Close the day's times (with step 7); Routines (step 8) |
| Focus timer: focus and break minutes | Long breaks every 4 (ask if wanted) |
| Lists: which Reminders list is Shopping and which takes Add reminder (picked from her lists) | Creating lists from Hanua beyond Shopping |
| Desk: open the right window each morning (on/off); Hanua's own layout (same as the desk menu) | Wallpaper or colours (Preferences: the room's look is settled) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Settings shape and defaults, rename rule | `public/shared/settings.js` (new), `test/settings.test.js` | `npm test` |
| 2 | Server: read / save `data/room/settings.json`; fixed sections, Reminders list names and the day's default from it; helper lists Reminders lists | `server/index.js`, `server/calendar.js`, `scripts/calendar.swift` | `/api/settings` round trip |
| 3 | The window and the gear in the dock | `public/desk/settings.js` (new), `index.html`, `styles.css` | sample at 1440 / 1024 / 375 |
| 4 | Apply: planner (sections, day hours, words), timer lengths, lists, morning auto-open | `page.js`, `state.js`, `timer.js`, `planner.js` | each change shows at once |

Needs `npm install`? No. New `.env` value? No (the Reminders names move into Settings; `.env` still works as the default).

## 7. Test plan
`npm test`; on `sample-work`: rename Spark NZ and see today's section follow; change the day's hours and the timer; reset with Undo; at-work view; phone width.

## 8. Close-out
Map: Daily planner row (Settings), a new "Settings (desk)" row; Preferences: Mel changes her own settings from the desk.
