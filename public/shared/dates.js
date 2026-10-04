// Day arithmetic on "YYYY-MM-DD" strings, shared by the page and the server.

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const dayOf = (iso) => (iso || "").slice(0, 10);
export const timeOf = (iso) => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
export const parseDay = (iso) => { const [y, m, d] = dayOf(iso).split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
export const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return ymd(d); };

// The room's lights switch themselves: off at 9 pm, on at 4 am (the "Good night" hours).
// The most recent switch at or before `now`: { key, on }. The page applies each key once, so a pull of the cord
// afterwards wins until the next switch.
export const LIGHTS_OFF_HOUR = 21, LIGHTS_ON_HOUR = 4;
export function lastLightSwitch(now = new Date()) {
  const hr = now.getHours();
  const day = ymd(now), yesterday = addDays(day, -1);
  if (hr >= LIGHTS_OFF_HOUR) return { key: `${day} off`, on: false };
  if (hr >= LIGHTS_ON_HOUR) return { key: `${day} on`, on: true };
  return { key: `${yesterday} off`, on: false };
}
