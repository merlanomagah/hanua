// Apple Calendar events as the room shows them: one item per day they fall on, in their calendar's colour.
// Read live from the Mac (server/calendar.js) and never kept; used by the server and the page.
import { addDays, dayOf, pad, parseDay, timeOf, ymd } from "./dates.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_DAYS = 62; // a holiday is spread across its days; anything longer is shown on its first day only

// The helper's events → calendar items. All-day events covering several days appear on each of them;
// timed events sit on the day they start.
export function appleItems(events = []) {
  const items = [];
  for (const e of events) {
    if (!e || typeof e.title !== "string") continue;
    const base = { title: e.title.trim() || "(No title)", kind: e.calendar || "Calendar", calendar: e.calendar || "", color: /^#[0-9a-f]{6}$/i.test(e.color || "") ? e.color : "#3B6B5A", apple: true, location: e.location || "",
      // what the New event window needs to change it (7 Oct 2026): Apple's id, which occurrence, and its fields as read
      eid: e.id, occurrence: e.occurrence || e.start, writable: e.writable !== false, event: eventOf(e) };
    if (e.allDay) {
      if (!DAY.test(e.start || "")) continue;
      const end = DAY.test(e.end || "") && e.end >= e.start ? e.end : e.start;
      let d = e.start;
      for (let i = 0; d <= end && i < MAX_DAYS; i++, d = addDays(e.start, i)) {
        items.push({ ...base, id: `apple:${e.id}@${d}`, date: d, allDay: true, days: end > e.start ? { from: e.start, to: end } : null });
      }
    } else {
      if (!STAMP.test(e.start || "")) continue;
      items.push({ ...base, id: `apple:${e.id}@${e.start}`, date: e.start, end: STAMP.test(e.end || "") ? e.end : null, allDay: false });
    }
  }
  return items;
}

// The same event in Notion and Apple Calendar shows once (Notion's, since it links to the book)
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
// Calendar names match on their words alone: "👔 Spark NZ" is "Spark NZ"
export const calendarName = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const inCalendars = (name, list = []) => list.some((w) => calendarName(w) === calendarName(name));
export const sameEvent = (a, b) => dayOf(a.date) === dayOf(b.date) && timeOf(a.date) === timeOf(b.date) && norm(a.title) === norm(b.title);
export const withoutDuplicates = (apple, notion) => apple.filter((a) => !notion.some((n) => sameEvent(a, n)));

// At work: only the Work calendars show in full; everything else keeps its time and says "Busy"
export const appleAtWork = (item, workCalendars = []) =>
  inCalendars(item.calendar, workCalendars)
    ? item
    : { id: item.id, date: item.date, title: "Busy", kind: "Busy", busy: true, apple: true, color: "#8a8178" };

// Names from .env ("Bills, Income, Spark NZ") → a clean list
export const calendarList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

// ---------- adding, changing and deleting events (7 Oct 2026, brief docs/plans/2026-10-apple-calendar-events.md) ----------
// The New event window's fields ↔ what the helper (scripts/calendar.swift) writes. Apple stays the home: Hanua keeps
// nothing. Times are local, "2026-10-07T09:30"; all-day events use days, the last one included.

export const REPEATS = { none: "Never", daily: "Every day", weekdays: "Every weekday", weekly: "Every week", fortnightly: "Every 2 weeks", monthly: "Every month", yearly: "Every year" };
// alerts: minutes before the start (an all-day event starts at midnight, so "on the day, 9 am" is 540 minutes after)
export const ALERTS = { "": "None", 0: "At time of event", 5: "5 minutes before", 10: "10 minutes before", 15: "15 minutes before", 30: "30 minutes before", 60: "1 hour before", 120: "2 hours before", 1440: "1 day before", 2880: "2 days before" };
export const ALL_DAY_ALERTS = { "": "None", "-540": "On the day (9 am)", 900: "1 day before (9 am)", 2340: "2 days before (9 am)", 9540: "1 week before (9 am)" };

const DAYPAT = /^\d{4}-\d{2}-\d{2}$/;
const STAMPPAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);
const toDate = (stamp) => { const d = parseDay(stamp); const [h, m] = timeOf(stamp).split(":").map(Number); d.setHours(h || 0, m || 0); return d; };
const stampOf = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addMinutes = (stamp, n) => { const d = toDate(stamp); d.setMinutes(d.getMinutes() + n); return stampOf(d); };
export const minutesBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 60_000);

// The fields as the window shows them, from an event the helper read
export function eventOf(e = {}) {
  return {
    title: e.title || "", calendar: e.calendar || "", allDay: Boolean(e.allDay), start: e.start || "", end: e.end || e.start || "",
    location: e.location || "", notes: e.notes || "", url: e.url || "",
    repeat: e.repeat && (REPEATS[e.repeat] || e.repeat === "custom") ? e.repeat : "none", until: DAYPAT.test(e.until || "") ? e.until : "", count: Number(e.count) > 0 ? Number(e.count) : null,
    alert: Number.isFinite(e.alert) ? e.alert : null,
  };
}

// A new event on a day: today from the next half hour, any other day at 9; an hour long
export function newEventTimes(day, now = new Date()) {
  if (day === ymd(now)) {
    const d = new Date(now); d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    if (ymd(d) === day && d.getHours() < 23) return { start: stampOf(d), end: addMinutes(stampOf(d), 60) };
  }
  return { start: `${day}T09:00`, end: `${day}T10:00` };
}

// The start moved: the end keeps the same length after it (Calendar.app does the same)
export function moveStart(f, start) {
  if (f.allDay) {
    const len = DAYPAT.test(f.start) && DAYPAT.test(f.end) ? Math.max(0, Math.round((parseDay(f.end) - parseDay(f.start)) / 86_400_000)) : 0;
    return { ...f, start, end: addDays(start, len) };
  }
  const len = STAMPPAT.test(f.start) && STAMPPAT.test(f.end) ? Math.max(0, minutesBetween(f.start, f.end)) : 60;
  return { ...f, start, end: addMinutes(start, len) };
}

// All day on / off: days from times, or times (9–10 on the first day) from days
export function setAllDay(f, on) {
  if (on === f.allDay) return f;
  if (on) return { ...f, allDay: true, start: dayOf(f.start), end: dayOf(f.end) >= dayOf(f.start) ? dayOf(f.end) : dayOf(f.start), alert: null };
  return { ...f, allDay: false, start: `${dayOf(f.start)}T09:00`, end: `${dayOf(f.start)}T10:00`, alert: null };
}

// Whatever the window (or anyone) sent, tidied into something the helper can save; a reason if it can't be
export function eventShape(o = {}) {
  const x = o && typeof o === "object" ? o : {};
  const allDay = Boolean(x.allDay);
  const title = clip(x.title, 200).replace(/\s+/g, " ") || "New Event";
  let start = String(x.start || ""), end = String(x.end || "");
  if (allDay) {
    if (!DAYPAT.test(start)) return { error: "Pick the day it starts" };
    if (!DAYPAT.test(end) || end < start) end = start;
  } else {
    if (!STAMPPAT.test(start)) return { error: "Pick when it starts" };
    if (!STAMPPAT.test(end) || end <= start) end = addMinutes(start, 60);
  }
  const repeat = REPEATS[x.repeat] || x.repeat === "custom" ? x.repeat : "none";
  const until = repeat !== "none" && DAYPAT.test(x.until || "") && x.until >= dayOf(start) ? x.until : "";
  const n = Math.round(Number(x.count));
  const count = repeat !== "none" && !until && n >= 1 && n <= 999 ? n : null;
  const a = x.alert === "" || x.alert == null ? NaN : Number(x.alert);
  const alert = Number.isFinite(a) && a >= -1440 && a <= 40320 ? Math.round(a) : null;
  const url = /^https?:\/\/\S+$/i.test(String(x.url || "").trim()) ? String(x.url).trim().slice(0, 500) : "";
  return { event: { title, calendar: clip(x.calendar, 100), allDay, start, end, location: clip(x.location, 200), notes: clip(x.notes, 4000), url, repeat, until, count, alert } };
}

// The calendars a new event can go in: writable ones, only the Work ones at work; and which is picked first
export function writableCalendars(list = [], { atWork = false, work = [] } = {}) {
  return list.filter((c) => c && c.writable !== false && c.title && (!atWork || inCalendars(c.title, work)));
}
export function defaultCalendar(choices = [], { chosen = "", macDefault = "" } = {}) {
  const has = (n) => n && choices.find((c) => calendarName(c.title) === calendarName(n));
  return (has(chosen) || has(macDefault) || choices[0])?.title || "";
}

// One line for the toast and the day window: "Every week until Fri 30 Oct", "Every day, 5 times"
export function repeatText(f) {
  if (!f || !f.repeat || f.repeat === "none") return "";
  if (f.repeat === "custom") return "Repeats (set in Calendar)";
  const until = f.until ? ` until ${parseDay(f.until).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}` : f.count ? `, ${f.count} times` : "";
  return `${REPEATS[f.repeat]}${until}`;
}

// The days a repeating event falls on between FROM and TO (days, TO included): for the sample server, which has no
// EventKit to do it. Each occurrence keeps the length of the first.
export function occurrences(e, from, to) {
  const f = eventOf(e);
  const first = dayOf(f.start);
  const len = f.allDay ? Math.round((parseDay(f.end) - parseDay(f.start)) / 86_400_000) : minutesBetween(f.start, f.end);
  const skip = new Set(e.except || []);
  const out = [];
  const add = (day) => {
    const start = f.allDay ? day : `${day}T${timeOf(f.start)}`;
    if (skip.has(start)) return;
    out.push({ ...e, start, end: f.allDay ? addDays(day, len) : addMinutes(start, len), occurrence: start });
  };
  if (f.repeat === "none" || f.repeat === "custom") { if (first <= to && dayOf(f.end) >= from) add(first); return out; }
  const step = (day, i) => {
    const d = parseDay(first);
    if (f.repeat === "daily" || f.repeat === "weekdays") return addDays(day, 1);
    if (f.repeat === "weekly") return addDays(day, 7);
    if (f.repeat === "fortnightly") return addDays(day, 14);
    if (f.repeat === "monthly") return ymd(new Date(d.getFullYear(), d.getMonth() + i, d.getDate()));
    return ymd(new Date(d.getFullYear() + i, d.getMonth(), d.getDate()));
  };
  let day = first, n = 0;
  for (let i = 1; i < 2000 && day <= to; i++) {
    if (f.until && day > f.until) break;
    const weekday = parseDay(day).getDay();
    if (f.repeat !== "weekdays" || (weekday > 0 && weekday < 6)) {
      n++;
      if (f.count && n > f.count) break;
      if (day >= from || (f.allDay ? addDays(day, len) >= from : false)) add(day);
    }
    day = step(day, i);
  }
  return out;
}
