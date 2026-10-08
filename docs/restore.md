# Getting the room back from a backup

The room (planner days, menus, stickies, the plant, Settings) lives in iCloud Drive › **Hanua**, shared by both Macs.
Every night the Mac mini copies it to **Hanua backup** in its home folder (outside iCloud, so a wiped file can't
spread into the copies). The last 30 nights are kept. Hanua Settings → This Mac says when the last one ran.

## When to restore

Only when something in the room is wrong on both Macs and Undo can't fix it: a day emptied, the folder deleted,
settings scrambled. One wrong line is quicker to fix by hand.

## The steps (ask Claude to do them with you)

| # | Step | How |
|---|---|---|
| 1 | Stop Hanua on **both** Macs | Double-click **Stop Hanua** in the hanua folder (or `bash scripts/stop.sh`) on each Mac. A running Hanua could save over what's put back |
| 2 | On the Mac mini, see the backups | `node scripts/restore.js` in the hanua folder: the nights there are, newest first |
| 3 | Pick the night before things went wrong, and look first | `node scripts/restore.js 2026-10-08`: says how many files it would put back and where. Nothing changes |
| 4 | Restore | `node scripts/restore.js 2026-10-08 --yes`. What's in the room folder now is **moved aside, not deleted** (to "Hanua before restore <time>", beside it), then the backup is copied in |
| 5 | Wait for iCloud | Give iCloud a minute to send the restored folder to the other Mac (Finder shows the cloud icons settle) |
| 6 | Start Hanua again on both Macs | **Start Hanua** (or `bash scripts/start.sh`). Check yesterday's page in Plan my day's Archive |
| 7 | Tidy up later | Once happy (a few days), the "before restore" folder can go to the Bin |

## Notes

- Restoring puts back the whole room as it was that night: anything written since is in the "before restore"
  folder, so a single day can be copied back from there if needed (ask Claude).
- Pūtea's database is separate (its own backup, on the mini) and isn't touched by this.
- Tried on test data on 9 Oct 2026 (`test/shared-folder.test.js` checks backup → wipe → restore every time
  `npm test` runs).
