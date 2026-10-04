// Apple Calendar, read-only, through a tiny helper app built from scripts/calendar.swift (EventKit).
// Built on this Mac the first time it's needed (Command Line Tools' swiftc) into bin/, which git ignores.
// Events are held in memory for a minute and never written anywhere. Without access, or with
// APPLE_CAL=0 (the sample server), the room gets sample events and is told why.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, todayStr } from "../public/shared/dates.js";
import { appleItems, calendarList, inCalendars } from "../public/shared/events.js";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "scripts", "calendar.swift");
const APP = path.join(root, "bin", "HanuaCalendar.app");
const EXE = path.join(APP, "Contents", "MacOS", "HanuaCalendar");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>nz.hanua.calendar</string>
  <key>CFBundleName</key><string>Hanua Calendar</string>
  <key>CFBundleDisplayName</key><string>Hanua Calendar</string>
  <key>CFBundleExecutable</key><string>HanuaCalendar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
  <key>NSCalendarsFullAccessUsageDescription</key><string>Hanua shows your calendar events on its wall calendar and agenda. It only reads them.</string>
</dict></plist>
`;

export const appleOff = () => process.env.APPLE_CAL === "0" || process.platform !== "darwin";
const calendars = () => calendarList(process.env.APPLE_CALENDARS);
export const workCalendars = () => calendarList(process.env.APPLE_WORK_CALENDARS);

// Build (or rebuild, after scripts/calendar.swift changes) the helper app. One build at a time.
let building = null;
async function ensureHelper() {
  const [src, exe] = await Promise.all([fs.stat(SOURCE), fs.stat(EXE).catch(() => null)]);
  if (exe && exe.mtimeMs >= src.mtimeMs) return;
  building ??= (async () => {
    await fs.mkdir(path.dirname(EXE), { recursive: true });
    await fs.writeFile(path.join(APP, "Contents", "Info.plist"), PLIST);
    await run("xcrun", ["swiftc", "-O", SOURCE, "-o", EXE], { timeout: 180_000 });
    await run("codesign", ["--force", "--sign", "-", APP], { timeout: 30_000 });
  })().finally(() => { building = null; });
  await building;
}

// Run the helper through `open`, so macOS treats it as its own app (one permission, however Hanua was started)
async function helper(args) {
  await ensureHelper();
  const file = path.join(os.tmpdir(), `hanua-calendar-${process.pid}-${Date.now()}.json`);
  try {
    await run("open", ["-W", "-g", "-n", "--stdout", file, "-a", APP, "--args", ...args], { timeout: 150_000 });
    return JSON.parse(await fs.readFile(file, "utf8"));
  } finally {
    fs.rm(file, { force: true }).catch(() => {});
  }
}

// Whether macOS has let the helper read calendars yet (asks nothing)
export async function calendarAccess() {
  if (appleOff()) return "off";
  return (await helper(["status"])).status;
}

const cache = new Map(); // "from|to" → { at, value }
const TTL = 60_000;

// Events from FROM to TO (days, TO included)
export async function getAppleEvents(from, to, { fresh = false } = {}) {
  if (!DAY.test(from) || !DAY.test(to) || to < from) throw Object.assign(new Error("Days look like 2026-10-05"), { status: 400 });
  const work = workCalendars();
  if (appleOff()) return { live: false, reason: "off", work: sampleWork, items: appleItems(sampleEvents(from, to)) };
  const key = `${from}|${to}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  let value;
  try {
    // every calendar from the helper, then the chosen ones by name (emoji in names don't matter)
    const res = await helper(["events", from, to]);
    const chosen = calendars();
    if (!res.error && chosen.length) res.events = (res.events || []).filter((e) => inCalendars(e.calendar, chosen));
    value = res.error
      ? { live: false, reason: res.error === "denied" || res.error === "restricted" ? "denied" : res.error === "notDetermined" ? "ask" : "error", work, items: [] }
      : { live: true, work, items: appleItems(res.events), calendars: res.calendars };
  } catch (err) {
    console.error("[calendar]", err.message);
    value = { live: false, reason: "error", work, items: [] };
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Open Calendar.app on a day (an Apple event isn't in Notion, so it opens where it lives)
export async function showDay(date) {
  if (!DAY.test(date)) throw Object.assign(new Error("Days look like 2026-10-05"), { status: 400 });
  if (appleOff()) return { ok: false };
  const [y, m, d] = date.split("-").map(Number);
  const script = [
    "on run argv",
    "set t to current date",
    "set day of t to 1",
    "set year of t to (item 1 of argv) as integer",
    "set month of t to (item 2 of argv) as integer",
    "set day of t to (item 3 of argv) as integer",
    'tell application "Calendar"',
    "activate",
    "switch view to day view",
    "view calendar at t",
    "end tell",
    "end run",
  ];
  await run("osascript", [...script.flatMap((l) => ["-e", l]), String(y), String(m), String(d)], { timeout: 8000 });
  return { ok: true };
}

// ---------- sample events, for the preview and anywhere without Calendar access ----------
const sampleWork = ["Spark NZ"];
const COLORS = { Personal: "#1BADF8", "Spark NZ": "#63DA38", Bills: "#FF9500", Income: "#CC73E1", "Manueli Calendar": "#FF2968" };
function sampleEvents(from, to) {
  const t = todayStr();
  const at = (n, hm) => `${addDays(t, n)}T${hm}`;
  const ev = (id, title, calendar, start, end, allDay = false) => ({ id, title, calendar, color: COLORS[calendar], start, end, allDay });
  const list = [
    ev("s1", "Stand-up", "Spark NZ", at(0, "08:30"), at(0, "08:45")), // the sample Notion book has it too: shows once
    ev("s9", "1:1 with Aroha", "Spark NZ", at(0, "14:00"), at(0, "14:30")),
    ev("s2", "Pilates", "Personal", at(0, "18:00"), at(0, "19:00")),
    ev("s3", "Rent due", "Bills", addDays(t, 1), addDays(t, 1), true),
    ev("s4", "Team planning", "Spark NZ", at(2, "10:00"), at(2, "11:30")),
    ev("s5", "Dinner at Nana's", "Manueli Calendar", at(3, "18:30"), at(3, "21:00")),
    ev("s6", "Long weekend", "Personal", addDays(t, 5), addDays(t, 7), true),
    ev("s7", "Pay day", "Income", addDays(t, 9), addDays(t, 9), true),
  ];
  // a weekly repeat, as EventKit gives it: one event per week
  for (let w = -5; w <= 8; w++) list.push(ev(`s8-${w}`, "Choir", "Personal", at(w * 7 + 1, "19:00"), at(w * 7 + 1, "20:30")));
  return list.filter((e) => e.start.slice(0, 10) <= to && (e.end || e.start).slice(0, 10) >= from);
}
