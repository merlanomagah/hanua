# Panel brief: the Jump Dashboard, version 2 (to the right, visual, two-way)

**Request (as the problem):** The Jump Dashboard reads like a report: lists of words, on the wrong side, and Mel can't act on anything without going to Notion. She wants to see her Jump work at a glance and move it on from where she's looking.
**What Mel asked for (10 Oct 2026):** (1) to the right of the desk; (2) visual and interactive: escalations as a board, ageing at a glance, who she's waiting on, projects on a timeline; (3) two-way with Jump OS: move an escalation on, add one, edit Waiting on / Next Action, change a project's status, mark a question answered.
**Lane:** Large (writes to a new Notion source, a redesign, 3+ areas) · **Seats:** all core seats + Jump (guest); Data steward, Frontend engineer and Test lead as independent code readers (their claims checked against the code).
**Gate:** worth it, **as a probe that also fixes the plumbing.** The Escalation Log has one row: visuals over an empty log would be polish ahead of plumbing. But "Add an escalation" from where Mel works *is* the plumbing: it's how the log fills. So adding comes in the same release as the board, not after.
**Today, outside Hanua:** escalations arrive through the escalations form, email and Care; Mel opens Jump OS in Notion when something goes wrong, and keeps the day's Jump work as lines under Jump issues. The log stays empty because writing there is a separate trip.

## 1. Verdict
Go, reshaped. The dashboard moves to the **right** of the desk (swipe left on the desk, a JUMP tab on the right edge, J in the dock), and becomes **one screen of pictures, not lists**:

```
 JUMP · Sat 10 Oct                                            + Escalation   ↻
 ┌ OPEN 2 ──────────┬ INTERIM 1 ───────┬ AWAITING 1 ──────┬ WITH CD 1 ──────┬ CLOSED this week 2 ┐
 │ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐   │
 │ │T2  (a title) │ │ │PARTNER  …    │ │ │T2  …         │ │ │OPS  …        │ │ │T1  …       ✓ │   │
 │ │▇▇▇▇▇▇▇▇▁ 9d  │ │ │▇▇▇▇▇▁▁▁▁ 6d  │ │ │▇▇▇▁▁▁▁▁▁ 4d  │ │ │▇▇▇▇▇▇▇▇▇ 12d │ │ └──────────────┘   │
 │ │⏳ Person A   │ │ │⏳ Person B   │ │ │⏳ Person A   │ │ │⏳ Person C   │ │                    │
 │ └──────────────┘ │ └──────────────┘ │ └──────────────┘ │ └──────────────┘ │                    │
 └──────────────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────┘
 ┌ WAITING ON ───────────────┐ ┌ PROJECTS ──── Oct ─── Nov ─── Dec ─┐ ┌ TODAY ─────────────┐
 │  (D)   (A)    (C)   (B)   │ │ Stock sheets ════════╗ 30 Oct      │ │ 2:00pm a meeting   │
 │  15d   9d·3   12d   6d    │ │ Form tidy-up ▨▨▨ BLOCKED ▨▨▨       │ │ JUMP ISSUES        │
 │  bigger = more, ring = age│ │ Guide ══╗ (past its date)          │ │ ☐ a task           │
 └───────────────────────────┘ └────────────────────────────────────┘ │ 3 blocking ❓      │
                                                                       └────────────────────┘
```
(invented examples: the repo is public)

1. **Escalations board** across the top: a column per status from Notion, cards oldest first. **Ageing is a bar on every card** (fills over 14 days, the days written beside it), so the old ones stand out without a second chart. Drag a card to another column, or use the status button on the card (keyboard and phone).
2. **Waiting on**: a bubble per person, bigger for more items, a thicker ring for a longer wait; click one to see their items and edit what you're waiting on.
3. **Projects on a timeline**: a bar from today to each target date (Blocked shaded, past its date marked); click a bar for its status and Next Action.
4. **Today**: work events, today's Jump issues (tickable, → Today still works), and the blocking-questions count, which opens the questions with **Answer…**.

**Two releases**, so the look can be lived with before anything writes: **A** (to the right, the visuals, + Escalation, still otherwise read-only) and **B** (moving cards, edits, project status, answering). Both in this brief.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | A typo or an old name quietly made a new Status or Tier in Jump OS (Notion creates unknown options silently) | Data steward | The server checks every value against Notion's own list before writing, and refuses anything else |
| 2 | Dragging a card swiped the whole pane back to the desk, or a sideways scroll of the board did | Frontend | Board, cards and their scroll are on the swipe's skip list; drags have a threshold |
| 3 | Closing escalations from Hanua left Jump OS without the Finding and Outcome that make it a pattern | Jump | Closing asks for the Finding (one pick) and an Outcome line if none is recorded; never overwrites one that is |
| 4 | A test or a sample server wrote to the real Jump OS | Test lead | Sample servers keep their own copy in memory; and the Notion caller itself refuses to create, change or bin a page on a sample server (a new automatic check) |
| 5 | Pretty but empty: still one escalation, so nothing to see | Sceptic | + Escalation from the dashboard in release A; the empty board says how to add the first |
| 6 | A refresh every 5 minutes wiped a change that was still saving | Frontend | Refreshes wait while a write is in flight |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go (probe) | Capture is the plumbing; evidence = escalations added from Hanua and visits per week (~7 Nov) |
| 2 | Sceptic | reshape | Five visuals over a handful of rows is a lot: ageing goes *on* the cards, not its own chart; questions stay a count in Today |
| 3 | Daily-use coach | go | Ages as calm bars, never red counts; a card closing gives a small ✓, no score |
| 4 | Experience designer | go | Every drag has a button; forms are proper windows (Esc closes the form first, then the dashboard, then the desk); phones get grouped lists with the status button |
| 5 | Room designer | go | Cards are little index cards on the bricks, the same frosted glass as the desk's widgets; bubbles and bars sized by percentages (no new colours: tokens only) |
| 6 | Data steward (reader) | reshape | One write path (`public/jump/store.js`); option names from Notion; Closed sets the Closed date; Answered needs a Resolution; Hanua never overwrites Outcome or Resolution; Undo of an add moves it to Notion's trash (said that way); cache patched with what Notion sends back |
| 7 | Frontend (reader) | go, two steps | Mirror the slide (no collisions on the right); new small modules `public/jump/` (store, board, people, timeline, form), copying the goals *patterns* not their code; the board needs every open row and this week's closed ones, not the capped 8 |
| 8 | Backend | go | POST routes with an allowlist of fields; one retry on 429 (already there); errors in plain words |
| 9 | Test lead (reader) | pass with conditions | A sample write store in memory; round-trip tests (add → see → move → close → undo); validators as tested rules; the new guard in the Notion caller |
| 10 | Privacy and safety | go | Issue text typed in the Add form goes straight to Notion and is never shown or kept; the Resolution field says "no customer details"; deletes only via Undo of an add, to Notion's trash |
| 11 | Jump (guest) | reshape | Respect Jump OS's own rules (Finding, Outcome, Resolution; never overwrite an older entry); show "as recorded in Jump OS" |
| 12 | Release keeper | go | Two releases; Mel checks the integration can edit (the goals board already writes with it) |

## 4. Questions for Mel (at most 3)
| # | Question | Recommendation |
|---|---|---|
| 1 | When you drop a card on **Closed**, what should Hanua ask? (a) a small sheet: **Finding** (one pick) and an **Outcome** line if none is recorded, then Close; (b) nothing, just close; (c) refuse until both are filled in Notion | (a): keeps Jump OS's pattern-finding intact without sending you to Notion |
| 2 | **Ageing as a bar on each card** (no separate chart)? | Yes: one picture instead of two showing the same thing |
| 3 | **Two releases** (A: right side, visuals and + Escalation; B: moving cards and edits), or all at once? | Two: you see the look a day before anything writes |

## 4b. Lifecycle
| Verb | For an escalation (projects and questions alike) |
|---|---|
| Add | + Escalation (title, tier, raised = today, raised by, waiting on, the issue); ad hoc from anywhere on the dashboard |
| See | The board, oldest first with its age bar; people bubbles; Closed this week |
| Change | Drag or status button; click Waiting on to edit; projects: status and Next Action from the timeline |
| Remove | Undo of an add moves it to Notion's trash (30 days); anything else is closed, not deleted (Jump OS's way) |
| Bulk | Not needed |
| Close out | Closed asks Finding (+ Outcome if empty), sets the Closed date, sits in "Closed this week", then leaves the board |
| Record | All in Jump OS (Raised, Closed, Finding, Outcome); Hanua keeps nothing |
| Day 30 | Old open ones show long bars at the top of their column; closed ones have gone; people bubbles show who's slow |

## 5. In and out
| In | Deliberately not (and what would earn it) |
|---|---|
| Right of the desk; board + age bars, people, timeline, Today | Dragging the widgets around (earn: two weeks of use) |
| Add, move on, close (with Finding/Outcome), edit Waiting on and Next Action, project status, Answer… (with Resolution) | Editing Issue/Outcome/Resolution text later (that's Notion's job; Hanua never overwrites them); the Decision Log and Signal Log |
| Notion only | The escalations form and email (earn: Mel says that's where they really start) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| A1 | Mirror the pane to the right (slide, tabs, swipe directions, skip lists) | `public/jump.js`, `index.html`, `styles.css` | swipe left from the desk, right back |
| A2 | Shape for the board: every open row + this week's closed, people with counts, projects with dates | `public/shared/jump.js`, `test/jump.test.js` | tests |
| A3 | The board, age bars, bubbles, timeline, Today (tokens only) | `public/jump/board.js`, `people.js`, `timeline.js` | 1440 / 1024 / 375, light and dark |
| A4 | + Escalation: a window, POST to Notion (options from Notion), Undo → trash; a sample store in memory; the Notion caller refuses page writes on a sample server | `public/jump/form.js`, `public/jump/store.js`, `server/routes/jump.js`, `server/notion.js`, `test/routes.test.js` | add → appears → Undo removes it, on the sample server |
| B1 | Move a card (drag + button), Close sheet, edit Waiting on / Next Action, project status, Answer… | `public/jump/*.js`, `server/routes/jump.js`, shared validators | round-trip tests incl. 400s |
| B2 | Exit check; `npm run check`; `main` | | |

No `npm install`, no new `.env` value. Notion: Mel connects the three databases (if not done) and checks the Hanua integration can **insert and update** content (Notion → Settings → Connections → Hanua).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | Validators: allowed fields per area, statuses from Notion's list, Closed sets/clears the date, Answered needs Resolution, Undo shapes, text trimmed | `test/jump.test.js` |
| 2 | On a test server: add → GET shows it (`sample-` id) → move → close (date set) → undo → undo of the add removes it; Answered without Resolution = 400; unknown field = 400; `live:false` throughout | `test/routes.test.js` |
| 3 | The Notion caller refuses to create, change or bin a page on a sample server (reads still work) | unit test |
| 4 | `npm run check` (signals listed, no disk writes in the Jump route, colours from tokens) | |
| 5 | Preview on sample data: swipe both ways, drag a card without swiping, keyboard move, Esc order, → Today, Up next's own swipe untouched; 1440 / 1024 / 375; lights off; dark | by script (the hidden-preview rule) |

## 8. Close-out
Map: Jump Dashboard (Writes to: Jump OS), Jump OS (Read by and Written by); Session Diary with the Panel line; Preferences (right of the desk, visual); `config/areas.json` `jump._about` no longer "read-only".
