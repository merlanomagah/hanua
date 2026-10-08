// Put a night's backup back (Foundations F7, 9 Oct 2026; the steps for Mel are in docs/restore.md).
//   node scripts/restore.js                 the backups there are, newest first
//   node scripts/restore.js 2026-10-08      what restoring that night would do (nothing is changed)
//   node scripts/restore.js 2026-10-08 --yes   do it: the room folder now is moved aside (kept), the backup copied in
// Options: --room <folder> --backups <folder> (otherwise .env's ROOM_DATA / BACKUP_DIR, as Hanua uses them).
// Stop Hanua on both Macs first: a running Hanua could save over what's put back.
import { readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { restoreRoom } from "../server/backup.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const env = (() => { try { return Object.fromEntries(readFileSync(path.join(root, ".env"), "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")])); } catch { return {}; } })();
const home = (p) => (p?.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);
const room = path.resolve(root, home(opt("--room") || env.ROOM_DATA || "data/room"));
const backups = path.resolve(root, home(opt("--backups") || (env.BACKUP_DIR && env.BACKUP_DIR !== "off" ? env.BACKUP_DIR : "~/Hanua backup")));
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const nights = (() => { try { return readdirSync(backups).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse(); } catch { return []; } })();

if (!day) {
  console.log(nights.length ? `Backups in ${backups}, newest first:\n  ${nights.join("\n  ")}\n\nTo see what restoring one would do: node scripts/restore.js ${nights[0]}` : `No backups in ${backups}.`);
  process.exit(0);
}
if (!nights.includes(day)) { console.error(`There's no backup for ${day} in ${backups}.`); process.exit(1); }
const files = (d) => { try { return readdirSync(d, { recursive: true }).filter((f) => f.endsWith(".json")).length; } catch { return 0; } };
console.log(`Restore ${day}: ${files(path.join(backups, day))} files from ${path.join(backups, day)}\ninto ${room} (now ${files(room)} files, which will be moved aside, not deleted).`);
if (!args.includes("--yes")) { console.log("\nNothing changed. Stop Hanua on both Macs, then run this again with --yes."); process.exit(0); }
const r = await restoreRoom({ from: path.join(backups, day), to: room });
if (!r.ok) { console.error(`Not restored: ${r.error}`); process.exit(1); }
console.log(`Restored. What was there is kept in:\n  ${r.aside}\nStart Hanua again (Start Hanua, or scripts/start.sh).`);
