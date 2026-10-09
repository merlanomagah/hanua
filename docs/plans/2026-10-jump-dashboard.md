# Panel brief: the Jump Dashboard (design and plan)

**Request (as the problem):** At work, Mel has no single place that shows what needs her attention in Skinny Jump today: open escalations, who she's waiting on, what's blocked. It's spread across Jump OS's databases in Notion, the planner's "Jump issues" section, the calendar and email.
**Lane:** Large (a new pane, three new Notion data sources) · **Seats:** all core seats + Jump (guest); Data steward, Frontend engineer and Test lead as independent code readers. This round is **design and plan** (Mel: "let's just design and plan").
**Gate:** worth it, as a **probe**. It's priority 5 on Context ("Skinny Jump operations room, a read-only signpost onto Jump OS"), but Jump OS is Confidence *Unknown* on the Map, and whether Mel will open a dashboard can only be learned by using one. So: the smallest useful version first, read-only, with a count of how often it's opened.
**Today, outside Hanua:** Mel opens Jump OS in Notion when something has gone wrong, and keeps the day's Jump work as lines under **Jump issues** in Plan my day. That habit is reactive; the dashboard's job is to make the next chase visible *before* something goes wrong.

**Panel record:** first written 10 Oct from Claude's own pass; re-run the same day with every seat's checklist and three independent code readers. What that changed is marked **(full panel)**. The first version's layout sketch used real colleagues' names; the readers caught it and they were replaced with invented ones (the repo is public).

## 1. Verdict
Go, reshaped as a probe. A new pane **beside the desk, to its left**, reached by swiping right on the desk (the same direction that reveals the goals board from the wall), a **JUMP** edge tab and a dock icon. Same bricks and oak, the desk's frosted widgets and dock, and five widgets that only **read** Jump OS and point back to it.

**Reshaped by the full panel:**
1. **A fixed layout for the probe, not yet the desk's drag-and-arrange.** The desk's arranging code is wired to the desk alone (`public/desk/arrange.js`); making it work for a second desktop means reworking Mel's busiest surface for something not yet shown to help. Widgets look and feel the same; moving them comes once the probe earns it (question 2).
2. **Only safe columns on screen.** An escalation's Issue and Outcome text can hold customer details: the dashboard shows title, status, tier, age and who it's waiting on; everything else is one click away in Notion.
3. **→ Today keeps a pointer, not a copy:** the line gets the escalation's title and its Notion page id, never its status or dates (they'd go stale in the planner and its 30 days of backups).
4. **The escalation log has one row.** A dashboard on that alone would open nearly empty, so question 1 settles the source first.

## 2. The layout (invented examples)

```
 ┌───────────────── rail (unchanged) ─────────────────────────────────────────────────┐
 │  JUMP · Fri 10-Oct                     as recorded in Jump OS · updated 2 min ago ↗ │
 │ ┌─ Escalations (large) ──────────────────┐ ┌─ Waiting on ──────────┐ ┌─ Today ────┐ │
 │ │ Open 3 · Interim 1 · Awaiting 1 · CD 0 │ │ Person A · 4 days      │ │ 10:00 (a   │ │
 │ │ ▌T2  (an escalation title)      6 days │ │ Person B · 6 days      │ │ meeting)   │ │
 │ │      waiting on Person B · Open ↗      │ │ Person C · 2 days      │ │ Jump issues│ │
 │ │ ▌…                                     │ └────────────────────────┘ │ ☐ a task   │ │
 │ │ Closed this week: 2                     │ ┌─ Projects ────────────┐ │ ☐ a task   │ │
 │ └────────────────────────────────────────┘ │ Active · Blocked       │ └────────────┘ │
 │  [Jump OS]  [Escalation log]  [Form]       │ next action each       │ ┌─ Blocking ─┐ │
 │  (desktop files: open Notion / the form)   └────────────────────────┘ │ 3 questions│ │
 │ ════════ oak ══════ dock: Goals · Calendar · Jump OS · Notion · Settings ══════════ │
```

| # | Widget | Reads (exact Notion columns) | Why it's there |
|---|---|---|---|
| 1 | **Escalations** (large, left) | Care Team Escalation Log: Escalation, Status, Tier, Raised, Closed, Waiting on. Open ones grouped by Status, oldest first, days open; "Closed this week"; past 8, "n more in Notion ↗" | Mel's KPIs: partner friction and issue resolution. Age is the signal |
| 2 | **Waiting on** | Escalations' "Waiting on" and Open Questions' "Who can settle it", grouped by person (full panel: Project Tracker has no person field, so projects aren't in it) | An operations role is mostly chasing |
| 3 | **Today** | Today's Work events (Calendar, already read) + today's **Jump issues** lines from Plan my day, tickable | The plan and the dashboard, one list |
| 4 | **Projects** | Project Tracker: Project Name, Status (Active, Blocked), Next Action, Target Date, Owner | The roadmap Mel owns, one line each |
| 5 | **Blocking questions** | Open Questions & Conflicts: Question, Status = Open, Priority = Blocking | A count and the top three |
| Files | Jump OS, Escalation log, Escalation form, Tautoko | links only | Signposts |

Each row opens its Notion page (↗). **→ Today** on an escalation, project or question adds a line under today's Jump issues in Plan my day.

**States** (Experience designer): not connected ("Connect the Escalation Log to Hanua in Notion: ••• → Connections"), empty ("No open escalations recorded in Jump OS"), one source failing (that widget says so, the others carry on), sample (pill says "sample"), asleep (hidden like the rest of the room). **Phones** (900 px and under, one scrolling page): a section after the desk. Esc on Jump goes back to the desk first.

## 3. Premortem
| # | Why it failed | Seat | What this brief does about it |
|---|---|---|---|
| 1 | It opened empty: the real escalations live in the Google Form and email, not the Notion log | Sceptic, Jump | Question 1 settles the source first; the empty state says where it's looking |
| 2 | Two lists for the same work (Jump issues, the dashboard) and both went stale | Daily-use coach | Today *is* the planner's Jump issues; → Today writes there and nowhere else |
| 3 | Notion wasn't kept up to date, so the ages were wrong and Mel stopped trusting it | Jump | "updated n min ago", "as recorded in Jump OS"; partner facts never shown as settled |
| 4 | The swipe fought Up next's sideways swipe, open windows or dragging | Frontend | (full panel) Up next already stops its own swipe from spreading (`agenda.js:200`); the new swipe also skips open windows, dialogs and anything being dragged; JUMP tab and dock icon are the sure ways in |
| 5 | Nobody remembered it was there | Daily-use coach | One swipe from the desk she opens every morning; the weekly review shows visits; look again ~7 Nov |
| 6 | (full panel) Open questions past the 50th row never showed | Data steward | Hanua reads only the first 50 rows of a database today (`server/notion.js:98`); the Jump reads ask Notion for open rows only |

## 4. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go (probe) | Read-only; evidence = visits per week in the weekly review and whether Jump issues lines come from → Today. Builds on the desk (Being tested), but a fixed layout keeps it from leaning on the arrange code |
| 2 | Sceptic | reshape | Smallest version: a single Escalations widget on the desk at work would test the habit too. Mel asked for a pane, so the pane stays, but fixed and read-only; anything more is earned |
| 3 | Daily-use coach | go | Ages in calm type, never red counts; no streaks; nothing opens by itself |
| 4 | Experience designer | go | States, Esc order, phones (above); Lifecycle below; words say "as recorded in Jump OS" |
| 5 | Room designer | go | Same bricks and oak; a small brass "JUMP" plate drawn in code; tier chips and the plate from `:root` tokens only (the colour limit has no room left); lights off dims it like the desk |
| 6 | Data steward (reader) | reshape | Database **page ids** in a `jump` block in `config/areas.json` (the ids gathered today are data-source ids and won't work with Hanua's Notion version, `notion.js:1-3`). Filtered reads (above). 60 s memory cache like `server/routes/books.js:22-50`: never in the room folder, browser storage or backups. → Today stores title + page id only |
| 7 | Frontend (reader) | reshape | Build the pane **inside the desk's pane, like the goals board inside the wall** (`styles.css:1466`): the desk's slide stays untouched. Fixed layout for v1; reworking `arrange.js` for two desktops only if earned, with the desk's layout checked before and after. Esc, `inert`, a new `hanua:jump` signal listed in `public/events.js` |
| 8 | Backend | go | `server/routes/jump.js` with `register(ctx)`; sample rows when Notion isn't connected, before any query; one retry on 429 (already in `notion.js`); each source can fail alone |
| 9 | Test lead (reader) | reshape | Concrete tests (section 8). The planner gets a new line field for the page id, so the day file's version goes up (`DESK_VERSION` 7 → 8) with a fixture of the old version; an older Hanua then refuses to save over the new day (by design; both Macs update themselves) |
| 10 | Privacy and safety | reshape | Customer details stay behind a click (Issue, Outcome never on screen). Work data at work is the point (blocking 5 is about personal data). Asleep: hidden already (`styles.css:2298`). Sample rows invented |
| 11 | Jump (guest) | go | Signpost only; "as recorded in Jump OS"; check the Jump OS Map row's Last confirmed when the build first reads it |
| 12 | Release keeper | go | Mel connects three databases; new Map row; Jump OS row Idea → Being tested |

## 5. Questions for Mel (at most 3)
| # | Question | Recommendation |
|---|---|---|
| 1 | Where do the **Jump escalations** you mean live? (a) the 🎧 Care Team Escalation Log in Notion (one row today), (b) your planner's **Jump issues** section, (c) the Jump Issues/Escalations **Google Form** or its sheet, (d) email | (a) + (b) for v1, and start logging escalations in (a). (c) needs a Google Sheets connection, and the Google → Microsoft move may retire the form: a separate step |
| 2 | "Desktop functionality": is it enough for v1 that it **looks and works like the desk** (same widgets, dock, files, click through), with **dragging and resizing the widgets** coming once you've used it for two weeks? | Yes: moving widgets means reworking the desk's own arranging code, which isn't worth risking for a probe |
| 3 | Are the five widgets right, and should the dashboard **open by itself** when you switch to At work? | Keep the five; don't open by itself (earn it if you always go straight there) |

## 5b. Lifecycle
| Verb | For an escalation / project / question (all owned by Jump OS) |
|---|---|
| Add | In Notion (a file on the dashboard opens the log). A Claude-drafted "+ Escalation" (draft → Mel confirms) only if Mel asks after v1 |
| See | Grouped by status, oldest first; Closed this week; "n more in Notion ↗" past 8 |
| Change | In Notion via ↗; the dashboard refreshes within a minute |
| Remove | In Notion only; Hanua deletes nothing |
| Bulk | Not needed in v1 |
| Close out | Closed escalations leave the list and count in "Closed this week" |
| Record | Nothing kept by Hanua; the history is Jump OS's. → Today lines keep a title and page id only. The visit count is a number, this Mac only |
| Day 30 | Old items rise by age; the cap keeps the widget short |

## 6. In and out
| In (v1) | Deliberately not (and what would earn it) |
|---|---|
| The pane, five widgets in a fixed layout, files, dock icon, JUMP tab, → Today, read-only | Dragging / sizing widgets (earn: two weeks of use and Mel asks) |
| Notion sources only, open rows only | Google Form / Sheet, Outlook email (earn: question 1 says that's where escalations live, and the Microsoft move has a date) |
| Visit count in the weekly review | Writing to Jump OS (earn: Mel asks to update status from Hanua); KPIs and the finance dataset |

## 7. Build plan (after Mel's answers)
| # | Step | Files / Notion | Done when |
|---|---|---|---|
| 1 | Mel connects the Hanua integration to the Escalation Log, Project Tracker and Open Questions (••• → Connections → Hanua); Claude reads each database's page id and checks each has one source | Notion | `/api/jump` reads them |
| 2 | `jump` block (page ids, exact columns, filters) in config; an optional filter for `queryArea` | `config/areas.json`, `server/notion.js` | a test for the filter |
| 3 | Shape rules + invented sample rows | `public/shared/jump.js`, `data/sample.json` (own `jump` key), `test/jump.test.js` | `npm test` |
| 4 | Route, memory cache, sample path | `server/routes/jump.js`, `server/index.js`, `test/routes.test.js` | sample server returns `sample: true` |
| 5 | The pane inside the desk's pane, swipe, tab, dock icon, Esc, `inert`, `hanua:jump` | `public/jump.js`, `index.html`, `styles.css` (tokens), `public/planner.js`, `public/events.js` | slide like the goals board's |
| 6 | → Today: a `ref` field on planner lines, `DESK_VERSION` 8, v7 fixture | `public/shared/desk.js`, `public/desk/state.js`, `test/fixtures.test.js` | Undo works; old days open the same |
| 7 | Visit count in the weekly review's last step | `public/goals/review.js` | |
| 8 | Exit check, `npm run check`, `main` | | |

No `npm install`, no new `.env` value (the ids live in `config/areas.json`). Notion: step 1 is Mel's.

## 8. Test plan
| # | Check | How |
|---|---|---|
| 1 | Shape rules with invented rows: grouping, age, oldest first; waiting-on by person; "closed this week" across a week boundary; the 8 + "n more" cap; one source failing alone | `test/jump.test.js` |
| 2 | `GET /api/jump` on a test server: 200, `sample: true`, every link null or invented (a real-looking id = a regression past the Notion key) | `test/routes.test.js` |
| 3 | The `ref` field: kept, version 8, a v7 day opens the same | `test/fixtures.test.js`, `test/subtasks.test.js` |
| 4 | `npm run check`: `hanua:jump` listed, sent and heard; `routes/jump.js` writes nothing to disk; `shared/jump.js` imports only shared code | `npm run check` |
| 5 | Colours: tokens only (limit 622, no room left) | `npm test` |
| 6 | Preview `sample-work` (port 3043): 1440 / 1024 / 375, At work and At home, asleep, lights off; swipe vs Up next and open windows; the desk's own layout unchanged | by script (hidden-pane rule) |

## 9. Close-out
New Map row "Jump Dashboard"; Jump OS Map row (Idea → Being tested, Last confirmed when actually checked); Context priority 5; Session Diary with "Panel: Large; seats that caught something: Data steward, Frontend, Test lead, Privacy"; Preferences (the pane's place in the room). Learning Log: a panel run from one pass missed real names going into a public file; the independent readers caught it.
