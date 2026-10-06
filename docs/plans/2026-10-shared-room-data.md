# Panel brief: one set of days, meals and stickies on both Macs

**Request (as the problem):** Mel's daily tasks, meals, stickies, plant and desk Settings lived only on her MacBook Air, so the Mac mini couldn't see or change them. (Goals are in Notion; Calendar and Reminders are iCloud: those already matched.)
**Lane:** Large · **Seats:** Chair, Sceptic, Daily-use coach, Experience, Data steward\*, Backend engineer\*, Test lead\* (\* read the code independently), Privacy, Release keeper
**Gate:** worth it, option A (each Mac runs its own Hanua; `ROOM_DATA` points both at one iCloud Drive folder). Set aside: the Mac mini as the one server (always on, server-side lock, Tailscale for work), and moving the data into Notion (larger; still possible later).
**Approved by Mel 6 Oct 2026 with all three recommendations:** the Mac mini backs up nightly (to its own disk, the Air stops); on a clash Hanua shows the newer version and asks "use theirs / keep mine"; Pūtea stays on the Air for now.

## Premortem
| # | Why it failed | What was built |
|---|---|---|
| 1 | A day went blank on both Macs: iCloud hadn't brought the file down, Hanua read it as empty and saved over it | `server/room.js` tells missing / still coming / unreadable apart (503 for the last two, `brctl download` asked); the page saves nothing until the day has really been read (`canSave` in `desk/state.js`) |
| 2 | A tick on one Mac was undone by the other saving its older copy | Every GET returns `rev` (a hash of the file), every save sends `base`; the server refuses (409 `conflict: "other-mac"`) if the file changed since; the page offers Use theirs / Keep mine (toast with two choices) |
| 3 | Changes took ages to show | The server watches the folder (file events + a 20 s sweep) and pushes changes to open pages (`/api/events`, `public/sync.js`); each part fetches again unless Mel is typing there; "Updated from your other Mac", at most once a minute |
| 4 | The Mac mini ran last week's Hanua and dropped new fields | Hanua fetches main from GitHub every 5 min and fast-forwards (clean tree on main only), then restarts itself; a day file keeps the `v` that wrote it and an older Hanua refuses to save over it; `DESK_VERSION` 5 |
| 5 | iCloud's clash copies hid a day's edits | Found (`* 2.json`) and named in a desk note and in Settings → Desk; never merged or deleted without Mel |
| 6 | The Macs fought over the backup | With a shared folder the backup goes to that Mac's own disk (`~/Hanua backup`); the Air sets `BACKUP_DIR=off` once the mini runs; placeholders and temp files skipped |

Also: whole writes (temp file + rename), one at a time per file; stickies merge by id with the later `edited` winning (taken-down notes kept); the plant's waterings add up; Settings re-read when the file changes (no more stale copy in memory); a missing shared folder is never recreated empty (nothing saves; desk note). Rules in `public/shared/sync.js`, tested in `test/sync.test.js`.

## Tests
`npm test` (107). Two sample servers sharing one temp folder (`.claude/launch.json` `sync-a` 3051 / `sync-b` 3052, backups off, no Notion, no Apple): two new-day saves (second refused), stale save refused with the current copy, old page told to reload, newer file refused, placeholder never read as empty or saved over, clash copy reported (desk note, Settings line); live refresh A ← B for the day (focus post-it too), stickies, Settings (timer), menu; the clash choice in the page (Use theirs, then a clean save); plant waterings from both add up; missing folder: reads and writes refused, warning; a plain single-Mac server unchanged.

## Setting up
`docs/setup-mac-mini.md`.
