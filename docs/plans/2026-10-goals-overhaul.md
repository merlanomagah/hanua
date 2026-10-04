# Goals overhaul: one planned pass

Written 4 Oct 2026, from the Solutions Architect / UX / Dev review of the goals board. Numbers in brackets (#n) refer to that review.

## Decisions Mel made

| # | Question | Decision |
|---|---|---|
| 1 | Work book tasks and goal Tasks | Goal Tasks due today or overdue join the desk's Today list, marked with their goal. Ticking one marks it Done and earns its coins. Both books stay. |
| 2 | Coins for Tasks | A PBI's Tasks together earn at most the PBI's own value (50). Earliest finished are paid first. Stand-alone Tasks pay 10 as now. |
| 3 | Hierarchy view | Keep it and give it the same improvements. Count which views get used; decide in 2–3 weeks. |
| 4 | Shipping | Phase by phase: each phase tested and pushed to `main`. |

## How it's wired today (what the plan changes)

| Part | Today | Problem |
|---|---|---|
| Reading goals | `GET /api/goals` pages through up to 1,000 Notion rows; server keeps them 60 s | Fine for reading. |
| Writing a goal | `POST /api/goals/:id` updates Notion, returns nothing, clears the cache; the page then re-reads **every** goal | Each save = 1 schema read + 1 write + 1–10 reads. Gets slower as goals grow. |
| Creating goals (Plan) | One `POST /api/goals` per row, one after another, then a full re-read | 5 rows ≈ 5 schema reads + 5 writes + a full re-read. Notion allows about 3 requests a second. |
| Schema | `getSchema` asks Notion on every write | One extra call per write; never cached. |
| Notion errors | No retry when Notion says "slow down" (429) | Bulk actions can fail halfway. |
| Progress roll-up | Written twice: `rollUp` (server) and `recalcSample` (page) | The copies drift; sample stops matching real. |
| Sample vs real | Every save has its own "if real / else" branch (8 places) | Duplication; sample mode behaves differently. |
| Level / Status / Area options | Copied by hand into `public/app.js` | The cascade rule exists only because of this. |
| Code | `public/app.js` is 2,700 lines; goals are about 1,500 of them | Hard to change one part safely; expensive for Claude to read. |
| Tests | None | Regressions only show up in the browser. |
| Desk | Today's list reads the Work book only | Goal Tasks never reach the desk. |

## The plan

The order is set so that nothing gets built twice. The foundations go first because every later feature writes through them.

### Phase 1: Foundations (no visible change) — done 4 Oct 2026

| Step | What | Why it goes first |
|---|---|---|
| 1.1 | Split `public/app.js` into modules: `lib.js` (helpers, state, api, toast), `goals/core.js` (pure logic), `goals/store.js`, `goals/board.js` (Hierarchy, Board, cards), `goals/tree.js`, `goals/timeline.js`, `goals/plan.js`, `goals/form.js` (form, coach, sizing), `goals/review.js`, `shelf.js` (coins, top shelf, shop). Pure date and goal rules in `public/shared/` (dates.js, goals.js). No build step; plain ES modules. (#5) | Every later step edits these files. Splitting later would mean editing code twice. |
| 1.2 | `goals/core.js`, a single source shared by the server and the page: `LEVELS`, `rollUp`, `treeOrder`, `lineage`, `goalSpan`, `donePoints`, `epicValue`, `coinsFor` **with the PBI cap**, and `dateConflicts` (child due after its parent). The server imports it, and `recalcSample` goes. (#2, #8, #9) | Coins, roll-up and dates are used by the desk, shop, tree and timeline. Building them once here means the later phases just use them. |
| 1.3 | Server: write routes return the saved goal (Notion's update already sends the page back); new `POST /api/goals/batch` (2 at a time, a result per row); schema cached 10 min; one retry on 429 in `call()`; `GET /api/goals` also returns `options` from the schema and `fetchedAt`; `?fresh=1` skips the cache. (#1, #4, #10, #22) | Quick edits, desk ticking and Plan all depend on these. |
| 1.4 | `goals/store.js`: `create`, `createMany`, `update`, `remove`, `refresh`. It applies the returned goal to the page and rolls up locally, handles sample and real the same way, and replaces the 8 separate branches. Undo is built in. (#3) | One write path for every feature after this. |
| 1.5 | Options from Notion: `LEVELS` / `GOAL_STATUS` / `GOAL_AREAS` come from `options` (the level order and "when" labels stay in code). (#4) | Removes a cascade rule. |
| 1.6 | Tests: `test/goals-core.test.js` and `test/goal-mapping.test.js` with Node's built-in runner, plus an `npm test` script. They cover roll-up, coin cap, date estimates, date conflicts, sizing, coach checks and the Notion payload builder. No new installs. (#20) | Locks the logic in before the UI changes on top of it. |

**Testing:** `npm test`, then the full sample-data browser pass (all four views, Plan, drag on Board and Timeline, review, shop) to show nothing changed.

### Phase 2: The goals board — done 4 Oct 2026

| Step | What | Notes |
|---|---|---|
| 2.1 | Toolbar: view tabs, then the controls for the current view, **+ New ▾**, and a **⋯** menu (Refresh, Show done, Guide ↗, Notion ↗). **Weekly review** shows as a button only when it's due; otherwise it's in ⋯. Tabs move with the arrow keys. (#14, #21) | Done before 2.2 and 2.3, which add controls to it. |
| 2.2 | "Updated 2 min ago" under the title and **Refresh** in ⋯. (#10) | Uses 1.3. |
| 2.3 | **Hide done** by default, in every view. Goals finished in the last 14 days stay visible (dimmed) so wins don't vanish. "Show done" in ⋯ is remembered. (#11) | One filter in `core`, used by all four views. |
| 2.4 | **Quick edit** popover: tap a card's status, a tree node, or a timeline name to set status (New / Active / At risk / Done) and due date without the full form. Done triggers the coins toast and "how big did it feel". It's also the keyboard way to move cards on the Board. (#12, #21) | One component, three places. Built after 2.3 so its filter behaviour is final. |
| 2.5 | Cards: Plan / Edit / Notion show faintly on hover (and always on touch screens); straight cards in Board and Timeline, tilt kept in Hierarchy. (#13, #15) | CSS plus a small `goalCard` change. |
| 2.6 | Tree: Esc zooms out, a "+ Plan" ghost on each branch, ✓ on finished goals, and quick edit on nodes. (#17) | |
| 2.7 | Timeline: zoom (Weeks / Months / Quarter); **date conflicts** flagged (a ⚠ on the bar, with the reason on hover). The coach also warns in the form. (#16, #8) | Both change `renderTimeline`, so they're done together. |
| 2.8 | Chained planning: after Plan adds Features, the toast offers "Plan PBIs for '<first>' next →", and so on down. Plan uses `createMany` (one request, results per row). (#7, #22) | |
| 2.9 | View usage tally (on this Mac only): count which views are opened per week, shown in the weekly review, for the Hierarchy decision. | Small. |

**Testing:** a browser pass at 1440, 1024 and 375; keyboard-only pass (tabs, quick edit, timeline nudge); `npm test`.

### Phase 3: The desk and coins

| Step | What | Notes |
|---|---|---|
| 3.1 | Today's list: Work book tasks plus goal **Tasks** that aren't done and are due today or earlier (or finished today). A goal Task shows a small level-coloured tag with its parent's name. Ticking it goes through `store.update`: status Done, Completed date, coins toast, and "how big did it feel" if it was sized. The heading says "from your Work book and goals". | Uses 1.4 and 1.2. The calendar already shows goals on their due dates; no change there. |
| 3.2 | Coins cap shown where coins appear: the toast says when a PBI's Tasks have reached its cap; the shop and earnings panel use the capped values (automatic, via `coinsFor`). The Goals guide page in Notion and `coach.js` explain the rule. | The maths was done in 1.2; this is wording. |

**Testing:** tick a goal Task on the desk (sample data) and check the coins, the cap message and the board update; run the 375 width check on the desk.

### Phase 4: Close-out (once, at the end)

`CLAUDE.md` layout; Hanua OS Map rows (Goals pin board, Goals (Notion), Today's list, Top shelf / shop); Preferences; Learning Log (coin cap; goal Tasks on the desk); Session Diary; the Goals guide page.

## Overlaps avoided

| Risk | How the order avoids it |
|---|---|
| Editing goals code, then moving it into modules | The split is step 1.1. |
| Building quick edit, desk ticking and Plan, each with its own save code | Every feature writes through the store (1.4). |
| Coins worked out in three places (toast, shop, Epic value) | `coinsFor` with the cap lives once in `core` (1.2). |
| Adding Refresh / Show done to a toolbar that's then redesigned | The toolbar is 2.1, before both. |
| Timeline changed twice (zoom, then conflicts) | Both are in 2.7. |
| Updating docs and Notion after every phase | Once, in Phase 4. Commit messages carry the detail between phases. |
| Improving the red string | Not touched; Hierarchy stays as it is until the usage decision. |

## Not in this pass

Removing Hierarchy (decided after the usage tally); dependencies between goals; recurring goals; editing the Work book from the goals board.

## Limits on testing

Sample data covers everything on the page. Live-only paths (the batch endpoint, Notion returning the saved page, schema options, the 429 retry) are covered by unit tests on the payload builders and a careful read, not by real Notion writes. Hanua's rule is never to test writes against the real Notion. If Mel makes a throwaway copy of the Goals database ("Goals (test)", connected to the Hanua integration), those paths can be checked for real.
