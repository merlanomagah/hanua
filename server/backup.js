// The room's own data (planner days, stickies, plant, menus in data/room/) is copied once a day into a private
// iCloud Drive folder, "Hanua backup", one dated folder per day, the last 30 kept. When the room folder is itself
// shared through iCloud (two Macs, ROOM_DATA), one Mac backs up to its own disk instead (server/index.js backupDir),
// and iCloud's cloud-only placeholders and Hanua's half-written temp files are skipped.
// Never the GitHub repo (it's public). Not Pūtea's money data: Time Machine covers that once the drive is in
// (Mel, 6 Oct 2026). A failed or missing backup is said out loud on the desk (backupWarning), never silent.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ymd } from "../public/shared/dates.js";

export const KEEP_DAYS = 30, EVENING_HOUR = 21, RETRY_MS = 3600_000, WARN_MS = 48 * 3600_000;
const STATUS = "last.json";

// Is a backup due? None yet; none today; the first one after 9 pm (so the day's end is kept); or an hour after a failure
export function backupDue(status, now = new Date()) {
  if (!status?.at) return true;
  const at = new Date(status.at);
  if (!status.ok) return now - at >= RETRY_MS;
  if (ymd(at) !== ymd(now)) return true;
  return now.getHours() >= EVENING_HOUR && at.getHours() < EVENING_HOUR;
}

// What the desk should say, if anything: the last try failed, or nothing good for two days
export function backupWarning(status, now = new Date()) {
  if (!status) return null;
  if (status.at && !status.ok) return `Hanua's backup didn't work: ${status.error || "unknown reason"}`;
  if (!status.good || now - new Date(status.good) > WARN_MS) return "Hanua hasn't backed up for two days";
  return null;
}

// Which dated folders to clear out: everything past the newest `keep`
export function toPrune(names, keep = KEEP_DAYS) {
  return names.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse().slice(keep);
}

export async function readStatus(to) {
  try { return JSON.parse(await readFile(path.join(to, STATUS), "utf8")); } catch { return null; }
}

// Copy `from` into `to/<today>/` (today's copy replaced), clear out old days, and note how it went
export async function backupRoom({ from, to, now = new Date(), keep = KEEP_DAYS }) {
  const before = await readStatus(to);
  const status = { at: now.toISOString(), ok: true, error: null, good: before?.good || null };
  try {
    await mkdir(to, { recursive: true });
    const day = path.join(to, ymd(now));
    await rm(day, { recursive: true, force: true });
    await cp(from, day, { recursive: true, filter: (src) => !/^\..*\.(icloud|tmp)$/.test(path.basename(src)) });
    for (const old of toPrune(await readdir(to), keep)) await rm(path.join(to, old), { recursive: true, force: true });
    status.good = status.at;
  } catch (err) {
    Object.assign(status, { ok: false, error: err.code === "ENOENT" ? "the iCloud Drive folder isn't there (is iCloud Drive on?)" : err.message });
  }
  await writeFile(path.join(to, STATUS), JSON.stringify(status, null, 2) + "\n").catch(() => {});
  return status;
}
