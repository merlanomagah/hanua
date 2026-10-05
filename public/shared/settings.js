// Settings Mel changes herself (6 Oct 2026, roadmap step 6; brief docs/plans/2026-10-desk-settings.md): kept on this
// Mac in data/room/settings.json (backed up nightly, never in the public repo). Anything not set falls back to Hanua's
// defaults (config/areas.json, .env and the code). Shared by the page and the server; no page imports.
import { TIME_PICKS, WORKDAY } from "./desk.js";

export const DEFAULT_WORDS = { 10: "Quick", 15: "Short", 30: "Half hour", 45: "Solid", 60: "Hour", 120: "Big" };
export const MAX_FIXED = 8;
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
  return { fixedSections, day, timeWords, timer, lists, desk };
}

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
