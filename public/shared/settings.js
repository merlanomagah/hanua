// Settings Mel changes herself (6 Oct 2026, roadmap step 6; brief docs/plans/2026-10-desk-settings.md): kept on this
// Mac in data/room/settings.json (backed up nightly, never in the public repo). Anything not set falls back to Hanua's
// defaults (config/areas.json, .env and the code). Shared by the page and the server; no page imports.
import { TIME_PICKS, WORKDAY } from "./desk.js";

export const DEFAULT_WORDS = { 10: "Quick", 15: "Short", 30: "Half hour", 45: "Solid", 60: "Hour", 120: "Big" };
export const MAX_FIXED = 8;
// Settings files carry the version that wrote them: an older Hanua (the other Mac, not yet updated) refuses to save
// over a newer file rather than dropping what it doesn't know. Raise it whenever settingsShape learns a group.
export const SETTINGS_VERSION = 3; // 3: close (Close the day's times, 9 Oct 2026)
export const SLEEP_PICKS = [5, 10, 15, 30, 60];
export const CLOCKS = [{ city: "Sydney", zone: "Australia/Sydney" }, { city: "Suva", zone: "Pacific/Fiji" }, { city: "Los Angeles", zone: "America/Los_Angeles" }];
const realZone = (z) => { try { return typeof z === "string" && z.length < 60 && Boolean(new Intl.DateTimeFormat("en", { timeZone: z })); } catch { return false; } };
const hour = (v, d) => (Number.isInteger(v) && v >= 0 && v <= 23 ? v : d);
const names = (a, n = 40) => (Array.isArray(a) ? [...new Set(a.map((x) => clip(x, 100)).filter(Boolean))].slice(0, n) : []);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const minutes = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

// Hanua's defaults; fixed: config/areas.json planner.fixedSections
export const defaults = (fixed = []) => ({
  fixedSections: fixed.map((f) => ({ name: clip(f.name, 40), work: Boolean(f.work) })).filter((f) => f.name),
  day: { ...WORKDAY },
  timeWords: { ...DEFAULT_WORDS },
  timer: { focus: 25, rest: 5 },
  lists: { shopping: "", reminders: "" }, // "" = .env, else Shopping / the default list
  desk: { autoOpen: true },
  calendar: { default: "" }, // the Apple calendar new events go in ("" = the Mac's default); 7 Oct 2026
  // Hanua Settings, on the rail (8 Oct 2026, brief docs/plans/2026-10-settings-everywhere-and-two-mac-fix.md)
  room: { lightsOff: 21, lightsOn: 4, clocks: CLOCKS.map((c) => ({ ...c })), greetOff: [] }, // greetOff: languages left out
  calendars: { shown: [], work: [] }, // [] = .env's APPLE_CALENDARS / APPLE_WORK_CALENDARS (else every calendar)
  weather: { place: "" }, // "" = .env's WEATHER_PLACE
  sleep: { after: 15 }, // minutes without use before Hanua sleeps
  close: { from: "16:00", remind: "19:00" }, // Close the day: the button from, the reminder at ("" = no reminder)
});

// Whatever was saved or sent, tidied, with the defaults filling the gaps
export function settingsShape(o, base = defaults()) {
  const x = o && typeof o === "object" ? o : {};
  const seen = new Set();
  const fixedSections = Array.isArray(x.fixedSections)
    ? x.fixedSections.map((f) => ({ name: clip(f?.name, 40), work: Boolean(f?.work) })).filter((f) => f.name && !seen.has(f.name.toLowerCase()) && seen.add(f.name.toLowerCase())).slice(0, MAX_FIXED)
    : base.fixedSections;
  const day = { start: HHMM.test(x.day?.start) ? x.day.start : base.day.start, end: HHMM.test(x.day?.end) ? x.day.end : base.day.end };
  if (day.end <= day.start) Object.assign(day, base.day);
  const timeWords = Object.fromEntries(TIME_PICKS.map((m) => [m, clip(x.timeWords?.[m], 16) || base.timeWords[m]]));
  const timer = { focus: minutes(x.timer?.focus, 5, 120, base.timer.focus), rest: minutes(x.timer?.rest, 1, 60, base.timer.rest) };
  const lists = { shopping: clip(x.lists?.shopping, 60), reminders: clip(x.lists?.reminders, 60) };
  const desk = { autoOpen: typeof x.desk?.autoOpen === "boolean" ? x.desk.autoOpen : base.desk.autoOpen };
  const calendar = { default: clip(x.calendar?.default, 100) };
  let lightsOff = hour(x.room?.lightsOff, base.room.lightsOff), lightsOn = hour(x.room?.lightsOn, base.room.lightsOn);
  if (lightsOff === lightsOn) ({ lightsOff, lightsOn } = base.room);
  const clocks = base.room.clocks.map((d, i) => {
    const c = Array.isArray(x.room?.clocks) ? x.room.clocks[i] : null;
    return realZone(c?.zone) ? { city: clip(c.city, 24) || c.zone.split("/").pop().replace(/_/g, " "), zone: c.zone } : { ...d };
  });
  const room = { lightsOff, lightsOn, clocks, greetOff: names(x.room?.greetOff, 20) };
  const calendars = { shown: names(x.calendars?.shown), work: names(x.calendars?.work) };
  const weather = { place: clip(x.weather?.place, 80) };
  const sleep = { after: SLEEP_PICKS.includes(x.sleep?.after) ? x.sleep.after : base.sleep.after };
  const close = { from: HHMM.test(x.close?.from) ? x.close.from : base.close.from, remind: x.close?.remind === "" ? "" : HHMM.test(x.close?.remind) ? x.close.remind : base.close.remind };
  // groups this Hanua doesn't know (written by a newer one) are kept as they are, never dropped
  const known = new Set([...Object.keys(base), "base", "changed", "v"]);
  const extra = Object.fromEntries(Object.entries(x).filter(([k, v]) => !known.has(k) && v && typeof v === "object"));
  return { ...extra, fixedSections, day, timeWords, timer, lists, desk, calendar, room, calendars, weather, sleep, close };
}

// Which groups differ between two sets of Settings: a save sends only these, so a change on one Mac never undoes
// another group changed on the other Mac meanwhile
export const changedGroups = (before, after) => Object.keys(after || {}).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]));

// Fixed sections renamed in Settings: the same place in the list, a different name. Today's section of the old name
// takes the new one, so its lines stay with it (rather than an empty new section appearing beside the old)
export function renames(before, after) {
  return before.map((f, i) => [f.name, after[i]?.name]).filter(([a, b]) => a && b && a.toLowerCase() !== b.toLowerCase() && !before.some((x) => x.name.toLowerCase() === b.toLowerCase()));
}
export function renameSections(d, pairs) {
  for (const [from, to] of pairs) {
    const sec = d.sections.find((s) => (s.name || "").toLowerCase() === from.toLowerCase());
    if (sec && !d.sections.some((s) => (s.name || "").toLowerCase() === to.toLowerCase())) sec.name = to;
  }
  return d;
}
