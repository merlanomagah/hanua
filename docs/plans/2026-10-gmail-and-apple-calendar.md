# Panel brief: Apple Calendar and key Gmail in the room

**Request (as the problem):** Mel's real events live in Apple Calendar and her important information arrives by email, but Hanua's calendar is empty (the Notion book has no data yet) and email is a separate trip. She wants both visible in the room, and dates from emails onto the calendar, without Hanua becoming a copy of either.
**Lane:** Large (two new data sources) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward*, Backend engineer*, Frontend engineer, Test lead*, Privacy and safety, Release keeper (* read the code independently)
**Gate:** worth it. Apple Calendar puts real data on the calendar straight away (priority 2 on Context: the calendar only pays off with real data). Gmail: worth it, smaller: read-only, only a "key" slice, a click opens Gmail; Notion only ever gets the link.
**Today, outside Hanua:** Calendar.app and Gmail in their own windows. Both keep working exactly as they are; Hanua only reads.

## 1. Verdict
Go, in two parts. **Part A, Apple Calendar** (no keys, quick win): your Mac's calendars show on the wall calendar, its day window and the agenda sheet, read live, never copied. **Part B, key Gmail**: a letter tray on the desk shows emails Gmail's own filters label **Key** (plus starred); a click opens the email in Gmail; "Find dates" has Claude suggest dates from that one email, you edit and confirm, and only then a row goes to the Notion Calendar book with the email's link.

## 2. Premortem: three weeks later it failed. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Repeating events showed once or not at all, so the calendar couldn't be trusted | Backend | EventKit helper (it gives every occurrence), not AppleScript |
| 2 | Gmail stopped working after a week | Backend | The Google project is set to "In production" (in Testing, Google expires the sign-in after 7 days) |
| 3 | A private appointment or email subject showed at work | Privacy | Apple events not on a Work calendar show as "Busy" at work; the letter tray is put away at work and isn't fetched while Hanua sleeps |
| 4 | The tray filled with noise and got ignored | Daily-use coach | Only label Key or starred, last 14 days, at most 20; you control it with Gmail filters |
| 5 | Calendar permission was refused and the calendar went silently blank | Experience | The page says why, and where to allow it |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Backend | go | Apple: a tiny Swift EventKit helper, compiled on the Mac by the start script (osascript is slow and misses repeats). Gmail: plain fetch, read-only scope, sign-in once per account through Hanua; no `npm install` |
| 2 | Data steward | reshape | Apple events are their own source, never merged into or synced to the Notion book; both feeds are held a few minutes in memory only; Notion gets the Gmail link only on rows you confirm, in a new URL column you add |
| 3 | Test lead | go | Rules go in `public/shared/` with tests first (event shaping, all-day / multi-day / repeats, daylight saving, de-duplication, Focus, Gmail links); sample events and emails so the preview shows both with no access |
| 4 | Privacy | go | Google keys in `.env`, sign-in tokens in a gitignored file (the repo is public), read-only scope only; nothing new shows at work or asleep |
| 5 | Experience | go | Clicking an Apple event opens it in Calendar.app (it isn't in Notion); clicking an email opens Gmail in the right one of your three accounts |
| 6 | Room designer | go | Mail as a real object: a small walnut letter tray on the desk with envelopes; the count is how many envelopes are in it, not a red badge |
| 7 | Frontend | go | The agenda and the desk's Work list must not try to open an Apple event as a Notion row; check the calendar zoom with a crowded day |

Chair, Sceptic and Release keeper: pass.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Which Gmail accounts? | Start with **merlmanueli@gmail.com**; the others can be added later with one sign-in each |
| 2 | Which Apple calendars show, and which count as Work (shown in full at work)? | All of them except Birthdays and holidays; a calendar named **Work** counts as Work |
| 3 | The Notion Calendar book needs a URL column called **Email** for the link. Shall I add it (through the Notion connection), or will you? | I add it after your yes; nothing else in the book changes |

## 5. In and out
| In | Not (and what would earn it) |
|---|---|
| Apple events on the calendar, day window and agenda, read-only | Writing to Apple Calendar (Hanua doesn't write to sources it only shows) |
| Key / starred emails in a desk letter tray; Find dates → confirm → Notion row with the link | A Notion row per email (copies drift; earned only if you want an email inbox in Notion) |
| | Bills from Gmail: they stay in Pūtea |

## 6. Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Shared rules and tests | `public/shared/events.js`, `public/shared/mail.js`, `test/` | `npm test` covers shaping, all-day, repeats, daylight saving, de-dupe, Focus, links, date draft |
| 2 | Apple helper | `scripts/calendar.swift`, `scripts/start.sh` compiles it into gitignored `bin/` | It lists this month's events as JSON; refused access prints a clear error |
| 3 | `GET /api/calendar` (60 s memory cache, sample fallback) | `server/calendar.js`, `server/index.js`, `data/sample.json` | Sample server shows sample events |
| 4 | Calendar, day window, agenda | `public/app.js`, `public/planner.js`, `public/lib.js` | Apple events show with their calendar colour; click opens Calendar.app; Busy at work |
| 5 | **You:** allow Calendars once when macOS asks | | Your real events show |
| 6 | **You:** Google Cloud project (I'll walk you through it, about 10 minutes): Gmail API on, a Desktop OAuth client, "In production"; paste two values into `.env` | `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | |
| 7 | Gmail sign-in and reading | `server/gmail.js`, `/api/mail`, `/api/mail/connect`, `/api/mail/callback`; tokens in gitignored `data/gmail-tokens.json` | Signing in once from Hanua lists your Key emails |
| 8 | Letter tray on the desk | `public/planner.js`, `public/styles.css` | Envelopes; click opens Gmail; hidden at work |
| 9 | Find dates | `/api/mail/:id/dates`, `server/claude.js`, the Feed's confirm step; Email column in the Calendar book, `config/areas.json` `fields.link` | Claude suggests, you confirm, the row has the link |

Needs `npm install`? **No.** New `.env` values? **Yes:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Part B). Notion: an **Email** URL column on the Calendar book (question 3). macOS: allow Calendars once (for the app Hanua is started from: Shortcuts, and Terminal if you also start it there).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | the new shared rules, with Pūtea-style recorded replies; never runs the helper, Gmail or Notion |
| 2 | Sample server at 1440 / 1024 / 375, lights on and off, Focus on and off | `.claude/launch.json` sample, with `APPLE_CAL=0` |
| 3 | Calendar zoom with a crowded day; agenda swipe; desk Work list unchanged | sample events |
| 4 | Refused Calendar access and no Google keys | the page says why, nothing blank |
| 5 | Find dates writes nothing until confirm | sample mode returns a fake row, no Notion call |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | new rows: Apple Calendar (data source), Gmail (data source), Letter tray; update Calendar (Notion), Wall calendar, Agenda |
| 2 | Cascade | new data source rows; Calendar book's new column → `config/areas.json` |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences | mail as a desk letter tray; Notion gets pointers, never copies |
