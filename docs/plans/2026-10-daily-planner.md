# Panel brief: Daily planner on the desk

*First run of the Hanua Panel (test, 4 Oct 2026). Waiting on Mel's answers; nothing built.*

**Request (as the problem):** Mel wants to choose what she'll do today inside Hanua, have that choice kept in Notion, and see each morning what she meant to do yesterday but didn't.
**Lane:** Large · **Seats:** all 11 core + guests Agile coach, Bula voice (Data steward, Frontend engineer and Test lead ran as separate agents)
**Gate:** worth it, smaller. It's Context priority 3 and the Today list's Map row already names it as its next step. But the Daily planner is *Unknown* confidence (small reversible version first), and today there is almost nothing to plan: the books are empty and Move to Sydney has Features but no Tasks yet.

## 1. Verdict
**Reshaped.** No new planner room and no new database. The notepad on the desk becomes the planner: a **"From yesterday"** group at the top, a **"Plan today"** picker that pulls Tasks onto today, and a **Today** button in quick edit. The plan is a new **Planned for** date on each Task in Notion, so Notion stays the only home and "what I didn't finish" is worked out, never stored. Goal Tasks first; Work book tasks once the book has real rows.

## 2. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | reshape | Unknown tier → smallest reversible version. Builds on Today's list (Being tested), not on anything Assumed |
| 2 | Sceptic | reshape | Half exists: the list already keeps unfinished items as "Overdue · date" (`public/app.js` `renderTodo`). Don't build a room; extend the notepad |
| 3 | Daily-use coach | reshape | A carried-over list that only grows becomes a guilt list. Each carried item needs three ways out: **today / another day / let it go**. Keep today small (WIP 3 spirit) |
| 4 | Experience designer | go | It's a morning moment: carried items first, then today. Plan today must work at 375px (no hover-only controls) |
| 5 | Room designer | go | Stays on the notepad's printed lines (18-line cap, `PAD_LINES`). "From yesterday" written like a pencil note, no new image |
| 6 | Data steward | reshape | **Due ≠ planned.** A deadline and "the day I'll do it" are different facts. Add a `Planned for` date column; no new database (it would copy tasks). Carry-over = planned before today and not done, calculated on load |
| 7 | Frontend engineer | reshape | Own it in `renderTodo` + `goals/quick.js`; save through `store.js`. Warned that using Due would inflate the top shelf's planned target, which the Planned for column avoids |
| 8 | Backend engineer | go | `planned` joins `goalColumn` / `GOAL_FORM` in `server/goals.js`. Work book planning needs a new route, so leave it for phase 2 |
| 9 | Test lead | reshape | Write the carry-over rule in `public/shared/` with unit tests first (yesterday done/undone, finished late, 3 days ago, month/year ends, daylight saving). Sample rows for each case |
| 10 | Agile coach (guest) | go | It's a sprint of one day: pull Tasks from the PBIs, don't invent new ones on the desk |
| 11 | Bula voice (guest) | not now | Which parts of Bula's philosophy belong here isn't known yet. Leave it out of phase 1 rather than guessing |

Passed: Privacy and safety (no money, no work data, nothing sent to Claude), Release keeper (see close-out).

## 3. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Build now, or first plan PBIs and Tasks under Move to Sydney so there's something to plan? | **Plan the Tasks first** (next on your goals list anyway), then build. Otherwise it's polish ahead of plumbing |
| 2 | Goal Tasks only for now, or Work book tasks too? | **Goal Tasks only.** The Work book is empty and needs a new route; add it when it has rows |
| 3 | Something you didn't do 3 days ago: still "from yesterday", or does it drop off? | **It stays, showing how many days ago**, until you choose today / another day / let it go |

## 4. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| `Planned for` on goal Tasks; From yesterday group; Plan today picker; Today button in quick edit | A separate planner room (the notepad proves it first) |
| Today / another day / let it go on carried items | Work book planning (the book gets real rows) |
| Carry-over rule in `public/shared/` with tests | Bula philosophy prompts (Bula OS read and the part that fits named) |
| | Time-blocking by hour (the day plan gets used for 2–3 weeks) |

## 5. Build plan, in dependency order
| # | Step | Files / Notion | Done when |
|---|---|---|---|
| 1 | Mel adds a **Planned for** date column to Goals in Notion | Notion (no new connection needed) | Column exists |
| 2 | Map the field | `config/areas.json` goals.fields, `server/goals.js` | `GET /api/goals` returns `planned` |
| 3 | The carry-over rule + tests | `public/shared/` (e.g. `carriedOver`), `test/` | `npm test` passes all cases |
| 4 | Sample rows for each case | `data/sample.json` | Preview shows them |
| 5 | Notepad: From yesterday, Plan today, three ways out | `public/app.js` `renderTodo` | Works at 1440/1024/375 |
| 6 | Today button in quick edit | `public/goals/quick.js` | Saves through `store.js` with Undo |

Needs `npm install`: no. New `.env` value: no. Notion: one new column (step 1).

## 6. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | New carry-over tests plus the existing ones |
| 2 | Sample server at 1440 / 1024 / 375, lights on and off | `.claude/launch.json` → `sample`; never real Notion |
| 3 | Plan today moves a Task into today; let it go clears the date; ticking removes it from carried; reload keeps it | In the preview |
| 4 | Nothing else moved | Top shelf planned target, coins, the "N to do" count, the 18-line pad cap, the calendar |

## 7. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Today's list, Daily planner (Unknown → Being tested), Goals (Notion) |
| 2 | Cascade | New Goals column → `config/areas.json` goals.fields |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences | The planner lives on the notepad, not its own room |
