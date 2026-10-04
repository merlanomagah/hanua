// The kitchen window's weather, from Open-Meteo (free, no key). The town comes from WEATHER_PLACE in .env
// (the repo is public, so where Mel lives isn't written in the code). Hanua keeps it 30 minutes, never stores it.
import { dayParts, kindOf, summarisePart } from "../public/shared/weather.js";

const CACHE_MS = 30 * 60_000;
let cached = null, cachedAt = 0, place = null;

async function json(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

async function findPlace(name) {
  if (place?.query === name) return place;
  const r = await json(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(name)}`);
  const hit = r.results?.[0];
  if (!hit) throw new Error(`Couldn't find “${name}”`);
  place = { query: name, name: hit.name, lat: hit.latitude, lon: hit.longitude, timeZone: hit.timezone };
  return place;
}

// Hourly rows grouped by the place's own date: { "2026-10-06": [{ hour, temp, code, rain, cloud }] }
function byDay(hourly) {
  const days = {};
  hourly.time.forEach((t, i) => {
    const [date, clock] = t.split("T");
    (days[date] ||= []).push({ hour: Number(clock.slice(0, 2)), temp: hourly.temperature_2m[i], code: hourly.weather_code[i], rain: hourly.precipitation_probability?.[i] ?? 0, cloud: hourly.cloud_cover?.[i] ?? 0 });
  });
  return days;
}

function shapeDay(date, hours, daily, i) {
  const all = summarisePart(hours.filter((h) => h.hour >= 6 && h.hour < 21)) || summarisePart(hours);
  return {
    date, parts: dayParts(hours), kind: daily ? kindOf(daily.weather_code[i]) : all.kind,
    max: daily?.temperature_2m_max[i] ?? Math.max(...hours.map((h) => h.temp)), min: daily?.temperature_2m_min[i] ?? Math.min(...hours.map((h) => h.temp)),
    sunrise: daily?.sunrise[i]?.split("T")[1] ?? null, sunset: daily?.sunset[i]?.split("T")[1] ?? null,
  };
}

// A made-up day for the sample server and when Open-Meteo can't be reached: a bit of everything, so the window shows off.
function sampleWeather(reason) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour, temp: 11 + 7 * Math.sin(((hour - 8) / 24) * Math.PI * 2 * 0.75) + (hour > 6 ? 2 : 0),
    code: hour < 11 ? 2 : hour < 15 ? 0 : 80, rain: hour >= 15 ? 60 : 5, cloud: hour < 11 ? 45 : hour < 15 ? 10 : 70,
  }));
  const today = new Date().toISOString().slice(0, 10), tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const day = (date) => shapeDay(date, hours, null, 0);
  return { live: false, reason, place: process.env.WEATHER_PLACE || "Auckland", timeZone: null, now: { temp: 16, kind: "partly" }, days: [day(today), { ...day(tomorrow), kind: "showers" }] };
}

export async function getWeather() {
  const name = (process.env.WEATHER_PLACE || "").trim();
  if (!name) return sampleWeather("Add WEATHER_PLACE to .env for your own weather");
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  try {
    const p = await findPlace(name);
    const r = await json(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&timezone=auto&forecast_days=2`
      + "&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability,cloud_cover"
      + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset");
    const hours = byDay(r.hourly);
    cached = {
      live: true, place: p.name, timeZone: r.timezone || p.timeZone,
      now: { temp: r.current?.temperature_2m ?? null, kind: kindOf(r.current?.weather_code) },
      days: r.daily.time.map((date, i) => shapeDay(date, hours[date] || [], r.daily, i)),
    };
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    // keep showing the last good forecast if there is one; otherwise say so (the window never goes blank)
    return cached || { ...sampleWeather(err.message), unavailable: true };
  }
}
