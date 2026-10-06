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
| 4 | Get Hanua | Terminal: `mkdir -p ~/Documents/GitHub && cd ~/Documents/GitHub && git clone https://github.com/merlanomagah/hanua.git` (accept the offer to install the developer tools if macOS asks) |
| 5 | Install its parts | Terminal: `cd ~/Documents/GitHub/hanua && npm install` |
| 6 | Copy the keys | AirDrop the Air's `.env` (in the hanua folder; Finder shows hidden files with ⌘⇧.) into the mini's hanua folder. Never put it in iCloud Drive or GitHub |
| 7 | Start it | Double-click **Start Hanua.command** in the folder; pick a PIN; allow Calendar, Reminders and Music when macOS asks |
| 8 | Desktop apps | Terminal: `bash scripts/desktop-apps.sh` (Hanua and Restart Hanua on the Desktop) |
| 9 | Start at login, never sleep | System Settings → General → Login Items → + → the Hanua app; System Settings → Energy → prevent automatic sleeping |
| 10 | Then the Air stops backing up | add `BACKUP_DIR=off` to the Air's `.env` |

The mini then updates itself from GitHub every 5 minutes. Money (Pūtea) stays on the Air: on the mini the money frames say Pūtea is closed.

## If something looks wrong
- A desk note "iCloud kept two versions of …": one Mac saved while the other's change hadn't arrived. The copy ends in " 2"; tell Claude, who'll compare and merge.
- "Still coming from iCloud": step 2 (Keep Downloaded) on that Mac.
- "Can't find its shared iCloud folder": iCloud Drive is off or signed out on that Mac.
