# Panel brief: desk health check (after the 6 Oct 2026 build day)

**Mel's answers (6 Oct 2026, night):** yes to all three: a Foundations step before Close the day, merged with Phase 1 of `2026-10-two-device-build-principles.md`, safety first ("especially the security reasons").

**Progress:**
| Part | State |
|---|---|
| Sample previews isolated (Fix lane) | Done (a56d6c2) |
| F3 Host / Origin guard (`server/guard.js` `localOnly`, tested) | Done |
| F2 Restart only once the new copy answers; else keep running and say so (`server/updates.js` `restartSelf`, `newCopyAnswers`; `/api/status` `update`, a note on the page); `npm ci` first when the add-on list changed (Phase 1 step 2, part) | Done; tried live both ways (a new copy that starts, one that crashes) |
| F1 A sample server (NOTION_TOKEN blanked) ignores .env's ROOM_DATA / BACKUP_DIR (`roomChoice`, tested) | Done |
| Phase 1 steps 1–4: `npm run check`, Node 22+ pinned, a complete `.env.example`, each look at GitHub reported (This Mac, a desk note when stuck) | Done 9 Oct (f211aac) |
| F4 origin ids, the day's `gone` record, `DESK_VERSION` 6 with a fixture per old version (with subtasks) | Done 8 Oct (f80fe52) |
| F5 an open day keeps one object (Undo after "Use theirs" saves); messages queue, problems announced | Done 9 Oct (2a7be0b) |
| F7 shared-folder tests, route round trips, backup → wipe → restore (`scripts/restore.js`, `docs/restore.md`) | Done 9 Oct (cf5b9bc) |
| F6 `server/index.js` → `server/routes/`; `ROOM_KINDS`; `public/events.js` checked; `page.js` → week / archive / sweep | Done 9 Oct (4326c28, 916fb43) |
| Phase 1 steps 5–7: bounded sweep + 1,100-day scale test, drawing save retired; two-Mac test; CLAUDE.md "Two Macs" rules, setup doc | Done 9 Oct |
| **Foundations complete.** Next: roadmap step 7, Close the day | |

**Request (as the problem):** About 37 commits built the desk in one day. Is it set up well enough (best practice, room to grow, capability) to carry Close the day, Routines, the weekly summary and Patterns without breaking or being rebuilt?
**Lane:** Large (an assessment, with no build) · **Seats:** Chair, Sceptic, Backend engineer, Frontend engineer, Data steward, Test lead (the last four each read the code on their own), Privacy and safety, Release keeper
**Gate:** worth it. The Learning Log's "polish ahead of plumbing" pattern applies: a day of features with nothing behind it to steady them.

## 1. Verdict
**Sound core, but reshape before the next features.** The careful parts are the right ones: the shared iCloud folder never treats a file that is still downloading as empty, saves are refused rather than trimmed, and the rules live once and are tested (115 tests). What's weak is the layer around them. The page has outgrown "one module, one job"; the server and the iCloud layer have no tests; history isn't recorded in a way Patterns can use; and there are two local-safety gaps. Recommendation: a **Foundations** step before roadmap step 7 (Close the day), merged with Phase 1 of the two-Macs brief, which overlaps it.

**Fixed tonight (Fix lane, a56d6c2):** five sample previews (`sample`, `sample-desk`, `sample-putea`, `sample-planner`, `sample-work`) were reading and could write Mel's real iCloud Hanua folder, because `.env`'s `ROOM_DATA` overrode their sample folder. That broke blocking condition 3 in spirit. Every sample config now sets `ROOM_DATA=data/room-sample BACKUP_DIR=off`. Checked: the real day file wasn't written after 17:00, and no line was added or ticked after that.

## 2. Premortem: it's three weeks later and Close the day / Patterns hurt. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Patterns couldn't say "carried 4 times", because a carried line gets a new id and sent lines vanish from their old day | Data steward | `origin` id + tombstones (F4) |
| 2 | An Undo after "Use theirs" quietly saved nothing | Frontend | Edits go through `state.js` by day key (F5) |
| 3 | One bad push took Hanua down on both Macs overnight | Backend / Release | Restart checks the new copy is up first (F2) |
| 4 | A preview or test wrote over a real day | Test lead | Fixed tonight; plus a start-up guard and a test (F1) |
| 5 | Each new feature took longer because `index.js` and `page.js` had to be untangled first | Backend / Frontend | Split them before step 7 (F6) |

## 3. What the panel found (verified against the code)
| # | Seat | Severity | Finding | Where |
|---|---|---|---|---|
| 1 | Test lead | **blocking (fixed)** | Sample previews used the real iCloud folder | `.claude/launch.json`, `server/index.js:101` |
| 2 | Backend | high | No Host/Origin check: a web page using "DNS rebinding" could read Hanua's data (money, calendar, desk) from `localhost` and send it saves, including `X-Hanua: restart` | `server/index.js` (no middleware; binds 127.0.0.1 at :754) |
| 3 | Backend / Release | medium | Self-restart exits after 300 ms whether or not the new copy starts. A boot error on `main` leaves Hanua down, unwatched on the mini | `server/updates.js:31-37` |
| 4 | Data steward | high (for Patterns) | Lines have no lasting identity: ids fall back to position, are renumbered on a clash, and `from` keeps only the day. `takeLines` / `clearDay` delete with no trace, so the archive *is* rewritten | `public/shared/desk.js:52, 260-292` |
| 5 | Frontend | high | `desk` means today in `agenda.js` but the page's day in `page.js` / `draft.js` (`import { page as desk }`). Edits go into a held object: after "Use theirs" or the other Mac's change, an Undo writes into a detached object and `saveDay` saves nothing without a word | `public/desk/state.js:29,131`; `page.js:11`; `draft.js:13` |
| 6 | Backend / Frontend | medium | `server/index.js` (769 lines, ~60 routes, six areas) and `public/desk/page.js` (526 lines, ~8 jobs) are past one job each. File kinds are hard-coded in three places (whiteboard/ clash copies already missed) | `server/room.js:118`, `public/shared/sync.js:40-44` |
| 7 | Test lead | high | No tests for `server/room.js` (409, 503, the write queue, placeholders), no route tests, no page-module tests, the backup tested as a copy only | `test/` |
| 8 | Data steward | medium | Restore has never been tried or written down. The backup keeps 30 days, so the live iCloud folder is the only long history (a deletion there reaches both Macs). Cloud-only files are skipped by the backup and the Archive with no warning | `server/backup.js:11,48`, `server/index.js:261` |
| 9 | Frontend | medium | 14 custom events as bare strings (three similar "day" ones); circular imports app ↔ planner ↔ page; drawing functions with side effects (a reload inside `renderTodo`) | see the event list in the appendix |
| 10 | Frontend | medium | Untested rules in page modules, some copied (`fixedOn` vs `planEntries` meeting ends, "now as HH:MM" ×3, `planFor`, `fitsToday`, `checkPlannedAhead`) | `page.js:363`, `agenda.js:16`, `draft.js:23` |
| 11 | Frontend | medium | One toast slot: the "other Mac" choice can be wiped by the next Undo; errors aren't announced as alerts; ~30 empty `catch` blocks, some with misleading text ("No earlier days yet" when the Archive failed to load) | `public/lib.js:92`, `page.js:295,311` |
| 12 | Data steward | medium | Plan vs actual is half recorded: no start time or real duration (the timer saves nothing), `plans` capped at 10, no versioned migrations (unknown fields dropped) | `desk.js:57,76,110` |
| 13 | Backend | low | History reads are sequential and uncached (7 files per day open, up to 31 for the week). Fine at a year; Patterns will want a small summary index | `server/index.js:270-283` |

**Done well (keep):** whole-file writes with a revision check that refuses with 409 and never treats "still coming" as empty (`server/room.js`); `DESK_VERSION` checked both ways; commands only ever through `execFile` with fixed arguments; rules in `public/shared/` with no page imports, well tested; two open days with their own revisions; storage wrapped in try; keyboard reorder.

Passes: Room designer, Experience designer (nothing visual changed), Guests.

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Do a **Foundations** step before Close the day? | **Yes.** About 2–3 sessions, mostly invisible. It saves rework in steps 7–10 |
| 2 | Merge it with Phase 1 of the two-Macs brief (`2026-10-two-device-build-principles.md`), which already has `npm run check`, a safe self-update and a two-Mac test? | **Yes, one brief.** They touch the same files |
| 3 | Order inside it: safety first (F1–F3), then data for Patterns (F4), then tidy (F5–F7)? | **Yes.** The urgent risks first; the tidy can slip if you want Close the day sooner |

## 5. Foundations, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| F1 | A server with no Notion key refuses a shared room unless told to; a test for it | `server/index.js`, `test/` | `npm test` |
| F2 | Restart: the new copy must answer `/api/status` before the old one exits, else the old one stays up and logs | `server/updates.js` | A broken main leaves the old Hanua running |
| F3 | Host / Origin guard (only `localhost` / `127.0.0.1:PORT`; non-GET needs a matching Origin) | `server/index.js` | A test with a foreign Host gets 403 |
| F4 | Lines get an `origin` id; sending / clearing leaves a marker instead of deleting; `DESK_VERSION` 6 with a fixture per old version | `public/shared/desk.js`, `test/` | "Times carried" is computable in a test |
| F5 | Edits by day key through `state.js` (`edit(key, fn)`); no `desk` / `page` aliases; queued toasts, alerts for errors | `public/desk/*`, `public/lib.js` | Undo after "Use theirs" saves |
| F6 | Split `server/index.js` into routers; one file-kind registry; split `page.js` (week, archive, sweep); rules moved to `shared/desk.js` with tests; event names as constants | server/, public/desk/, public/shared/ | Same behaviour, 115+ tests |
| F7 | Tests for `room.js` on a temp folder, route round-trips, a backup → wipe → restore round-trip; a written restore procedure | `test/`, `docs/restore.md` | `npm test`; the restore was tried once on the sample |

No `npm install`, no `.env` changes, no Notion changes.

## 6. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | the desk, Shared room folder and Panel rows (next action: Foundations) |
| 2 | Learning Log | "A day of features needs a foundations pass before the next layer" (a promotion candidate); "sample servers must name their own data folder" |
| 3 | Session Diary | "Panel: Large review; seats that caught something: Test lead (real data in previews), Backend (rebinding, restart), Data steward (line identity), Frontend (detached saves)" |

## Appendix: desk events
`hanua:plan`, `hanua:day-refreshed`, `hanua:day-saved`, `hanua:day-changed`, `hanua:desk-stale`, `hanua:backup`, `hanua:desk`, `hanua:room`, `hanua:settings`, `hanua:sync`, `hanua:focus`, `hanua:music`, `hanua:board`, `hanua:kitchen`. Who fires and who listens is in the Frontend seat's report (6 Oct 2026); it moves into code comments in F6.
