// The plant on the greeting shelf: it grows with every day Mel waters it, and browns when days are missed.
// The kind version (Mel, 5 Oct 2026): growth is never taken away, and one watering brings it straight back.
// Shared so the rules are tested; the log itself is a list of watered days (YYYY-MM-DD), kept on the Mac.
import { daysBetween } from "./dates.js";

// Days since the last watering -> how it looks
export const HEALTH = [
  { from: 0, name: "fresh", words: "happy" },
  { from: 2, name: "thirsty", words: "a little thirsty" },
  { from: 3, name: "wilting", words: "wilting" },
  { from: 5, name: "browning", words: "going brown" },
  { from: 8, name: "dormant", words: "mostly brown, but it'll come back with water" },
];

export function plantState(watered = [], today) {
  const days = [...new Set(watered)].filter((d) => d <= today).sort();
  const last = days[days.length - 1] || null;
  const since = last ? daysBetween(last, today) : null;
  // never watered: a fresh new plant, not a thirsty one
  const health = since == null ? HEALTH[0] : [...HEALTH].reverse().find((h) => since >= h.from);
  return { days: days.length, last, since, wateredToday: since === 0, health: health.name, words: health.words };
}
