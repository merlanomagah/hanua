# Panel brief: goals in their books, and three money frames on the wall

**Request (as the problem):** Mel wants to see each goal from the part of her life it belongs to (a goal like "Land a PM role at $100K" is Work *and* money), and to see how today's spending is going without opening anything, alongside the goals she set in Pūtea.
**Lane:** Large (a Notion column added, a book renamed, a new wall object, three parts of the room) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Backend engineer, Test lead, Privacy and safety, Release keeper; guests Money advisor, Agile coach. Seats run in one pass by Claude this time (no separate agents).
**Gate:** worth it. Goals in books: Context priority 2 (goals are the one place with real data) and the purpose's "organise". Frames: priority 1 ("more stats surfaced") and the first daily use of Pūtea, now running for real.
**Today, outside Hanua:** daily spend is seen in Pūtea's own screens (mindful days, the weekly check-in), only when Pūtea is opened. Goals are seen on the board by level, never by life area. The pinned notes the frames would replace mostly say "Your notes will pin here" (the Learning and People books are still empty).

## Mel's answers (5 Oct 2026) and what was built
| # | Answer | Built |
|---|---|---|
| 1 | Swap "Left this pay" for the plant's days watered in a row | Frames: Today's spend · Plant watered (days in a row) · Saving for |
| 2 | The pinned notes go on the desk wall, left of the screen | `#notes` moved into `.desk-left` above the stickies (3 at most, hidden when empty) |
| 3 | Rename both the book and the Area | Notion Area option Money → Finances (no rows used it); book label Finances |
| + | The music card: an overlay, not boxy, evenly spaced | Smoked glass, no border, centred in the space left of the record player |
| + | The top rail overlapped in a narrow (split-screen) window | Side columns never narrower than their buttons; Ask gives way to 200px |

## 1. Verdict
Go, in two parts.
**Part A, goals in their books.** Keep **Area** as each goal's home (it drives At work), and add one Notion column, **Also in** (pick any books), for goals that belong to more than one. Every book gets a **Goals** page: the goals whose Area or Also in is that book, with their progress and next open steps, each one click from the board. Money becomes **Finances** (the book and the Area choice), and its Goals page also lists Pūtea's savings goals (Emergency fund, Move to Sydney, Queenstown Marathon…), read live.
**Part B, three frames under the greeting shelf**, in place of the pinned notes: **Today's spend** (vs your usual for that weekday), **Left this pay** (flexible spending left, days to payday) and **Next savings goal** (Pūtea's goal with the nearest date, saved of target). All read live from Pūtea; nothing kept.

## 2. Premortem
Three weeks later this failed, or Mel stopped using it. Why?
| # | Why it failed | Seat that owns it | What this brief does about it |
|---|---|---|---|
| 1 | The frames showed numbers Mel didn't trust (Afterpay counted as spend, transfers between her own accounts), so she stopped looking | Money advisor | Frames only show what Pūtea already shows (same figures as its screens, no new maths in Hanua). Each frame says "Pūtea is closed" honestly. Tuning Pūtea stays next on the list |
| 2 | A red $ figure every morning felt like being told off | Daily-use coach | Calm wording: "$40 today · you usually spend $11 on a Monday", no red, no streaks. Over is said in ink, not alarm |
| 3 | Someone at work saw the spend on the wall | Privacy | Frames go blank At work and when the remote hides money, same as the TV (blocking condition 5) |
| 4 | Tagging was one more field nobody filled in | Agile coach | Area still puts every goal in a book with no extra step; Also in is optional and only for the cross-overs |
| 5 | The nudges in the pinned notes (weekly review due, catch up with someone, a blocked task) vanished with them | Experience designer | Question 2 below |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Goals in books serves priority 2 without new data entry; frames are the first daily reason to keep Pūtea open. Build A first (no Pūtea dependency) |
| 2 | Sceptic | reshape | Don't add a second "area" field that duplicates the first: Area stays the one home, Also in only adds. No new channel on the TV, no money on the desk (cut 5 Oct) |
| 3 | Daily-use coach | go | Today's spend fits the morning glance. Compare to her own usual day, never a target she didn't set; no streak counters |
| 4 | Experience designer | go | A goal in a book opens the board at that goal (like agenda items open their book). Clicking a frame opens the Finances book on the matching page |
| 5 | Room designer | reshape | Real wall art: three portrait frames (~30 × 40 cm scale beside the TV), thin walnut moulding, cream mat, the figure in Cormorant, label in DM Mono. Hung level with each other, evenly spaced across the column, no nails (as with the clocks). Dim with the lights. Fixed-width figures so changing numbers never shift the frame |
| 6 | Data steward | go | One new multi-select column **Also in** (options = the books). Rename Area "Money" to "Finances" by adding Finances, moving rows across, then removing Money. Pūtea goals read from `GET /api/finance/goals`, today's spend from `GET /api/habits`, left this pay from `GET /api/this-pay`; never stored. Tag edits go through `goals/store.js` with the goal form as the confirm |
| 7 | Frontend engineer | go | Book pages reuse `fillPages`; a goal's descendants show under it (a tagged Epic carries its Features). Focus rules still apply: new views read through `focusGoals` / `moneyOff` |
| 8 | Backend engineer | go | `server/money.js` gains `shapeToday()` and `shapeGoals()` beside `shapeThisPay()`; one `/api/money/today` call for the frames, refreshed every 5 minutes with the Money book |
| 9 | Test lead | go | Rules for "which goals belong in this book" and the frame figures go in `public/shared/` with tests; the sample server gets sample frames and an Also in on a sample goal; never the real Notion |
| 10 | Privacy and safety | go | Frames and the Finances goals page join `moneyOff`. Nothing sent to Claude |
| 11 | Money advisor | go | Pūtea's safe-to-spend is $0 in the practice plan, so "Left this pay" uses the flexible group's target minus spent, which Pūtea already shows |
| 12 | Agile coach | go | Tag at any level; children are shown under their tagged parent, so tagging the Epic is enough. One line in the Goals guide on Also in |

Passes: Release keeper (standard list).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | The three frames: Today's spend, Left this pay, Next savings goal. Keep these, or swap one (e.g. goal Tasks done today, days to payday on its own, or the plant's days watered)? | Keep these three: all daily, all money, all from Pūtea |
| 2 | The pinned notes go. Where do their nudges go? | Weekly review due already has a dot on the board; move "catch up with…" and "blocked" lines onto the desk's agenda sheet once those books have data. Until then, drop them (cut list) |
| 3 | Rename Money to Finances: just the book, or the Area choice in Notion too? | Both, so the book and its goals match. I add Finances, move the rows, then remove Money, with your yes at that step |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Also in column, a Goals page in every book, Pūtea savings goals in Finances, Money → Finances, three frames, the pinned notes removed | Changing Pūtea's numbers (that's the Pūtea tuning session); money on the desk (cut 5 Oct); goals on the Calendar book (already on the wall calendar by due date); a book for Personal (earn it if Personal goals pile up) |

## 6. Build plan, in dependency order
| # | Step | Files / Notion | Done when |
|---|---|---|---|
| 1 | Notion: add **Also in** (multi-select: Work, Health, Learning, People, Finances); add Area option Finances, move any Money rows, remove Money | Goals database (with Mel's yes) | Schema shows both; no row left on Money |
| 2 | Config and mapping: `goals.fields.alsoIn`, `GOAL_FORM`, `GOAL_AREAS` fallback, `MONEY_BOOK` label "Finances" | `config/areas.json`, `server/goals.js`, `public/goals/board.js` | Goals come back with `alsoIn` |
| 3 | Rule `goalsInBook(goals, book)` (Area or Also in, plus descendants), tested | `public/shared/goals.js`, `test/goals.test.js` | `npm test` passes |
| 4 | Goal form: an "Also in" chip picker under Area | `public/goals/form.js` | Save writes it via `store.js` |
| 5 | A Goals page in every book; Finances adds Pūtea savings goals | `public/app.js`, `server/money.js` (`shapeGoals`), `/api/money/goals` | Each book shows its goals; click opens the board at that goal |
| 6 | Frames: `shapeToday()` from `/api/habits` + `/api/this-pay` + goals, `/api/money/today`, figure rules in `public/shared/` with tests | `server/money.js`, `server/index.js`, `public/shared/money.js` (new), `test/` | Live and sample both return three frames |
| 7 | The frames on the wall in place of `#notes`; blank At work / remote hide; click opens Finances; `renderNotes` removed | `public/index.html`, `public/app.js`, `public/styles.css` | Looks right at 1440 / 1024 / 375 |
| 8 | Docs: CLAUDE.md layout, Goals guide line on Also in | `CLAUDE.md`, Notion guide | Done |

Needs `npm install`? No. New `.env` value? No. Notion changes: step 1 (Claude does it with Mel's yes; the Goals database is already connected).

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | goals and money rules changed |
| 2 | New checks: `goalsInBook` (Area, Also in, descendants, At work); frame figures (Pūtea closed, no plan, over usual) | `npm test` |
| 3 | Sample server at 1440 / 1024 / 375 | `sample` launch config; never real Notion |
| 4 | Real Pūtea figures | `sample-putea` launch config (port 3033) |
| 5 | At work and remote hide blank the frames and the Finances goals page | toggle ⌃F and the remote |
| 6 | What could break: Focus (Area still Work), the TV and Money book (renamed label only), the calendar zoom (the wall column's height changes) | look at each |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Goals (Notion), Money book → Finances, Pūtea, Wall; new row for the frames |
| 2 | Cascade | Goals options changed (Area); a column added (`config/areas.json`) |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences / cut list | frames as wall art; pinned notes cut |
