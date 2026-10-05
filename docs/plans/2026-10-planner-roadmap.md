# The planner roadmap: pending #11–18 in order

**Status:** order approved by Mel, 6 Oct 2026, with the interim backup. Each step still gets its own panel brief (with the Lifecycle check) before it's built; this file only sets the order. Tick a step off here when it's on `main`.

Sorted by what each item touches, so the saved day's shape changes once, `public/planner.js` is split before most edits land in it, and Settings comes once we know what's worth changing.

| Step | Batch | Items (CLAUDE.md "Start here") | Why here | Lane | State |
|---|---|---|---|---|---|
| 1 | Safety first | 18i long lines wrap, empty meeting time says "Time"; 11 version check (an old server or page refuses, never drops fields); interim nightly copy of `data/room/` to a private iCloud folder | Every later step changes the saved day; days live only on this Mac | Fix + Small | Done 6 Oct |
| 2 | Tidy the planner code | 17: split `planner.js` into page / To-do.txt / timer / agenda | Nearly every later batch edits it; no visible change | Small | Done 6 Oct (`public/desk/`) |
| 3 | The page's new shape | 18b drop Tasks to complete (old days still open), 18a time labels incl. Quick (10m), 18c fixed sections (General, Spark NZ, Jump issues), 12 record when (added/ticked, plan kept on Re-plan, carried tasks know their first day) | One change to `deskShape`, one migration, one set of tests | Medium | Done 6 Oct (`2026-10-planner-shape.md`) |
| 4 | Faster on the page | 18h multi-select and H/M/L then Tab; 17 Undo on the sweep, delete a meeting row; from step 3's Lifecycle: Move a line to another section, Undo for a cleared line | Builds on the new shape | Medium | Done 6 Oct (`2026-10-desk-arrange-and-lists.md`, `2026-10-desk-flow-and-notes.md`) |
| 5 | Desktop and Up next | 18d meetings both ways, 17 move a block by hand, 18g To-do.txt as a window only, 18f drag desktop icons | All in the desktop layer | Medium | Done 6 Oct (same briefs; plus arranging, Shopping list, reminders, the draft day) |
| — | The TV (#10) | Approved brief `2026-10-tv-channels-review.md` | Separate area; from Thu 8 Oct | Approved | |
| 6 | Settings | 18e: fixed sections, day hours, time labels, close times | After 3–5, once the settings are known | Medium | |
| 7 | Close the day | 13 (4 pm, reminder 7 pm) | Needs step 3's record | Medium | |
| 8 | Routines | 14 | Edited in Settings; needs the new shape | Medium | |
| 9 | Weekly summary | 15 into the Notion Weekly review, Mel confirms | Needs ~a week of closed days (mid-Oct) | Medium | |
| 10 | Patterns page | 16 | Needs 3–4 weeks of history (~early Nov) | Large | |
| — | Backup drive | 11: Time Machine + Archive volumes on the 2 TB drive | When the drive arrives | Setup | |
