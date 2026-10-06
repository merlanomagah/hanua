// Apple Calendar (read, and since 7 Oct 2026 events added, changed and deleted from Hanua's New event window) and Reminders (the Shopping list and Add reminder, 6 Oct 2026), through a tiny helper
// app built from scripts/calendar.swift (EventKit).
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
import { appleItems, calendarList, eventShape, inCalendars, occurrences } from "../public/shared/events.js";

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
  <key>NSCalendarsFullAccessUsageDescription</key><string>Hanua shows your calendar events on its wall calendar and agenda, and adds or changes the events you make in its New event window.</string>
  <key>NSRemindersFullAccessUsageDescription</key><string>Hanua shows your Shopping list on its desk, adds what you jot there, and adds reminders you set from Add reminder.</string>
</dict></plist>
`;

export const appleOff = () => process.env.APPLE_CAL === "0" || process.platform !== "darwin";
const calendars = () => calendarList(process.env.APPLE_CALENDARS);
export const workCalendars = () => calendarList(process.env.APPLE_WORK_CALENDARS);

// Build (or rebuild, after scripts/calendar.swift changes) the helper app. One build at a time.
let building = null;
let failedFor = 0; // the source a build failed on: the old helper keeps reading the calendar until the source changes
async function ensureHelper() {
  const [src, exe] = await Promise.all([fs.stat(SOURCE), fs.stat(EXE).catch(() => null)]);
  if (exe && (exe.mtimeMs >= src.mtimeMs || failedFor === src.mtimeMs)) return;
  building ??= (async () => {
    await fs.mkdir(path.dirname(EXE), { recursive: true });
    await fs.writeFile(path.join(APP, "Contents", "Info.plist"), PLIST);
    await run("xcrun", ["swiftc", "-O", SOURCE, "-o", EXE], { timeout: 180_000 });
    // Finder tags left by a trip through iCloud Drive (6 Oct 2026) make codesign refuse: clear them first
    await run("xattr", ["-cr", APP], { timeout: 30_000 }).catch(() => {});
    await run("codesign", ["--force", "--sign", "-", APP], { timeout: 30_000 });
  })().catch((err) => {
    // a new helper that won't build mustn't take the calendar off the wall: keep the one that works, say so in the log
    if (!exe) throw err;
    failedFor = src.mtimeMs;
    console.error("[calendar] the new helper didn't build; still using the old one:", err.stderr || err.message);
  }).finally(() => { building = null; });
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

// ---------- Reminders: the Shopping list and Add reminder ----------
// Lists by name (.env): REMINDERS_SHOPPING (default "Shopping", made if missing) and REMINDERS_LIST (Add reminder's
// list; blank = the default one). Nothing is kept here: each read asks Reminders. The sample server has a pretend list.
// Settings (the desk's Lists group) win over .env
let named = { shopping: "", reminders: "" };
export const setListNames = (lists) => { named = { shopping: lists?.shopping || "", reminders: lists?.reminders || "" }; };
const shoppingList = () => named.shopping || process.env.REMINDERS_SHOPPING?.trim() || "Shopping";
const reminderList = () => named.reminders || process.env.REMINDERS_LIST?.trim() || "";
const why = (e) => (e === "denied" || e === "restricted" ? "denied" : e === "notDetermined" ? "ask" : "error");
const fail = (res) => Object.assign(new Error(res.error === "denied" ? "Hanua isn't allowed to use Reminders yet: System Settings → Privacy & Security → Reminders → Hanua Calendar" : "Reminders didn't answer"), { status: 503, reason: why(res.error) });
let sampleShop = [{ id: "sh1", title: "Milk" }, { id: "sh2", title: "Bananas" }, { id: "sh3", title: "Rolled oats" }];
const sampleDone = new Set();

export async function getShopping() {
  if (appleOff()) return { live: false, list: "Shopping", items: sampleShop.filter((i) => !sampleDone.has(i.id)) };
  const res = await helper(["reminders", shoppingList()]);
  if (res.error) return { live: false, reason: why(res.error), list: shoppingList(), items: [] };
  return { live: true, list: res.list, items: res.items || [] };
}
const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
const DUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// to: "shopping" or "reminders"; due only for reminders (local time, yyyy-mm-ddThh:mm)
export async function addReminder({ to, title, due }) {
  const t = clean(title);
  if (!t) throw Object.assign(new Error("Write something first"), { status: 400 });
  if (due && !DUE.test(due)) throw Object.assign(new Error("When looks like 2026-10-06T17:00"), { status: 400 });
  if (appleOff()) { const id = `s${Date.now()}`; if (to === "shopping") sampleShop.push({ id, title: t }); return { id, live: false }; }
  const res = await helper(["remind-add", to === "shopping" ? shoppingList() : reminderList(), t, ...(to !== "shopping" && due ? [due] : [])]);
  if (res.error) throw fail(res);
  return { id: res.id, list: res.list, live: true };
}
const ID = /^[\w:\-.]{1,200}$/;
export async function setReminderDone(id, done) {
  if (!ID.test(String(id))) throw Object.assign(new Error("Which one?"), { status: 400 });
  if (appleOff()) { done ? sampleDone.add(id) : sampleDone.delete(id); return { ok: true }; }
  const res = await helper(["remind-done", id, done ? "1" : "0"]);
  if (res.error) throw fail(res);
  return { ok: true };
}
export async function removeReminder(id) {
  if (!ID.test(String(id))) throw Object.assign(new Error("Which one?"), { status: 400 });
  if (appleOff()) { sampleShop = sampleShop.filter((i) => i.id !== id); return { ok: true }; }
  const res = await helper(["remind-remove", id]);
  if (res.error) throw fail(res);
  return { ok: true };
}
// Mel's Reminders lists, for the Settings window to pick from (no typing a name wrong)
export async function getReminderLists() {
  if (appleOff()) return { live: false, lists: ["Reminders", "Shopping", "Family"], shopping: shoppingList(), reminders: reminderList() };
  const res = await helper(["reminder-lists"]);
  if (res.error) return { live: false, reason: why(res.error), lists: [], shopping: shoppingList(), reminders: reminderList() };
  return { live: true, lists: res.lists || [], defaultList: res.default, shopping: shoppingList(), reminders: reminderList() };
}

// Open the Reminders app (where the list lives: edit, share, or set it to Groceries there)
export async function showReminders() {
  if (appleOff()) return { ok: false };
  await run("open", ["-a", "Reminders"], { timeout: 8000 });
  return { ok: true };
}

// ---------- adding, changing and deleting events (7 Oct 2026, brief docs/plans/2026-10-apple-calendar-events.md) ----------
// Written straight into Apple Calendar through the helper; Hanua keeps nothing. Every write clears the minute's cache so
// the wall shows it at once. The sample server keeps a pretend calendar in memory (never Mel's).
const EID = /^[\w:\-.\/+=@]{1,300}$/;
const AT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const failed = (res) => Object.assign(new Error(
  res.error === "denied" || res.error === "restricted" ? "Hanua isn't allowed to change your calendars: System Settings → Privacy & Security → Calendars → Hanua Calendar → Full Access"
    : res.error === "calendar" || res.error === "readonly" ? "That calendar can't be changed from here (it's read-only, or was removed)"
      : res.error === "missing" ? "That event isn't in Calendar any more" : "Calendar didn't save it"), { status: res.error === "missing" ? 404 : 503, reason: why(res.error) });

// The calendars a new event can go in (Settings and the window pick from these)
export async function getEventCalendars() {
  if (appleOff()) return { live: false, reason: "off", work: sampleWork, default: "Personal", calendars: SAMPLE_CALS };
  const res = await helper(["event-calendars"]);
  if (res.error) return { live: false, reason: why(res.error), work: workCalendars(), calendars: [] };
  return { live: true, work: workCalendars(), default: res.default || "", calendars: res.calendars || [] };
}
function checkTarget(id, at, span) {
  if (!EID.test(String(id || ""))) throw bad("Which event?");
  if (!AT.test(String(at || ""))) throw bad("Which day of it?");
  if (span !== "this" && span !== "future") throw bad("This event, or this and future?");
}
export async function addEvent(fields) {
  const { event, error } = eventShape(fields);
  if (error) throw bad(error);
  cache.clear();
  if (appleOff()) return sampleAdd(event);
  const res = await helper(["event-add", JSON.stringify(event)]);
  if (res.error) throw failed(res);
  return { id: res.id, occurrence: res.occurrence, live: true };
}
// span: "this" (only this day of a repeating event) or "future" (this and every later one; all of a one-off)
export async function editEvent(id, at, span, fields) {
  checkTarget(id, at, span);
  const { event, error } = eventShape(fields);
  if (error) throw bad(error);
  cache.clear();
  if (appleOff()) return sampleEdit(id, at, span, event);
  const res = await helper(["event-edit", id, at, span, JSON.stringify(event)]);
  if (res.error) throw failed(res);
  return { ok: true, id: res.id, occurrence: res.occurrence };
}
export async function removeEvent(id, at, span) {
  checkTarget(id, at, span);
  cache.clear();
  if (appleOff()) return sampleRemove(id, at, span);
  const res = await helper(["event-remove", id, at, span]);
  if (res.error) throw failed(res);
  return { ok: true };
}

// ---------- sample events, for the preview and anywhere without Calendar access ----------
// One list of events (a repeating one is one entry with its repeat), changed by the window like Calendar would be
const sampleWork = ["Spark NZ"];
const COLORS = { Personal: "#1BADF8", "Spark NZ": "#63DA38", Bills: "#FF9500", Income: "#CC73E1", "Manueli Calendar": "#FF2968", "NZ Holidays": "#8E8E93" };
const SAMPLE_CALS = Object.entries(COLORS).map(([title, color]) => ({ title, color, writable: title !== "NZ Holidays" }));
let sample = null, sampleSeq = 0;
function sampleList() {
  if (sample) return sample;
  const t = todayStr();
  const at = (n, hm) => `${addDays(t, n)}T${hm}`;
  const ev = (id, title, calendar, start, end, allDay = false, more = {}) => ({ id, title, calendar, start, end, allDay, location: "", notes: "", url: "", repeat: "none", alert: null, ...more });
  sample = [
    ev("s1", "Stand-up", "Spark NZ", at(0, "08:30"), at(0, "08:45")), // the sample Notion book has it too: shows once
    ev("s9", "1:1 with Aroha", "Spark NZ", at(0, "14:00"), at(0, "14:30")),
    ev("s2", "Pilates", "Personal", at(0, "18:00"), at(0, "19:00"), false, { location: "Studio 3", alert: 30 }),
    ev("s3", "Rent due", "Bills", addDays(t, 1), addDays(t, 1), true),
    ev("s4", "Team planning", "Spark NZ", at(2, "10:00"), at(2, "11:30")),
    ev("s5", "Dinner at Nana's", "Manueli Calendar", at(3, "18:30"), at(3, "21:00")),
    ev("s6", "Long weekend", "Personal", addDays(t, 5), addDays(t, 7), true),
    ev("s7", "Pay day", "Income", addDays(t, 9), addDays(t, 9), true),
    ev("s10", "Labour Day", "NZ Holidays", addDays(t, 20), addDays(t, 20), true),
    ev("s8", "Choir", "Personal", at(-34, "19:00"), at(-34, "20:30"), false, { repeat: "weekly" }), // a repeat, as Calendar keeps it
  ];
  return sample;
}
function sampleEvents(from, to) {
  return sampleList().flatMap((e) => occurrences(e, from, to)).map((o) => ({ ...o, color: COLORS[o.calendar] || "#3B6B5A", writable: o.calendar !== "NZ Holidays" }));
}
const sampleFind = (id) => { const e = sampleList().find((x) => x.id === id); if (!e) throw Object.assign(new Error("That event isn't in Calendar any more"), { status: 404 }); if (e.calendar === "NZ Holidays") throw Object.assign(new Error("That calendar can't be changed from here (it's read-only, or was removed)"), { status: 503 }); return e; };
const writableSample = (name) => SAMPLE_CALS.some((c) => c.title === name && c.writable);
const dayBefore = (at) => addDays(at.slice(0, 10), -1);
function sampleAdd(event) {
  const calendar = event.calendar || "Personal";
  if (!writableSample(calendar)) throw Object.assign(new Error("That calendar can't be changed from here (it's read-only, or was removed)"), { status: 503 });
  const id = `n${Date.now()}-${++sampleSeq}`;
  sampleList().push({ ...event, calendar, id });
  return { id, occurrence: event.start, live: false };
}
function sampleEdit(id, at, span, event) {
  const e = sampleFind(id);
  const calendar = event.calendar || e.calendar;
  if (!writableSample(calendar)) throw Object.assign(new Error("That calendar can't be changed from here (it's read-only, or was removed)"), { status: 503 });
  const repeating = e.repeat && e.repeat !== "none";
  const first = at === e.start;
  if (!repeating || (span === "future" && first)) {
    Object.assign(e, { ...event, calendar, repeat: event.repeat === "custom" ? e.repeat : event.repeat });
    return { ok: true, id, occurrence: e.start };
  }
  if (span === "this") {
    // one day of a series: that day leaves the series and becomes its own event (Calendar keeps it detached)
    e.except = [...(e.except || []), at];
    const r = sampleAdd({ ...event, calendar, repeat: "none", until: "", count: null });
    return { ok: true, id: r.id, occurrence: r.occurrence };
  }
  // this and future: the series ends the day before, a new one carries on from here
  e.until = dayBefore(at); e.count = null;
  const r = sampleAdd({ ...event, calendar, repeat: event.repeat === "custom" ? e.repeat : event.repeat });
  return { ok: true, id: r.id, occurrence: r.occurrence };
}
function sampleRemove(id, at, span) {
  const e = sampleFind(id);
  const repeating = e.repeat && e.repeat !== "none";
  if (!repeating || (span === "future" && at === e.start)) sample = sampleList().filter((x) => x !== e);
  else if (span === "this") e.except = [...(e.except || []), at];
  else { e.until = dayBefore(at); e.count = null; }
  return { ok: true };
}
