// Apple Calendar events as the room shows them: one item per day they fall on, in their calendar's colour.
// Read live from the Mac (server/calendar.js) and never kept; used by the server and the page.
import { addDays, dayOf, timeOf } from "./dates.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_DAYS = 62; // a holiday is spread across its days; anything longer is shown on its first day only

// The helper's events → calendar items. All-day events covering several days appear on each of them;
// timed events sit on the day they start.
export function appleItems(events = []) {
  const items = [];
  for (const e of events) {
    if (!e || typeof e.title !== "string") continue;
    const base = { title: e.title.trim() || "(No title)", kind: e.calendar || "Calendar", calendar: e.calendar || "", color: /^#[0-9a-f]{6}$/i.test(e.color || "") ? e.color : "#3B6B5A", apple: true, location: e.location || "" };
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
