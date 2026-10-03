# Hanua: notes for Claude

A personal daily dashboard drawn as a room: a bookcase menu (Notion databases), a wall (monthly spending from Pūtea, a wall calendar, sticky notes) and a table (today's checklist, agenda, weekly spend). The owner runs it locally on a Mac.

## Workflow

- Do the work on a working branch. When a change is finished and tested, **also update `main`** (fast-forward it to the finished work and push). The owner has given standing permission for this. They pull `main` with GitHub Desktop.
- **Push it yourself.** The owner logged in GitHub's `gh` tool (4 Oct 2026) so Claude can push; they shouldn't need GitHub Desktop for it. Use it per command, without changing git config:
  `git -c credential.helper= -c "credential.helper=!$HOME/.local/gh/gh_2.102.0_macOS_arm64/bin/gh auth git-credential" push origin main` (and the working branch). If that fails, `gh auth status` says why.
- The owner isn't a developer. Explain steps in plain language, using numbered tables. If a change needs `npm install` or a new `.env` value, say so explicitly.
- Never commit `.env` (it holds the Notion and Claude keys).

## Hanua OS (the project brain, in Notion)

The reasoning behind Hanua lives in [Hanua OS](https://app.notion.com/p/3ee16603f0bd81be9dbec1188be4de79), built from the Brain Playbook. This file holds the routine; if the two disagree on routine, this file wins.

**Start of session:** read [Context](https://app.notion.com/p/3ee16603f0bd815e968dde7b28bc0adc), then [Decision Model](https://app.notion.com/p/3ee16603f0bd818a9baed25485c8a86d). Before any design or feature work, also read [Preferences](https://app.notion.com/p/3ee16603f0bd81a2a90fffb302346d6e), so the owner never has to repeat what they like.

**Close-out, before the session ends:**
1. Update the [Map](https://app.notion.com/p/cf1c0555321d4865b4cc354d21a58da4) row for every part touched (status, confidence, what it shows, reads from / writes to, code, next action). A new room, panel or data source gets a new row.
2. Follow the cascade table on the Decision Model for anything that changed (e.g. a renamed Notion column also means `config/areas.json`).
3. Add a [Session Diary](https://app.notion.com/p/e21cd4138c75477ebe3a75b1b3a229ad) row, linked to the Map rows touched. Never skip "Reasoning worth keeping".
4. A belief changed → a [Learning Log](https://app.notion.com/p/3ee16603f0bd8106b753c3be394efe0d) row. Then ask: would this change how a *different* system gets built, in a *different* domain? If yes, also add it to the Brain Playbook's Playbook Learning Log and mark the row Promoted.
5. A preference stated or something deliberately cut → Preferences (and its cut list). A new image → full-size original in `prototypes/room-dashboard/assets/`, resized copy in `public/assets/`, and a row in the image library.
6. At the end of every new room, run the promotion check (unpromoted Learning Log rows up; Playbook patterns not adopted, offered as proposals) and update Hanua OS's row in the OS Registry with the sweep date.

## Where we left off (4 Oct 2026)

Read this first if you're picking Hanua up in a new session or a different Claude account. Fuller context: the Hanua OS Context page and the latest Session Diary rows in Notion.

**Built and live:** the room (bookcase, wall, desk) plus, in order of the 4 Oct sessions: a TV with power button, remote and channels (overview / expenses / income); library view; Apple Music via the Music app (record player, now-playing controls); interactive calendar (hover preview, day window, month arrows, goals on their due dates); flip clock and date curved over the lamp; an ADO-style goals board (Epic > Feature > PBI > Task, Parent links, roll-up progress, Hierarchy and Board views, red-string threads, delete to Notion trash); a goal coach (outcome naming, Why, Done when, completeness test, Ask Claude, Ideas for missing children, sizing help, "how big did it feel"); a weekly review; coins and a treat shop; and the walnut top shelf (quick actions with hover labels, earnings in flip digits with targets and a ▾ digital panel, music controls, Feed as a ⌘S spotlight).

**Notion databases** (all on the "Hanua" page; each must be connected to the Hanua integration via ••• → Connections): the five books, Goals, Weekly reviews, Treat shop. Goals guide page: "Goals guide: Agile for life".

**Open items for Mel:** connect the Treat shop database if not done and add rewards; make `coin.png` in Canva (prompt in the 4 Oct session; drawn CSS coin until then, see `.coin` in `public/styles.css`); fill the Notion books and goals with real data; run Pūtea and check the TV's Expenses / Income field names (`server/money.js` guesses the payee field).

**Open questions from the first brief, never answered:** are the five books the right databases; is the purpose's draft "working sentence" right; keep or remove the count badges on the Work and Calendar spines.

**Testing:** `.claude/launch.json` has a `sample` server (port 3001, keys blank, sample data) for the browser preview; never test writes against the real Notion. Check 1440, 1024 and 375 widths.

**Pushing:** this Mac has GitHub's `gh` tool logged in (see Workflow). In a different account on the same Mac the push command still works; on a different Mac, `gh auth login` is needed once.

## Running and checking

- `npm start`, or `scripts/start.sh` (it backgrounds the server, then opens a new Safari window). `scripts/restart.sh` ("Restart Hanua.command") stops it and starts it fresh, for after an update. The owner also has a macOS Shortcuts shortcut, "Restart Hanua", with a keyboard shortcut, that runs `scripts/restart.sh`: after a change, tell them to use that. Port comes from `.env` (`PORT`), default 3000.
- Without keys, everything runs on sample data (`data/sample.json`, dates shifted to today) and sample money. Use that to check changes in a browser at desktop and phone widths before pushing.

## Layout

- `server/index.js`: Express API. `/api/areas` (Notion records per book), `/api/money` (Pūtea), `/api/areas/:id/records/:recordId/done` (tick a task), `/api/ask`, `/api/feed/draft` + `/api/feed/commit` (Claude drafts a Notion row; the user confirms before it's written), `/api/goals` (read, create, update rows in the Goals database; the pin board's dialog is the confirm step), `/api/records` (the record player's playlists).
- `server/notion.js`: Notion REST calls (API version 2022-06-28).
- `server/claude.js`: Claude calls (Anthropic SDK).
- `server/music.js`: controls the Music app on this Mac with fixed AppleScripts (`/api/music`, `/api/music/:action`, `/api/music/record`). Powers the now-playing strip by the greeting and the record player. Records start by library playlist name; a playlist not in the library opens in Music instead.
- `server/money.js`: reads Pūtea's read-only local API (`PUTEA_URL`, default `http://127.0.0.1:3456`). Pūtea lives in the separate `merlanomagah/putea` repo and syncs Akahu bank data.
- `config/areas.json`: one entry per book (Notion database ID and column names). The page uses `work` for tasks, `calendar` for events, `learning` for notes and `relationships` for people. A separate `goals` entry points at the Goals database (pin board); it is an ADO-style hierarchy (Level: Epic > Feature > PBI > Task, linked by Parent / Children); progress and effort roll up from children in `server/index.js` (`rollUp`), never stored. Its select options are mirrored in `public/app.js` (`LEVELS`, `GOAL_STATUS`, `GOAL_AREAS`).
- `public/coach.js`: the goal coach (per-level guidance, templates, soft checks such as outcome naming, a parent link, a why, a "done when", timeframe and size, WIP limit 3). The long version with sources is the Notion page "Goals guide: Agile for life" (`goals.guideUrl` in `config/areas.json`); keep the two in step. Goals have Why and Done when (acceptance criteria) fields; Description is shown as Notes. Planning a child shows the parent's why, done-when and existing children ("From the Epic"). `/api/goals/coach` asks Claude to review a goal and `/api/goals/ideas` to suggest missing children (both suggestions only, never write).
- Weekly review (goals board, `openReview` in `public/app.js`): five steps (wins, stuck, WIP, plan, try next), saved as a row in the Notion "Weekly reviews" database (`reviews` in `config/areas.json`, `/api/reviews`). Due 7 days after the last review; a wall note and a dot on the button say so. Goals get a `Completed` date when they move to Done (cleared if they move back) so the review can list the week's wins.
- Effort points: Tasks and PBIs only (Epics and Features add up children). Size picker (1, 2, 3, 5, 8, 13) and "Help me size it" (work, unknowns, waiting → `suggestSize` in `public/coach.js`), with the user's own finished goals at that size as the reference. When a sized goal moves to Done, "How big did it feel?" saves `Felt` (Smaller / About right / Bigger). The weekly review shows points finished, pace (average over the last 2–4 weeks, leaf goals only so nothing counts twice), planned vs usual, and a calibration line; it saves `Points` to the review.
- Coins and the treat shop: coins are never stored; they're worked out from finished goals by level (`shop.coinsPerLevel` in `config/areas.json`: Task 10, PBI 50, Feature 250, Epic 1,000; `coinsPerDollar` 10), never from effort points (that would corrupt sizing). Notion "Treat shop" database holds Reward rows (Mel's list), Bought rows (purchases) and Moved rows (real money Mel moved to her treat account; Hanua never moves money). The top shelf (`#topshelf`, sticky on every view) holds quick actions with hover labels (`data-tip`: home, desk, goals, library, Feed, music), the music controls (right), and earnings in the centre with a ▾ digital panel (`renderEarnings`: flip digits, rings vs target, last 8 weeks, Epics). The Feed is a spotlight on ⌘S / Ctrl+S (`openSpotlight`). Goals with a due date show on the calendar (`calendarItems`), which moves between months (`calOffset`). Goal cards have a hover × that moves the goal to Notion's trash after a confirm (`/api/goals/:id/delete`). Earnings for today / this week / this month with the planned target faintly underneath (`renderTopShelf`, `coinTotals`); the tin opens the shop. Planned = coins of goals due in the period plus anything finished in it; an Epic's target is its whole tree (`epicValue`), shown on Epic cards and in the shop. `queryArea` now pages through results; `limit` per area in `config/areas.json` (goals 1000).
- `config/records.json`: the record player's crate, one Apple Music playlist link per record.
- `public/`: the page (plain HTML, CSS and JS, no build step). It follows the Claude Design "Room Dashboard" handoff (Bula Collective palette).
- `public/assets/`: the room images (wall, desk, bookcase, objects), resized from the originals in `prototypes/room-dashboard/assets/` (same names). They were generated with Canva AI, so check licensing before making anything public.
- `prototypes/`: the product blueprint, an earlier 3D room prototype, and `room-dashboard/` (the Claude Design handoff for the current page, with full-size original images). For reference only; the page never loads from here.
