# Panel brief: add events to Apple Calendar from Hanua

**Request (as the problem):** Mel sees her Apple calendars on the wall and desk, but adding an event still means leaving Hanua for Calendar.app; she wants to add (and so manage) events where she's looking, with the usual fields, landing in Apple Calendar.
**Lane:** Large (a new write path into a data source; helper, server and page) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend, Backend, Test lead, Privacy and safety, Release keeper. Seats run in one pass by Claude from the code (`scripts/calendar.swift`, `server/calendar.js`, `public/app.js` `openDay`), not as separate agents.
**Gate:** worth it. It serves the purpose sentence (know where data is sent: Apple stays the home, Hanua keeps no copy) and the reminders work already writes to Apple the same way. Not polish ahead of plumbing: the read side is live and relied on.
**Today, outside Hanua:** Mel opens Calendar.app (or her phone) and adds the event there. That habit gives her Apple's full form, invitees and travel time; Hanua's form won't do invitees (EventKit can't send invitations), so Calendar.app stays one click away.

## 1. Verdict
Go. A **New event** window like Calendar's (what, calendar, all-day, starts, ends, repeat, alert, location, notes), opened from the wall calendar's day window, a + in the calendar's header and Up next. It writes straight to Apple Calendar through the helper Hanua already uses for reminders. Events Hanua shows can be opened in the same window to **change** or **delete** them (with Undo); a repeating one asks "this event / this and future" like Apple does.

## 2. Premortem: three weeks later it failed. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | The event went into the wrong calendar (a personal dinner in Spark NZ, or a work meeting at home) | Data steward | A calendar picker on every event, default from Settings; at work the default and the only choices are the Work calendars |
| 2 | Added it, didn't see it: the wall still showed the old day for a minute | Frontend | The 60 s cache is cleared on every write and the day redraws at once |
| 3 | Changed one Tuesday of a weekly event and every Tuesday moved | Backend | Edits to a repeating event always ask "this event / this and future"; the helper edits the single occurrence by its date |
| 4 | Deleted the wrong event and couldn't get it back | Privacy and safety | Delete asks first, then a toast offers Undo, which recreates it from what Hanua read (same fields, same repeat) |
| 5 | macOS asked for Calendar access again and Mel didn't know why | Release keeper | Said in plain words before release: rebuilding the helper can make macOS ask once more |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Write-through, no copy: Apple stays the authority (Decision Model §1) |
| 2 | Sceptic | reshape | Invitees and travel time are out: EventKit can't send invitations. Say so in the window ("Invite people in Calendar ↗") rather than pretend |
| 3 | Experience designer | go | Lifecycle below. Mac-like fields (checklist 8): Enter saves, Esc closes, end moves with the start, all-day hides times, sensible defaults (next half hour, 1 hour) |
| 4 | Room designer | go | A Mac thing: a desk-style window (title bar, red close), dark with the Mac like the desk's windows |
| 5 | Data steward | go | No copy kept; events identified by Apple's id plus the occurrence date. Notion Calendar book untouched |
| 6 | Backend | go | New helper commands `event-add`, `event-edit`, `event-remove`, `event-calendars` (writable calendars only: `allowsContentModifications`); recurrence via `EKRecurrenceRule` (daily, weekdays, weekly, fortnightly, monthly, yearly; ends never / on a date / after N); alerts via `EKAlarm` |
| 7 | Test lead | go | Rules (form → event shape, repeat words, "this / future") in `public/shared/events.js` with tests; sample servers (`APPLE_CAL=0`) keep a sample calendar in memory so the whole flow is tried without touching Mel's real calendars |
| 8 | Privacy and safety | go | Blocking 5: at work, only Work calendars are offered and personal events stay "Busy" (not openable). Blocking 6 is about Notion, but in its spirit: delete always confirms and has Undo |

Passes: Daily-use coach (fits the day as it is), Agile / money / Bula / Jump guests.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Which calendar should a new event go to by default (at home)? | The one you add to most; picked once in **Settings → Calendar**, changeable per event. At work it's always Spark NZ |
| 2 | Today the day window's "Add to this day" drafts a row in the **Notion Calendar** book with Claude. Swap it for the new Apple form? | **Yes, swap it.** Your events live in Apple now; the Notion book is still empty. ⌘S still drafts anything into Notion |
| 3 | Up next's + adds a meeting to today's **plan** only. Should it offer to put it in Apple Calendar too? | **Yes, a tick "Also in Calendar", off by default**: quick planner meetings stay quick |

## 4b. Lifecycle (an Apple Calendar event made in Hanua)
| Verb | Answer |
|---|---|
| Add | Day window "New event", + by the month's name, Up next's + (tick). Ad hoc: any day, any calendar you can write to |
| See | On the wall calendar, the day window, Up next, and in Calendar.app / your phone (it's a real Apple event) |
| Change | Click it in the day window or Up next → the same window, every field; repeating: this event / this and future |
| Remove | Delete (asks first) → Undo in the toast recreates it. Repeating: this event / this and future |
| Bulk | Not needed (Calendar.app does it better) |
| Close out | Nothing: past events stay in Apple, as now |
| Record | Apple keeps it (and iCloud backs it up); Hanua keeps nothing |
| Day 30 | Same as Calendar.app's; Hanua only reads a window of days |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| New event / edit / delete with Undo; title, calendar, all-day, start, end, repeat (+ ends), alert, location, notes, a link (URL) | Invitees and travel time: EventKit can't; "Open in Calendar ↗" in the window |
| Settings → Calendar: default calendar | Choosing colours, making new calendars: Calendar.app |
| Day window's add swapped to Apple (Q2); Up next's tick (Q3) | Events from the Notion Calendar book: unchanged |
| Sample calendar for testing | Writing to Mel's real calendars in tests: never |

## 6. Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Helper: `event-calendars`, `event-add`, `event-edit`, `event-remove`; `events` also returns notes, url, repeat, alert, `occurrence` and whether the calendar is writable | `scripts/calendar.swift` | Each command answers JSON; read-only calendars refused |
| 2 | Rules: form ↔ event, repeat words, defaults, "this / future" | `public/shared/events.js`, `test/events.test.js` | `npm test` |
| 3 | Server: `POST /api/calendar/events`, `PATCH …/:id`, `DELETE …/:id`, `GET /api/calendar/calendars`; cache cleared on write; sample calendar in memory when `APPLE_CAL=0`; at work only Work calendars | `server/calendar.js`, `server/index.js` | Round-trips on the sample server |
| 4 | The window: New / edit event, Mac-like fields, dark twin | `public/calendar-event.js` (new), `index.html`, `styles.css` | Add, edit, delete + Undo at 1440 / 1024 / 375 |
| 5 | Ways in: day window (Q2), + by the month, Up next tick (Q3), click an event | `public/app.js`, `public/desk/agenda.js` | Each opens the window on the right day |
| 6 | Settings → Calendar default | `public/desk/settings.js`, `public/shared/settings.js` | Saved, applied, Back to defaults with Undo |

Needs `npm install`? No. New `.env` value? No. macOS may ask once more for **Hanua Calendar** access after the helper is rebuilt (allow it: Full Access).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | new rules in `public/shared/events.js` |
| 2 | Add, edit (single and series), delete + Undo, twice in a row | sample server (`APPLE_CAL=0`), never Mel's calendars |
| 3 | At work: only Work calendars offered, personal events not openable | Focus on |
| 4 | 1440 / 1024 / 375, light and dark | preview |
| 5 | First real event | Mel adds one on her Mac after release; Claude checks it appears in Calendar.app |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Apple Calendar row: Writes to (events), Code |
| 2 | Cascade | "A new data source is connected" row: writes, Settings default |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences | "Events live in Apple Calendar; Hanua adds and edits them there" |
