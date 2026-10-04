// The kitchen window's weather rules, used by the server (shaping Open-Meteo's forecast) and the page (drawing it).
// No page imports here: the server loads this file.

// The window is split by its frame into three parts of the day. Hours are local to the place, [from, to).
export const PARTS = [
  { id: "morning", label: "Morning", from: 6, to: 11 },
  { id: "midday", label: "Midday", from: 11, to: 15 },
  { id: "evening", label: "Evening", from: 15, to: 21 },
];
// From 9 pm the day's done: the window shows tomorrow (the same hour the lights go off).
export const WINDOW_NIGHT = 21;
export const showsTomorrow = (hour) => hour >= WINDOW_NIGHT;

// WMO weather codes (what Open-Meteo sends) sorted into what the window can draw.
// Order is how much it matters: a wetter or wilder hour wins a tie.
export const KINDS = {
  clear: { emoji: "☀️", words: "Sunny", rank: 0 },
  partly: { emoji: "⛅", words: "Partly cloudy", rank: 1 },
  cloudy: { emoji: "☁️", words: "Cloudy", rank: 2 },
  fog: { emoji: "🌫️", words: "Fog", rank: 3 },
  drizzle: { emoji: "🌦️", words: "Drizzle", rank: 4 },
  showers: { emoji: "🌦️", words: "Showers", rank: 5 },
  rain: { emoji: "🌧️", words: "Rain", rank: 6 },
  snow: { emoji: "🌨️", words: "Snow", rank: 7 },
  storm: { emoji: "⛈️", words: "Thunderstorms", rank: 8 },
};
export function kindOf(code) {
  const c = Number(code);
  if (c === 0) return "clear";
  if (c === 1 || c === 2) return "partly";
  if (c === 3) return "cloudy";
  if (c === 45 || c === 48) return "fog";
  if (c >= 51 && c <= 57) return "drizzle";
  if ((c >= 61 && c <= 67)) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c >= 80 && c <= 82) return "showers";
  if (c >= 95) return "storm";
  return "cloudy";
}

// One part of the day from its hours: [{ hour, temp, code, rain, cloud }].
// The temperature is the part's average; the kind is the most common one (a wetter one wins a tie).
export function summarisePart(hours) {
  if (!hours.length) return null;
  const temp = Math.round(hours.reduce((s, x) => s + x.temp, 0) / hours.length);
  const count = {};
  for (const x of hours) { const k = kindOf(x.code); count[k] = (count[k] || 0) + 1; }
  const kind = Object.keys(count).sort((a, b) => count[b] - count[a] || KINDS[b].rank - KINDS[a].rank)[0];
  const cloud = Math.round(hours.reduce((s, x) => s + (x.cloud ?? 0), 0) / hours.length);
  const rain = Math.max(...hours.map((x) => x.rain ?? 0));
  return { kind, temp, cloud, rain };
}

// A day's three parts from its hourly rows.
export function dayParts(hours) {
  return PARTS.map((p) => ({ ...p, ...summarisePart(hours.filter((x) => x.hour >= p.from && x.hour < p.to)) }));
}

// Where "now" sits across the window, 0 (start of morning) to 1 (end of evening); null outside those hours.
export function nowAcross(hour, minute = 0) {
  const t = hour + minute / 60;
  const from = PARTS[0].from, to = PARTS[PARTS.length - 1].to;
  return t < from || t >= to ? null : (t - from) / (to - from);
}

// The words for the lamp's curve: "⛅ 17° · PARTLY CLOUDY · HIGH 19°"
export function todayLine(day, nowTemp) {
  if (!day) return "";
  const k = KINDS[day.kind] || KINDS.cloudy;
  const now = Number.isFinite(nowTemp) ? `${Math.round(nowTemp)}° · ` : "";
  return `${k.emoji} ${now}${k.words.toUpperCase()} · HIGH ${Math.round(day.max)}°`;
}
