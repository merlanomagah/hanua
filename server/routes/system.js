// This Mac and Hanua itself: the sleep screen's PIN, status, restart, the nightly backup and This Mac (Hanua
// Settings). Split out of server/index.js (Foundations F6, 9 Oct 2026).
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { changePin, checkPin, forgetPin, lockStatus, setPin } from "../lock.js";
import { backupDue, backupRoom, backupWarning, readStatus } from "../backup.js";
import { notionEnabled } from "../notion.js";
import { claudeEnabled } from "../claude.js";

export function register({ app, root, room, roomDir, sharedRoom, choice, isMain, bootAt, updates }) {
  // The sleep screen's PIN (a hash in data/lock.json, or LOCK_FILE; the sample preview uses its own file)
  const lockFile = path.resolve(root, process.env.LOCK_FILE || "data/lock.json");
  app.get("/api/lock", async (_req, res) => res.json(await lockStatus(lockFile)));
  app.post("/api/lock/setup", async (req, res) => {
    try { await setPin(lockFile, req.body?.pin); res.json({ ok: true }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  });
  app.post("/api/lock/check", async (req, res) => res.json(await checkPin(lockFile, req.body?.pin)));
  // Hanua Settings → Sleep screen: change the PIN, or forget it (both ask for the current one)
  app.post("/api/lock/change", async (req, res) => {
    try { res.json(await changePin(lockFile, req.body?.current, req.body?.pin)); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  });
  app.post("/api/lock/forget", async (req, res) => res.json(await forgetPin(lockFile, req.body?.current)));


  // The nightly backup of the room's data (server/backup.js): checked every 15 minutes while Hanua runs. The sample
  // server backs up its own folder beside it; BACKUP_DIR in .env can point elsewhere, or say "off".
  // With a shared room folder (in iCloud), the backup goes to this Mac's own disk, outside iCloud, so a wiped file can't
  // carry into the copies; only one Mac backs up (the other sets BACKUP_DIR=off).
  // This Mac's own choices, kept beside its PIN (data/, never in the shared folder: they're about this Mac): whether it
  // backs up (Hanua Settings → This Mac, 8 Oct 2026; one Mac backs up the shared folder, the other needn't). Unset:
  // BACKUP_DIR in .env decides, as before.
  const thisMacFile = path.resolve(root, choice.sample ? "data/this-mac-sample.json" : "data/this-mac.json");
  let thisMac = {};
  try { thisMac = JSON.parse(readFileSync(thisMacFile, "utf8")) || {}; } catch { /* nothing chosen yet */ }
  const backupHome = path.resolve(root, (choice.backup && choice.backup !== "off" && choice.backup)
    || (roomDir.endsWith("room-sample") ? "data/room-sample-backup"
      : sharedRoom ? path.join(os.homedir(), "Hanua backup")
        : path.join(os.homedir(), "Library/Mobile Documents/com~apple~CloudDocs/Hanua backup")));
  let backupDir = null;
  const setBackup = () => { backupDir = thisMac.backup === false ? null : thisMac.backup === true || choice.backup !== "off" ? backupHome : null; };
  setBackup();
  let backupStatus = null, backingUp = false;
  async function backupTick() {
    if (!backupDir || backingUp) return;
    backingUp = true;
    try {
      backupStatus ??= await readStatus(backupDir);
      if (backupDue(backupStatus)) {
        if (!room.missing()) await mkdir(roomDir, { recursive: true });
        backupStatus = await backupRoom({ from: roomDir, to: backupDir });
        if (!backupStatus.ok) console.error(`Backup failed: ${backupStatus.error}`);
      }
    } finally { backingUp = false; }
  }
  setTimeout(backupTick, 5_000); setInterval(backupTick, 15 * 60_000); // does nothing while this Mac doesn't back up
  app.get("/api/backup", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    if (!backupDir) return res.json({ off: true });
    backupStatus ??= await readStatus(backupDir); // asked before the first check has run
    res.json({ at: backupStatus?.at || null, ok: backupStatus?.ok ?? null, good: backupStatus?.good || null, warning: backupWarning(backupStatus),
      where: backupDir.includes("CloudDocs") ? `iCloud Drive › ${path.basename(backupDir)}`
        : backupDir.startsWith(os.homedir()) && !backupDir.startsWith(root) ? `${path.basename(backupDir)}, in your home folder on this Mac`
          : path.relative(root, backupDir) || backupDir });
  });

  // Hanua Settings → This Mac: what this Mac is connected to (never the keys themselves), where its room folder is and
  // why, and whether it backs up. Only `backup` can be changed from the page; keys and folders stay in .env.
  app.get("/api/this-mac", async (_req, res) => {
    backupStatus ??= backupDir ? await readStatus(backupDir) : null;
    res.set("Cache-Control", "no-store").json({
      notion: notionEnabled(), claude: claudeEnabled(), sample: choice.sample,
      room: { shared: sharedRoom, folder: sharedRoom ? path.basename(roomDir) : null, why: choice.why },
      backup: { on: Boolean(backupDir), at: backupStatus?.at || null, ok: backupStatus?.ok ?? null },
      version: { commit: updates()?.state.commit || null, pull: updates()?.state.pull || null, blocked: updates()?.state.blocked || null, self: Boolean(updates()) },
    });
  });
  app.post("/api/this-mac", async (req, res) => {
    if (typeof req.body?.backup !== "boolean") return res.status(400).json({ error: "backup: true or false" });
    thisMac = { ...thisMac, backup: req.body.backup };
    try { await writeFile(thisMacFile, JSON.stringify(thisMac, null, 2) + "\n"); }
    catch (err) { return res.status(500).json({ error: err.message }); }
    setBackup(); backupStatus = null;
    if (backupDir) setTimeout(backupTick, 1_000);
    res.json({ backup: { on: Boolean(backupDir) } });
  });

  // Restart Hanua (scripts/restart.sh, so the shortcut only sends this and finishes; nothing for it to cut off).
  // The custom header means another website can't trigger it from Safari.
  app.post("/api/restart", (req, res) => {
    if (!isMain || req.get("X-Hanua") !== "restart") return res.status(403).json({ error: "Not this Hanua" });
    res.json({ restarting: true });
    setTimeout(() => updates()?.restart(), 100);
  });


  app.get("/api/status", (_req, res) => {
    // boot changes on every start, so an open page can tell Hanua was updated (public/updates.js)
    // pid: how a fresh copy is told apart from this one; update: an update that didn't take (server/updates.js)
    res.set("Cache-Control", "no-store").json({ notion: notionEnabled(), claude: claudeEnabled(), boot: bootAt, pid: process.pid, update: updates()?.state.blocked || null });
  });
}
