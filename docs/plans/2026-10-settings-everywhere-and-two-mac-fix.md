# Panel brief: Hanua Settings on the rail, and the two Macs in step

**Mel's answers (8 Oct 2026):** yes / yes / yes: Part A first (done, 05be1e3); all five groups plus Appearance and Calendar moved into Hanua Settings; the Mac mini backs up. Also: the dock's gear redrawn as a cog (it read as a sun). The desk keeps its own Settings (Mel: desk settings belong on the desk).

**Request (as the problem):** Mel can't change the things she'd expect to change herself (Touch ID, her PIN, the sleep timer, the lights, the clocks, the calendars shown) without asking Claude or editing a file. The desk has its own Settings (right for desk things), but there is no Settings for Hanua as a whole. Also: her Mac mini didn't show the days she planned on the Air, so she couldn't close off yesterday or see the week.
**Lane:** Large · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward (agent), Frontend engineer (agent), Test lead (agent), Privacy and safety, Release keeper
**Gate:** worth it, as two parts. Part A (the two Macs) is a Fix of a silent failure and goes first. Part B (Settings) serves the "Mel changes her own settings" preference (6 Oct) and repeated open items ("which Apple calendars to show" has been asked since 5 Oct; "BACKUP_DIR=off on the Air" since 6 Oct), so it's worth it, kept to settings for things that exist.
**Today, outside Hanua:** Mel asks Claude, or edits `.env` by hand (she isn't meant to do technical chores), or deletes a file to reset her PIN. On the Mac itself she uses System Settings: one gear, sections down the side, everything there.

## 0. What was found on the Mac mini (8 Oct, read-only checks)

| # | Finding | What it meant |
|---|---|---|
| 1 | The mini's `.env` came from the blank template (`.env.example`): `NOTION_TOKEN`, `ANTHROPIC_API_KEY` and `WEATHER_PLACE` are empty; `ROOM_DATA` (the shared iCloud folder) is set | The setup doc's step 6 (AirDrop the Air's `.env`) was missed or used the template |
| 2 | `server/guard.js` `roomChoice` treats a blank Notion key as "this is a test copy" and ignores `ROOM_DATA` | The real Hanua on the mini used the test folder `data/room-sample`, and said so only in its log |
| 3 | A second fallback: `server/index.js:111` picks `data/room-sample` whenever there's no Notion key and no folder | Fixing one rule alone would leave this hole |
| 4 | Today's real day (your two focuses), the plant's log, and two nights' backups went to the test folders; iCloud has 5–7 Oct only | Nothing was lost, but it's stranded on the mini |
| 5 | Settings → Desk said "kept on this Mac only": true, but it didn't say *why* | The page never said anything was wrong |
| 6 | The mini has Touch ID (Magic Keyboard with Touch ID, Touch ID on in macOS); the sleep screen's PIN file isn't affected by #2 | The missing Touch ID note has another cause (most likely the three offers used up, or one failed setup, which stops the offers for good: `public/lock.js:53`). The note is the only way in today |

## 1. Verdict
**Reshaped into two parts, A first.**
**A (today, a Fix):** whether Hanua is "the real one" is decided by how it was started (`scripts/start.sh` says so), never by a missing key. A real Hanua with a missing key keeps your shared folder and **says** what's missing. Your stranded day is brought across, with you choosing where the two Macs differ.
**B (after your yes):** a new **Hanua Settings** for the whole room, opened from a **gear on the top rail** (and ⌃,) from the wall, kitchen, goals board or desk. The desk's own Settings stays in the dock for desk things (Planner, Focus timer, Lists, Desk). Hanua Settings holds **Sleep screen** (Touch ID set up / turn off, change PIN, sleep after), **Room** (lights off / on times, the three away clocks, greeting languages), **Calendars** (which Apple calendars show, and which count as Work), **Weather** (your town), **Appearance** and **This Mac** (what this Mac is connected to, and whether it backs up). Every setting says whether it's **Both Macs** or **This Mac only**.

## 2. Premortem
Three weeks later this failed, or Mel stopped using it. Why?

| # | Why it failed | Seat that owns it | What this brief does about it |
|---|---|---|---|
| 1 | The mini slipped back to sample data after a new install or a lost key, and nobody noticed for days | Data steward, Test lead | A: the real/sample rule by how Hanua was started; a loud note on the desk and a "This Mac" panel in Settings; tests for every combination, including the mini's exact case |
| 2 | Two Settings windows, and she opened the wrong one for what she wanted | Sceptic, Experience designer | A clear split: the desk's Settings is about the desk's files and widgets; Hanua Settings is everything else. Each window's foot says what the other holds, with a link to open it. Only items Mel asked for or keeps asking about (§5) |
| 3 | She changed the lights on the Air and was surprised the mini changed too (or the other way round) | Experience designer, Data steward | Every group is labelled Both Macs / This Mac only; the rule: anything about her day is shared, anything about this screen or keyboard is this Mac only |
| 4 | The Mac still on older code saved Settings and wiped the new groups on the other Mac | Data steward, Test lead | Unknown groups are kept as they are; a version guard refuses saves from an older Hanua (like the planner's `DESK_VERSION`); one group saved at a time |
| 5 | Touch ID was "on" but didn't come up in Safari, so she thought it was broken | Frontend engineer, Daily-use coach | The Sleep screen group says plainly what this Mac can do, has Set up / Try it / Turn off, and the PIN always works |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go, as A then B | A is losing a day's work right now; B reuses the desk Settings' pattern (Being tested since 6 Oct), so nothing is built on an Assumed part. Mel, 8 Oct: the desk keeps its own Settings; Hanua Settings is separate, on the rail |
| 2 | Sceptic | reshape | Don't expose everything. Coins per level would rewrite every past total; planner gaps and breaks are maths, not taste; Close the day times wait until Close the day exists |
| 3 | Daily-use coach | go | Settings is visited rarely; what matters daily is Touch ID actually waking Hanua. The lights' times are her own bedtime habit (she chose 4 am on): let her own it |
| 4 | Experience designer | go | One gear on the rail, like the Mac's; Esc closes, focus returns to the gear that opened it; every reset has Undo; the PIN asks for the current one; at work, the Sleep screen group still shows |
| 5 | Room designer | go | The rail gear is the same ink icon as its neighbours; the window is a Mac thing (rounded, goes dark with the Mac); fit one more icon at 375 px; no new images |
| 6 | Data steward (agent) | reshape: A before B | Two leaks (`roomChoice` and `index.js:111`). Real = started by `start.sh` (`HANUA_MAIN=1`, already passed through every self-restart); test configs say `HANUA_SAMPLE=1`; a test copy can never use an iCloud folder. Keys and `ROOM_DATA` never editable from the page. The PIN stays per Mac, outside iCloud and the backup |
| 7 | Frontend engineer (agent) | reshape: not a modal | The desk's Settings lives inside the desk pane, hidden elsewhere, so Hanua Settings is its own window in a page-level layer (reusing the desk's window bar and the same group and row pattern). Not a modal dialog: that would block the Undo toasts. Not remembered each morning, no minimise (no dock on the wall). The Touch ID offer is the only way in today, and it stops for good after one failure |
| 8 | Test lead (agent) | go, A first with its tests | Today's tests *lock in* the bug (they say "blank key = test copy"). One pure function decides the folder; a test reads every launch config; lock tests on temp files only; Touch ID tried with a stand-in in the preview, then by Mel on each Mac |
| 9 | Privacy and safety | go | Keys never shown, only "set / not set". Changing the PIN needs the current PIN checked by the server (wrong tries count toward the 5-try pause); Touch ID alone can't change it (the server can't verify Touch ID). Settings opens behind the sleep screen, never over it |
| 10 | Release keeper | go | A ships alone, today. You copy the keys into the mini's `.env` yourself (secrets). No `npm install`, no new `.env` value |

Passes: none.

## 4. Questions for Mel (at most 3)
| # | Question | Recommendation |
|---|---|---|
| 1 | Do Part A now, before the Settings work (with you choosing on any day that differs between the Macs)? | **Yes.** It's a Fix; it brings back today's page and makes sure it can't happen quietly again |
| 2 | The groups in §5 (Sleep screen, Room, Calendars, Weather, This Mac), plus moving **Appearance** and **Calendar → new events go in** out of the desk's Settings into Hanua Settings, since they're about the whole room? | **Yes to all**, nothing from the "leave fixed" list. The desk's Settings keeps Planner, Focus timer, Lists and Desk |
| 3 | Which Mac backs up the shared folder each night? (A switch in This Mac; today it's `BACKUP_DIR` in `.env`, which is why "turn the Air's backup off" has been on your to-do since 6 Oct) | **The Mac mini** (it's always on). The Air's switch goes off from Settings, no file editing |

## 4b. Lifecycle
| Verb | For a setting |
|---|---|
| Add | Hanua's own (Mel doesn't create settings); new ones arrive only with the feature they control |
| See | Hanua Settings: the rail gear or ⌃, from anywhere. Desk settings: the dock gear, as today. Each window points to the other; each group says Both Macs / This Mac only |
| Change | Applies at once, says "Saved"; a clash with the other Mac says so and asks (today's 409 path) |
| Remove (+ Undo) | Each group's "Back to Hanua's defaults" with Undo; Touch ID's Turn off has Undo (the passkey stays in the Mac's keychain); PIN: no default; Forget PIN asks for the current PIN, and a forgotten PIN still uses Reset Hanua PIN.command (explained in the group) |
| Bulk | Not needed (per group is enough) |
| Close out | Not needed |
| Record | Shared settings live in the iCloud folder and the nightly backup; This Mac settings in that Mac's browser; the PIN hash never leaves `data/lock.json` |
| Day 30 | Rarely opened, which is fine. The test: has Mel stopped asking Claude to change these things? The panel adds a setting only with a feature |

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| **A1** One rule for real vs test copy (`server/guard.js`): real = started by `start.sh`; test copies carry `HANUA_SAMPLE=1` and can't use an iCloud folder | Editing keys or `ROOM_DATA` from the page (a page that can rewrite keys is a bigger risk than a file edited once per Mac) |
| **A2** A real Hanua with a missing key keeps the shared folder, logs it loudly, and puts a desk note "This Mac has no Notion key" | |
| **A3** `/api/sync` and Settings say *why* a Mac isn't shared | |
| **A4** Bring the stranded day and plant log across: a list of what differs, you choose; nothing in iCloud overwritten silently; the test folder kept until you say | Deleting `data/room-sample` (only on your word) |
| **A5** Tests: every combination incl. the mini's case; every launch config checked; `docs/setup-mac-mini.md` says "copy the Air's `.env`, not the example" | |
| **B1** **Hanua Settings**, a new window in a page-level layer: rail gear `#ts-settings` and ⌃,; not modal (Undo stays clickable); not reopened each morning; a link to the desk's Settings at its foot (and the reverse) | Merging the two windows (Mel: desk settings belong on the desk). Settings as a separate screen or room |
| **B2** **Sleep screen** (This Mac only): Touch ID status (sensor or not) with Set up / Turn off; Change PIN; Forget PIN; Sleep after 5 / 10 / 15 / 30 / 60 min | The wrong-PIN pause (5 tries / 30 s): safety, not taste. Touch ID changing the PIN (can't be checked by the server) |
| **B3** **Room** (Both Macs): lights off / on times (now 9 pm / 4 am), the three away clocks (city + time zone; now Sydney, Suva, Los Angeles), greeting languages on/off | Greeting speed, the canary (its door is the off switch), coins per level (would rewrite past totals) |
| **B4** **Calendars** (Both Macs): which Apple calendars show and which count as Work, ticked from your real calendars (`.env` stays the fallback) | |
| **B5** **Weather** (Both Macs): your town (`.env` stays the fallback) | |
| **B6** **This Mac**: Notion / Claude / Pūtea connected yes-no, room folder "iCloud: Hanua" or "this Mac only (why)", backup on/off and when it last ran | Showing the keys themselves |
| **B7** Appearance and Calendar (new events go in) move from the desk's Settings into Hanua Settings unchanged; at narrow widths (the rail hides ☾ and the bookcase switch) Hanua Settings is the way in. The desk's Settings keeps Planner, Focus timer, Lists, Desk | Close the day times (when Close the day is built, they go in the desk's Settings), Routines |
| | Planner gaps and breaks, WIP limit, weekly review every 7 days, done goals hide after 14, backup time and count, update checks: Hanua's rules, not preferences. Earned by Mel asking for one |

## 6. Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | **A1–A3** one pure `roomChoice(env, fileEnv, isMain)` returning folder, backup, sample and why; `index.js` keeps no logic of its own; loud log; desk note; `/api/sync` `why` | `server/guard.js`, `server/index.js` (:105–112, :316–321), `public/shared/sync.js`, `public/desk/settings.js` `sharedLine` | Tests rows 1–3 pass |
| 2 | `HANUA_SAMPLE=1` in every sample config; Air-only paths in `sample-work` / `sync-a` / `sync-b` made relative | `.claude/launch.json`, `test/launch.test.js` | Row 2 passes |
| 3 | Release A (fast-forward `main`; the mini restarts itself) | | `/api/sync` on the mini says shared once the keys are in |
| 4 | **A4** recovery: copy everything first, dry-run list, Mel picks, write through `room.write` | a one-off script in `scripts/`, run by Claude | Today's page is in iCloud; the Air shows it |
| 5 | Settings rules: keep unknown groups, version guard, save one group at a time; new groups `room`, `calendars`, `weather`, `sleep.after` with defaults and limits | `public/shared/settings.js`, `server/index.js` (:242–263), `test/settings.test.js` | `npm test` |
| 6 | PIN: `changePin` / `forgetPin` behind the current PIN; `/api/lock/change`, `/api/lock/forget` | `server/lock.js`, `server/index.js` (:93–99), `test/lock.test.js` (temp files) | Row 6 |
| 7 | New `#hanua-settings` window in a page-level layer (the desk's `#settings-win` stays where it is); rail gear and ⌃,; focus back to the gear; redraw on `hanua:focus`; the shared `group` / `row` helpers moved out of `desk/settings.js` so both windows use them; Appearance and Calendar groups moved across | `public/index.html`, `public/styles.css`, `public/settings/*.js` (new), `public/desk/settings.js`, `public/desk/window.js`, `public/rail.js` | Opens from wall, kitchen, board, desk; the desk's Settings unchanged apart from the two moved groups |
| 8 | Groups as small modules: Sleep screen (`lock.js` exports `touchAvailable`, `setUpTouch`, `forgetTouch`, a setter for sleep-after), Room (lights hours into `lastLightSwitch`; clocks from settings), Calendars, Weather (server reads settings over `.env`), This Mac | `public/settings/*.js`, `public/lock.js`, `public/app.js`, `public/shared/dates.js`, `server/calendar.js`, `server/weather.js`, `server/backup.js` | Each applies at once and has Back to defaults + Undo |
| 9 | Exit check, release B, close-out | | §7 and §8 |

Needs `npm install`? **No.** New `.env` value? **No** (`HANUA_SAMPLE` is only in the test configs). **Mel's own step for A:** copy the Air's keys into the mini's `.env` (Notion, Claude, weather town). No Notion changes.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | Every real/test combination, including the mini's exact case (started by `start.sh`, blank key in `.env`, `ROOM_DATA` set → shared folder) | `npm test`, `test/guard.test.js` |
| 2 | No test config can reach real data; `start.sh` still marks the real one | `npm test`, `test/launch.test.js` |
| 3 | The "why not shared" sentence; Settings shows it | `npm test`; preview on `sample` |
| 4 | On the mini after A: shared; a line added on one Mac shows on the other within a minute, both ways | Manual, both Macs |
| 5 | Recovery list matches; nothing newer in iCloud overwritten | Copies first, Mel confirms |
| 6 | PIN set / change / wrong current PIN / pause after 5 / forget | `npm test`, `test/lock.test.js` |
| 7 | PIN change in the browser; the real `data/lock.json` untouched | `sample-fresh` preview, timestamps before/after |
| 8 | Touch ID set up / turn off / Undo / offers stop nagging | Preview with a stand-in for WebAuthn; rules in `npm test` |
| 9 | Real Touch ID wakes Hanua on each Mac | Mel |
| 10 | Hanua Settings from wall, kitchen, board, desk; Esc; focus returns; the links between the two windows; ⌃L puts the sleep screen on top and no digits leak | Preview at 1440 / 1024 / 375, lights on and off, dark mode |
| 11 | The desk's Settings still opens from the dock, restores as before, and has no empty groups after the move | Preview with old browser storage seeded |
| 12 | Timer, calendar default, lights, clocks update after a change, and after a change from the other Mac | Preview + `sync-a` / `sync-b` |
| 13 | At work: Sleep screen and This Mac still show; nothing personal in Calendars at work | Preview |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | Settings, Sleep screen, Shared room folder, Wall clocks, Lights, Weather window, Apple Calendar |
| 2 | Cascade | `.env` → Settings fallbacks noted in CLAUDE.md; `docs/setup-mac-mini.md` |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Learning Log | "A missing key must never change *where* data is kept; real vs test is decided by how it was started" (the 6 Oct rule protected the test side and opened the real side) |
| 5 | Preferences | "Mel changes her own settings" row: from the rail, the five new groups, Both Macs / This Mac only |
