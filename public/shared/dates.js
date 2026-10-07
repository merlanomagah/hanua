// Day arithmetic on "YYYY-MM-DD" strings, shared by the page and the server.

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const dayOf = (iso) => (iso || "").slice(0, 10);
export const timeOf = (iso) => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
export const parseDay = (iso) => { const [y, m, d] = dayOf(iso).split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
export const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return ymd(d); };

// The room's lights switch themselves: off at 9 pm, on at 4 am (the "Good night" hours), or the hours Mel set in
// Hanua Settings → Room (8 Oct 2026).
// The most recent switch at or before `now`: { key, on }. The page applies each key once, so a pull of the cord
// afterwards wins until the next switch.
export const LIGHTS_OFF_HOUR = 21, LIGHTS_ON_HOUR = 4;
export function lastLightSwitch(now = new Date(), off = LIGHTS_OFF_HOUR, on = LIGHTS_ON_HOUR) {
  const hr = now.getHours();
  const day = ymd(now), yesterday = addDays(day, -1);
  if (off > on) { // the usual night: off in the evening, on the next morning
    if (hr >= off) return { key: `${day} off`, on: false };
    if (hr >= on) return { key: `${day} on`, on: true };
    return { key: `${yesterday} off`, on: false };
  }
  // off after midnight (e.g. off at 1, on at 6): the evening belongs to the day before
  if (hr >= on) return { key: `${day} on`, on: true };
  if (hr >= off) return { key: `${day} off`, on: false };
  return { key: `${yesterday} on`, on: true };
}

// The Monday that starts the week holding `d` (a Date), as YYYY-MM-DD
export const weekStart = (d = new Date()) => ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));

// A week's name as the room saves it (its Monday, YYYY-MM-DD), or null for anything that isn't a real Monday
export function weekKey(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  const d = parseDay(s);
  return ymd(d) === s && d.getDay() === 1 ? s : null;
}

// The wall clocks: the time in another place, and how far ahead or behind the Mac's own time it is.
// { hour, minute, weekday ("MON"), day (5), month ("OCT"), dayShift (-1, 0, 1 against here), ahead (hours, e.g. -2 or 0.5) }
export function timeIn(timeZone, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-NZ", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const there = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const here = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
  const dayThere = Date.UTC(+parts.year, +parts.month - 1, +parts.day), dayHere = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    hour: +parts.hour, minute: +parts.minute, weekday: parts.weekday.toUpperCase(), day: +parts.day,
    month: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][+parts.month - 1],
    dayShift: Math.round((dayThere - dayHere) / 86_400_000), ahead: Math.round((there - here) / 1_800_000) / 2,
  };
}
// "−2 h", "+1 h", "same time", "−3½ h"
export function aheadText(ahead) {
  if (!ahead) return "same time";
  const n = Math.abs(ahead), whole = Math.floor(n);
  return `${ahead < 0 ? "−" : "+"}${whole || ""}${n % 1 ? "½" : ""} h`;
}
