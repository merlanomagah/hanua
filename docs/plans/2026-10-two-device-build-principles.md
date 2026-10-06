# Panel brief: two Macs, one way of building (Hanua and Pūtea)

> **Status (6 Oct 2026, evening): awaiting Mel's yes.** Question 1 is already answered: Mel chose the **Mac mini as Pūtea's home** and set Pūtea up there (fresh clone at b19443e, new keys); the Air's Pūtea was quit and its database copied (`~/Pūtea backup/2026-10-06-air/bills.db`, sqlite3 .backup, integrity ok, 4,740 transactions) to replace the mini's fresh one (4,709). Questions 2 (Tailscale) and 3 (phases) still open.

**Request (as the problem):** With two Macs (the MacBook Air, which also goes to work, and an always-on Mac mini at home), Mel needs everything to stay in step by itself, and every future Hanua and Pūtea change to follow firm rules so nothing breaks, nothing gets slow as history grows, and new parts fit in cleanly.
**Lane:** Large (both repos, the hosting of Pūtea, standing rules) · **Seats:** Chair, Sceptic, Daily-use coach, Experience, Data steward\*, Backend engineer\*, Test lead\* (\* read both repos independently), Privacy & safety, Release keeper, guest Money advisor. Pūtea's parts are built through Pūtea's own Money Panel.
**Gate:** worth it, smaller first: the rules are only worth having where a check enforces them, so this is a short list of principles, each with its check, plus the fixes the review found. Not a framework.
**Today:** Hanua shares its own data through iCloud Drive › Hanua (since this afternoon) and updates itself from GitHub; Pūtea runs on the Air only, installed by hand; Goals, Calendar and Reminders already match.

## 1. Verdict
Go, in three phases. The mini becomes the **home** (always on: it runs Pūtea, the nightly backups and anything scheduled); both Macs run Hanua; code is written on either, but only reaches either Mac through GitHub after an automatic check. The review found real gaps that would bite on the mini (below), so Phase 1 fixes them before the mini is set up.

## 1b. Premortem: it's three months later and this failed. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | The mini quietly stopped updating weeks ago (a new add-on, or main went different ways) and nobody knew | Backend | Installs before restarting; the update state is a desk note (principles 6, 7) |
| 2 | Pūtea ran on both Macs for a while: doubled bills in the calendar, two databases that disagree | Data steward | One home (the mini), a `HOST_ROLE` guard on everything scheduled, the Air's copy removed (principle 1) |
| 3 | Pūtea's database was lost or corrupted, with no copy | Data steward | Never in iCloud; a nightly `.backup` on the mini before the move (principle 2) |
| 4 | A fix made in a session on the mini never reached the Air (never pushed), or a rule known on one Mac was unknown on the other | Release keeper | Code only moves through GitHub after the check; shared knowledge in the repo or Notion (principles 5, 10) |
| 5 | The rules became a document nobody follows | Sceptic, Test lead | Only rules with a check behind them; the check runs before every release by itself (principle 5) |
| 6 | Hanua got slower every month | Backend | Bounded timers, a scale test (principle 8) |

## 2. What the review found (all checked against the code)
| # | Finding | Where |
|---|---|---|
| 1 | Hanua's self-update fetches new code but never installs new add-ons: a change that adds one would crash the mini on restart, and nothing brings it back | `server/updates.js` (only `scripts/start.sh` runs `npm install`) |
| 2 | The self-update can stop for good without telling anyone (a changed file in the folder, or main gone different ways): it only writes to a log nobody reads | `server/updates.js` `pullMain` |
| 3 | No pinned Node version: `start.sh` looks for a Node folder that doesn't exist on this Mac (it runs Node 24); Pūtea's setup expects Node 22 | `scripts/start.sh`, no `.nvmrc` / `engines` |
| 4 | The settings template lists 5 of the 18 settings the code reads (missing `ROOM_DATA`, `BACKUP_DIR` among them): a new Mac set up from it would miss them | `.env.example` |
| 5 | Pūtea's database must never go in iCloud (its WAL mode syncs as separate pieces and corrupts); its tokens are locked to each Mac's Keychain, so they're re-entered, never copied | `putea/src/main/services/database.ts`, `store.ts` |
| 6 | Pūtea on both Macs would pull the banks twice (Akahu refuses the second), put duplicate bills in 📈 Bills (each copy remembers its own events) and grow two different databases | `scheduler.ts`, `services/bills.ts` |
| 7 | Pūtea's database has no backup at all today (Hanua's backup deliberately skips it, "Time Machine once the drive is in") | `hanua/server/backup.js` |
| 8 | Pūtea's setup instructions point at another Mac's user and folder (`/Users/merllissiamanueli/Bill Manager`) | `putea/CLAUDE.md` |
| 9 | Pūtea has no automatic checks; Hanua has tests but nothing runs them before a release (fast-forwarding main is the release) | both `package.json` |
| 10 | Things that grow with history: the shared-folder sweep looks at every day file every 20 s on both Macs; the archive lists the whole folder each time | `server/room.js` `scan`, `/api/desk/days` |
| 11 | The old drawn-menu route still writes pictures without a version check (drawing was cut 5 Oct) | `server/index.js` `PUT /api/board` |
| 12 | The repo once lived in iCloud Desktop & Documents; `.env` sits in `~/Documents/GitHub`, so that setting must stay off on both Macs | Claude's project folders |

## 3. The build principles (each with what enforces it)
| # | Principle | Enforced by |
|---|---|---|
| 1 | **One home, one writer.** Every kind of data has one home and one writer, written in the Map. Anything scheduled that writes data or calls a bank runs on the mini only | Map rows; `HOST_ROLE=home` in the mini's `.env`, checked by Pūtea's scheduler and Hanua's backup |
| 2 | **iCloud holds plain files only:** JSON and pictures. Never a database, `.env`, PIN, token or temp file | the shared-folder code refuses anything else; setup doc |
| 3 | **Hanua's own data goes through `server/room.js`:** whole writes, a version on every save, an older Hanua never saves over a newer file, "can't read it yet" is never "empty" | `npm run check`: only allow-listed files write to disk |
| 4 | **Hanua points at Pūtea; it never keeps money data.** It reads Pūtea's read-only address (`PUTEA_URL`), and money still hides at work and asleep | existing tests + Money seat |
| 5 | **Code moves one way:** a branch → `npm run check` → `main` → GitHub → both Macs update themselves. Never build in a running folder, never force, never leave finished work on one Mac only | `npm run check` before every release; CLAUDE.md "Two Macs" rules; self-update refuses anything but a fast-forward |
| 6 | **Nothing fails silently.** Every background job (self-update, backups, the shared folder, Pūtea's pulls) reports its state, and a problem becomes a desk note | `/api/status` and `/api/sync` keys, tested |
| 7 | **Same tools on both Macs:** one pinned Node version; a change to the add-on list installs (`npm ci`) before anything restarts | `.nvmrc` + `engines`; the updater; `start.sh` warns on a mismatch |
| 8 | **Nothing scans the whole history on a timer.** Timed work looks at recent days only; older ones are read on demand | a test with 1,000 day files counts what the sweep touches |
| 9 | **Every setting is written down, and said out loud for both Macs.** Every setting the code reads is in `.env.example`; a change that needs a new value ends with the exact line to add on **both** Macs; the master copy of `.env` lives in Apple Passwords | `npm run check` compares the code against `.env.example` |
| 10 | **Shared knowledge lives where both Macs read it:** the repo (CLAUDE.md, docs) or Notion, never only one Mac's Claude memory or browser storage (that's for view settings like layout) | close-out routine; Claude's memory notes moved into CLAUDE.md / Preferences |
| 11 | **A fresh Mac must work from the written steps.** No hard-coded user folders in setup docs; after any setup or add-on change, a clean copy is installed and started in a temp folder | a fresh-clone check script (weekly / after setup changes, not every commit) |

## 4. Questions for Mel (at most 3)
| # | Question | Recommendation |
|---|---|---|
| 1 | Should **Pūtea move to the Mac mini** (its only home)? This reverses this afternoon's "stays on the Air for now" | **Yes, in Phase 2.** The mini is always on, so the 7:00 / 12:30 / 17:30 / 20:30 bank pulls never slip; one database, one writer of 📈 Bills. On the Air, Hanua shows the money from the mini; changes in Pūtea itself (Mark Paid, Setup) are made on the mini (or by Screen Sharing to it) |
| 2 | Install **Tailscale** (free) on both Macs? | **Yes.** Pūtea only answers on its own Mac; Tailscale gives the Air a private, secure route to the mini (your devices only, never the public internet), at home and at work. It also brings Touch ID back for anything served over it |
| 3 | Build in **phases**? | **Yes:** Phase 1 (Hanua's guardrails) before you set up the mini; Phase 2 (Pūtea moves) when you're at the mini with time; Phase 3 (scale) only if the check shows a need |

## 5. Lifecycle (of "a change" across two Macs)
| Verb | |
|---|---|
| Add | Built on a branch on either Mac, in a worktree, never in the running folder |
| See | `main` on GitHub; each Mac's Hanua says which version it runs and whether it's up to date (Settings → Desk) |
| Change | A fix is just another change, same path |
| Remove + Undo | A bad release is undone by a new commit (never a force); the previous version is one revert away; the mini stays on the old code if an install fails |
| Bulk | Several changes can land together; the check runs once on the lot |
| Close out | The Notion close-out records which Mac the session ran on |
| Record | Git history; Session Diary; the Map's one-writer column |
| Day 30 | The checks hold the line; principles that never catch anything after a few months get cut (like the panel's seats) |

## 6. Build plan
**Phase 1: Hanua (this repo), before the mini is set up**
| # | Step | Files |
|---|---|---|
| 1 | `npm run check`: tests, syntax of every server file, settings template vs code, `public/shared` imports nothing from the page, only allow-listed files write to disk; prints "run `npm ci` on the other Mac" when the add-on list changed | `package.json`, `scripts/check.js` |
| 2 | Self-update installs on an add-on change (`npm ci`) before restarting, stays on the old code if that fails, and reports its state (last check, behind/ahead, blocked and why) → desk note | `server/updates.js`, `/api/status`, `public/updates.js` |
| 3 | Pin Node (`.nvmrc`, `engines`); `start.sh` finds Node properly and warns on a mismatch | `.nvmrc`, `package.json`, `scripts/start.sh` |
| 4 | Complete `.env.example` (all 18, with one-line notes) | `.env.example` |
| 5 | Bounded sweep (recent 14 days + top files) and a cached day list; retire the old drawn-menu write route | `server/room.js`, `server/index.js` |
| 6 | Two-Mac test as a script (two servers, one temp folder) run by `check` when shared-folder code changes; point the test configs at the repo | `test/`, `.claude/launch.json` |
| 7 | CLAUDE.md "Two Macs" rules (the 11 principles, short); Claude's memory notes moved into CLAUDE.md / Preferences; setup doc updated (one way to install Node, Tailscale, Desktop & Documents off, `HOST_ROLE=home`) | `CLAUDE.md`, `docs/setup-mac-mini.md` |

**Phase 2: Pūtea (its repo, through the Money Panel), at the mini**
| # | Step |
|---|---|
| 1 | Fix the setup instructions (no hard-coded user folders); `npm run check` (type check + build) |
| 2 | A nightly copy of the database on the mini (`sqlite3 .backup`, never a Finder copy), last 30 kept, a warning if it fails: **before** the move |
| 3 | `HOST_ROLE` guard: scheduled pulls, calendar writes and reminders only run on the home Mac |
| 4 | The move: database copied with `.backup`, built and signed on the mini, tokens re-entered (Akahu, Gmail), Calendar helper allowed; then Pūtea removed from the Air's login items and Applications |
| 5 | The Air's Hanua reads the mini's Pūtea through Tailscale (`PUTEA_URL`, a slightly longer wait); money still hides at work |

**Phase 3: only if needed**: a scale probe (3 years of days generated in a temp folder, timings); past years moved into `desk/2026/` folders if the archive slows; the principles offered to the Brain Playbook.

**Mel will need to:** install Tailscale on both Macs (Phase 2), re-enter Akahu and Gmail on the mini (Phase 2), keep a copy of `.env` in Apple Passwords. No new keys.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm run check` passes on the current code, and fails on purpose (a stray disk write, a missing setting, a page import in shared) | run it, then break each rule on a scratch branch |
| 2 | Self-update with a new add-on | a test repo: a commit that adds a package → installs, then restarts; a failing install → stays on old code, desk note |
| 3 | Diverged main → desk note, never a force | `test/updates.test.js` |
| 4 | Sweep with 1,000 day files touches ≤ 40 | test |
| 5 | Two-Mac script | the existing sync cases, scripted |
| 6 | Fresh clone in a temp folder starts with blank keys | script |
| 7 | (Phase 2) Pūtea on a database copy, test port; Hanua reading it through `PUTEA_URL`; the money hides at work | Money Panel's own test plan |

## 8. Close-out
Map (a "one writer / host" note on each data row; Pūtea's row moves to the mini in Phase 2), Decision Model (the principles as a short section; cascade rows for "new setting", "new background job", "new kind of data"), Context, Preferences ("Mel doesn't do technical chores" stays true: the checks run themselves), Session Diary with the "Panel:" line, Learning Log, and the principles offered to the Brain Playbook (they'd apply to any personal tool on two devices).
