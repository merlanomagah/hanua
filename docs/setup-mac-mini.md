# Hanua on a second Mac (the Mac mini)

Both Macs run their own Hanua and share one iCloud Drive folder, **Hanua**, for the planner days, menus, stickies, plant and Settings (brief: `docs/plans/2026-10-shared-room-data.md`). Goals (Notion), Calendar and Reminders (iCloud) already match on both.

## On the MacBook Air (done by Claude, 6 Oct 2026)
1. `data/room` copied into iCloud Drive › Hanua; the old folder renamed `data/room-migrated-2026-10-06` (kept for a few weeks).
2. `.env` has `ROOM_DATA="~/Library/Mobile Documents/com~apple~CloudDocs/Hanua"`.
3. Until the Mac mini runs Hanua, the Air backs up to `~/Hanua backup`. Once the mini is up: add `BACKUP_DIR=off` to the Air's `.env`.

## On the Mac mini (Mel, with Claude's help)
| # | Step | How |
|---|---|---|
| 1 | Same Apple ID, iCloud Drive on | System Settings → your name → iCloud → iCloud Drive |
| 2 | Keep the Hanua folder downloaded (on **both** Macs) | Finder → iCloud Drive → right-click **Hanua** → **Keep Downloaded** |
| 3 | Install Node.js | nodejs.org → the LTS installer (.pkg) |
| 4 | Get Hanua | Terminal: `mkdir -p ~/Documents/GitHub && cd ~/Documents/GitHub && git clone https://github.com/merlanomagah/hanua.git` (accept the offer to install the developer tools if macOS asks). **Already there from before?** `cd ~/Documents/GitHub/hanua && git checkout main && git pull` instead, so it has the latest `main` |
| 5 | Install its parts | Terminal: `cd ~/Documents/GitHub/hanua && npm install` |
| 6 | Copy the keys | AirDrop the Air's `.env` (in the hanua folder; Finder shows hidden files with ⌘⇧.) into the mini's hanua folder. **The Air's own `.env`, not `.env.example`** (the example has blank keys: on 8 Oct 2026 the mini ran with a blank Notion key; Hanua now says so on the desk). If Pūtea runs on the mini, keep the mini's `PUTEA_URL` line; leave out `BACKUP_DIR=off` on the Mac that backs up. Delete the AirDropped copy from Downloads afterwards. Never put it in iCloud Drive or GitHub |
| 7 | Start it | Double-click **Start Hanua.command** in the folder; pick a PIN; allow Calendar, Reminders and Music when macOS asks. Open it as **http://localhost:3000** on the mini itself: since 6 Oct 2026 Hanua only answers its own pages on the same Mac, so the mini's name or address from another Mac is refused (on purpose) |
| 8 | Desktop apps | Terminal: `bash scripts/desktop-apps.sh` (Hanua and Restart Hanua on the Desktop) |
| 9 | Start at login, never sleep | System Settings → General → Login Items → + → the Hanua app; System Settings → Energy → prevent automatic sleeping |
| 10 | Then the Air stops backing up | add `BACKUP_DIR=off` to the Air's `.env` |

The mini then updates itself from GitHub every 5 minutes (only while `main` is checked out and nothing in the folder was changed by hand). Since 6 Oct 2026 an update installs new add-ons first and only replaces the running Hanua once the new one has started; if it can't, the old one keeps running and the page says "Hanua couldn't update". **Pūtea's home is the mini** (6 Oct 2026), so on the mini the money frames work; on the Air they say Pūtea is closed until it can reach the mini (Phase 2 of `docs/plans/2026-10-two-device-build-principles.md`).

**Check it's up to date:** in Terminal, `cd ~/Documents/GitHub/hanua && git log --oneline -1` should show the same first line as `main` on GitHub (github.com/merlanomagah/hanua/commits/main).

## If something looks wrong
- A desk note "iCloud kept two versions of …": one Mac saved while the other's change hadn't arrived. The copy ends in " 2"; tell Claude, who'll compare and merge.
- "Still coming from iCloud": step 2 (Keep Downloaded) on that Mac.
- "Can't find its shared iCloud folder": iCloud Drive is off or signed out on that Mac.
