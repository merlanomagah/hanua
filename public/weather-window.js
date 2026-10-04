// ---------- the kitchen window: today's weather outside ----------
// A wide, short window whose frame splits the day into morning, midday and evening. Behind the bars is one sky,
// drawn in code, that blends from one part of the day to the next: its colour, the sun, drifting clouds, rain, snow
// or fog for each part. Each pane says its temperature and weather; a dashed line marks now. From 9 pm it shows
// tomorrow. Data: /api/weather (Open-Meteo, cached 30 min on the server; sample weather without WEATHER_PLACE).
import { $, h, reducedMotion, state } from "./lib.js";
import { KINDS, PARTS, nowAcross, showsTomorrow, todayLine } from "./shared/weather.js";
import { timeIn } from "./shared/dates.js";

// ---- the weather, and which day and hour it is out there ----
const placeNow = () => {
  const tz = state.weather?.timeZone;
  if (!tz) { const d = new Date(); return { hour: d.getHours(), minute: d.getMinutes() }; }
  return timeIn(tz);
};
export function shownDay() {
  const w = state.weather;
  if (!w?.days?.length) return null;
  const { hour } = placeNow();
  const tomorrow = showsTomorrow(hour) && w.days[1];
  return { day: tomorrow ? w.days[1] : w.days[0], tomorrow: Boolean(tomorrow) };
}
// the words for the lamp's curve: today's weather, the temperature now, and the high
export function weatherLine() {
  const w = state.weather;
  if (!w?.days?.length) return "";
  return todayLine(w.days[0], w.now?.temp);
}

export async function loadWeather() {
  try {
    const res = await fetch("/api/weather");
    if (!res.ok) throw new Error();
    state.weather = await res.json();
  } catch {
    if (!state.weather) state.weather = null;
  }
  renderWindow();
  document.dispatchEvent(new Event("hanua:weather"));
}

// ---- the panes' words ----
const clock12 = (hhmm) => {
  if (!hhmm) return "";
  const [hh, mm] = hhmm.split(":").map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
};
export function renderWindow() {
  const win = $("weather-window");
  if (!win) return;
  const shown = shownDay();
  const w = state.weather;
  win.classList.toggle("unavailable", !shown || Boolean(w?.unavailable));
  if (!shown) {
    $("ww-panes").replaceChildren(h("div", { className: "ww-pane" }, h("span", { className: "ww-words", textContent: "Weather unavailable" })));
    $("ww-place").textContent = "";
    $("ww-summary").textContent = "The window will fill in when the weather can be reached";
    $("ww-now").hidden = true;
    sky.parts = null;
    drawStill();
    return;
  }
  const { day, tomorrow } = shown;
  const { hour, minute } = placeNow();
  $("ww-panes").replaceChildren(...day.parts.map((p) => {
    const k = KINDS[p.kind] || KINDS.cloudy;
    const past = !tomorrow && hour >= p.to;
    return h("div", { className: `ww-pane${past ? " past" : ""}` },
      h("span", { className: "ww-label", textContent: `${tomorrow ? "Tomorrow · " : ""}${p.label}` }),
      h("span", { className: "ww-temp" }, `${p.temp ?? "–"}°`, h("em", { textContent: k.emoji, ariaHidden: "true" })),
      h("span", { className: "ww-words", textContent: p.rain >= 30 && !["clear", "partly", "cloudy"].includes(p.kind) ? `${k.words}, ${p.rain}%` : k.words }));
  }));
  const at = tomorrow ? null : nowAcross(hour, minute);
  $("ww-now").hidden = at == null;
  if (at != null) $("ww-now").style.left = `${at * 100}%`;
  const place = w.place || "";
  $("ww-place").textContent = `${place}${w.live ? "" : w.unavailable ? " · weather unavailable" : " · sample"}`;
  $("ww-summary").textContent = [tomorrow ? "Tomorrow" : "Today", `${Math.round(day.max)}° / ${Math.round(day.min)}°`, day.sunset ? `sunset ${clock12(day.sunset)}` : ""].filter(Boolean).join(" · ");
  win.setAttribute("aria-label", `${place} ${tomorrow ? "tomorrow" : "today"}: ${day.parts.map((p) => `${p.label.toLowerCase()} ${p.temp}°, ${(KINDS[p.kind] || KINDS.cloudy).words.toLowerCase()}`).join("; ")}`);
  sky.parts = day.parts;
  // the sky is only redrawn when the forecast changes (not every minute), so the clouds don't jump
  const key = `${day.date}|${day.parts.map((p) => p.kind).join(",")}`;
  if (key !== sky.key) { sky.key = key; buildSky(); }
  drawStill();
}

// ---- the sky ----
// Clear-sky colours for each part of the day (top of the glass, then the horizon), and how grey each weather makes it.
const CLEAR = { morning: ["#86b6db", "#f6dcc3"], midday: ["#5296d2", "#d4e9f5"], evening: ["#3e4e80", "#f1a66c"] };
const OVERCAST = ["#a7b0b8", "#d5d8da"], STORMY = ["#5c6670", "#8f969c"];
const CLOUD = { clear: 0.04, partly: 0.4, cloudy: 0.88, fog: 0.9, drizzle: 0.78, showers: 0.62, rain: 0.92, snow: 0.86, storm: 1 };
const DARK = { rain: 0.6, storm: 1, drizzle: 0.35, showers: 0.4, snow: 0.2 };
const RAIN = { drizzle: 0.35, showers: 0.65, rain: 0.95, storm: 1 };
const SUN = [{ x: 0.13, y: 0.6 }, { x: 0.5, y: 0.24 }, { x: 0.87, y: 0.62 }];

const sky = { parts: null, canvas: null, ctx: null, still: null, w: 0, h: 0, dpr: 1, clouds: [], drops: [], flakes: [], raf: 0, last: 0, t0: performance.now() };

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;
const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// how much each part of the day owns a point across the window (0..1): the parts blend over the frame's bars
const BLEND = 0.07;
function weights(x) {
  const w0 = 1 - smooth((x - (1 / 3 - BLEND)) / (2 * BLEND));
  const w2 = smooth((x - (2 / 3 - BLEND)) / (2 * BLEND));
  return [w0, Math.max(0, 1 - w0 - w2), w2];
}
const across = (x, f) => weights(x).reduce((s, w, i) => s + w * f(sky.parts[i], i), 0);
const partColours = (p) => {
  const clear = CLEAR[p.id].map(hex), over = OVERCAST.map(hex), storm = STORMY.map(hex), d = DARK[p.kind] || 0;
  const c = CLOUD[p.kind] ?? 0.5;
  return [mix(clear[0], mix(over[0], storm[0], d), c * 0.9), mix(clear[1], mix(over[1], storm[1], d), c * 0.85)];
};

function size() {
  const c = sky.canvas;
  const r = c.getBoundingClientRect();
  sky.dpr = Math.min(2, devicePixelRatio || 1);
  sky.w = Math.max(1, Math.round(r.width));
  sky.h = Math.max(1, Math.round(r.height));
  c.width = sky.w * sky.dpr;
  c.height = sky.h * sky.dpr;
}

// the parts that don't move: sky colour, the sun for each part, and the hills, drawn once per size or forecast
function buildSky() {
  if (!sky.canvas || !sky.parts) return;
  size();
  const { w, h, dpr } = sky;
  const still = sky.still || (sky.still = document.createElement("canvas"));
  still.width = w * dpr; still.height = h * dpr;
  const g = still.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = sky.parts.map(partColours);
  for (let x = 0; x < w; x += 2) {
    const wt = weights(x / w);
    const top = cols.reduce((s, c, i) => s.map((v, j) => v + wt[i] * c[0][j]), [0, 0, 0]);
    const hor = cols.reduce((s, c, i) => s.map((v, j) => v + wt[i] * c[1][j]), [0, 0, 0]);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, rgb(top));
    grad.addColorStop(0.78, rgb(hor));
    grad.addColorStop(1, rgb(hor));
    g.fillStyle = grad;
    g.fillRect(x, 0, 2.5, h);
  }
  // the sun in each part, where it would be at that time of day, through however much cloud there is
  sky.parts.forEach((p, i) => {
    const clear = 1 - (CLOUD[p.kind] ?? 0.5);
    if (clear < 0.08) return;
    const s = SUN[i], x = s.x * w, y = s.y * h, r = Math.min(w, h * 3) * 0.035;
    const warm = i === 2 ? [255, 190, 120] : i === 0 ? [255, 228, 180] : [255, 248, 225];
    const glow = g.createRadialGradient(x, y, 0, x, y, r * 7);
    glow.addColorStop(0, rgb(warm, 0.55 * clear));
    glow.addColorStop(1, rgb(warm, 0));
    g.fillStyle = glow;
    g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = rgb(warm.map((v) => Math.min(255, v + 20)), 0.92 * clear);
    g.fill();
  });
  // two lines of hills on the horizon, tinted by the light of each part of the day
  const hills = (base, amp, seed, tint, dark) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    [0, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6, 1].forEach((x) => {
      const wt = weights(x);
      const hor = cols.reduce((s, c, i) => s.map((v, j) => v + wt[i] * c[1][j]), [0, 0, 0]);
      const evening = wt[2];
      grad.addColorStop(x, rgb(mix(mix(hor, hex(tint), dark), [30, 34, 44], evening * 0.35)));
    });
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const y = h * base - h * amp * (0.55 * Math.sin(x / w * 5.3 + seed) + 0.3 * Math.sin(x / w * 11.7 + seed * 2.1) + 0.15 * Math.sin(x / w * 23 + seed));
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
  };
  hills(0.8, 0.07, 1.3, "#5f7a78", 0.45);
  hills(0.9, 0.06, 4.1, "#34483f", 0.78);
  seed();
}

// the things that move: clouds drifting right, rain, snow and fog, each as heavy as the part of the day they're in
function seed() {
  const { w, h } = sky;
  const rnd = (a, b) => a + Math.random() * (b - a);
  sky.clouds = Array.from({ length: Math.round(w / 60) }, (_, k) => ({ k, x: rnd(-0.1, 1.1), y: rnd(0.04, 0.45), s: rnd(0.6, 1.3), v: rnd(0.006, 0.012) }));
  sky.drops = Array.from({ length: Math.round(w / 6) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), l: rnd(8, 15), v: rnd(0.55, 0.9) }));
  sky.flakes = Array.from({ length: Math.round(w / 12) }, () => ({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(1, 2.2), v: rnd(0.04, 0.09), p: rnd(0, 6) }));
  void h;
}

// Clouds are soft: each is a few pictures made once from overlapping blurred blobs, then drawn scaled and faded
const SPRITES = [];
function cloudSprite(seedN, colour) {
  const c = document.createElement("canvas");
  c.width = 220; c.height = 110;
  const g = c.getContext("2d");
  let r = seedN * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 14; i++) {
    const x = 40 + rand() * 140, y = 52 + (rand() - 0.6) * 30, rad = 18 + rand() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, rgb(colour, 0.75));
    grad.addColorStop(0.55, rgb(colour, 0.45));
    grad.addColorStop(1, rgb(colour, 0));
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // a flatter, slightly shaded underside
  g.globalCompositeOperation = "source-atop";
  const shade = g.createLinearGradient(0, 30, 0, 100);
  shade.addColorStop(0, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(90,100,115,0.35)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 220, 110);
  return c;
}
function sprites() {
  if (!SPRITES.length) for (let i = 0; i < 4; i++) SPRITES.push({ light: cloudSprite(i + 1, [255, 255, 255]), dark: cloudSprite(i + 1, [118, 126, 136]) });
  return SPRITES;
}
function puff(g, c, x, y, s, dark, alpha) {
  if (alpha < 0.02) return;
  const sp = sprites()[c.k % 4], w = 150 * s, h = 75 * s;
  g.globalAlpha = alpha * (1 - dark);
  g.drawImage(sp.light, x - w / 2, y - h / 2, w, h);
  if (dark > 0.02) { g.globalAlpha = alpha * dark; g.drawImage(sp.dark, x - w / 2, y - h / 2, w, h); }
  g.globalAlpha = 1;
}

function frame(now) {
  const g = sky.ctx;
  if (!g || !sky.still) return;
  const { w, h, dpr } = sky;
  const dt = Math.min(0.1, (now - (sky.last || now)) / 1000);
  sky.last = now;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(sky.still, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!sky.parts) return;
  // clouds: lighter in fair weather, greyer where it rains
  for (const c of sky.clouds) {
    c.x += c.v * dt;
    if (c.x > 1.15) { c.x = -0.15; c.y = 0.06 + Math.random() * 0.44; }
    const x = Math.min(1, Math.max(0, c.x));
    const amount = across(x, (p) => CLOUD[p.kind] ?? 0.5);
    const dark = across(x, (p) => DARK[p.kind] || 0);
    puff(g, c, c.x * w, c.y * h, c.s * (0.8 + amount * 0.6), dark, Math.min(1, amount * 1.1));
  }
  // rain: fine slanted streaks
  g.lineWidth = 1;
  for (const d of sky.drops) {
    d.y += d.v * dt * 1.6;
    if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
    const a = across(d.x, (p) => RAIN[p.kind] || 0);
    if (a < 0.05) continue;
    const x = d.x * w, y = d.y * h;
    g.strokeStyle = `rgba(225,235,245,${0.5 * a})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - d.l * 0.28, y + d.l); g.stroke();
  }
  // snow: slow flakes that sway
  for (const f of sky.flakes) {
    f.y += f.v * dt;
    if (f.y > 1) { f.y = -0.03; f.x = Math.random(); }
    const a = across(f.x, (p) => (p.kind === "snow" ? 1 : 0));
    if (a < 0.05) continue;
    g.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    g.beginPath(); g.arc(f.x * w + Math.sin(now / 900 + f.p) * 4, f.y * h, f.r, 0, Math.PI * 2); g.fill();
  }
  // fog: a soft white veil, thicker low down, drifting a little
  const fog = g.createLinearGradient(0, 0, w, 0);
  let anyFog = false;
  for (let i = 0; i <= 12; i++) {
    const a = across(i / 12, (p) => (p.kind === "fog" ? 0.55 : 0));
    if (a > 0.01) anyFog = true;
    fog.addColorStop(i / 12, `rgba(236,238,240,${a})`);
  }
  if (anyFog) { g.fillStyle = fog; g.globalAlpha = 0.85 + 0.15 * Math.sin(now / 4000); g.fillRect(0, h * 0.3, w, h * 0.7); g.globalAlpha = 1; }
}

function drawStill() { if (sky.ctx) frame(performance.now()); }
const visible = () => document.visibilityState === "visible" && !$("kitchen-pane").inert;
function loop(now) {
  sky.raf = 0;
  if (!visible() || reducedMotion) return;
  if (now - sky.t0 >= 33) { sky.t0 = now; frame(now); }
  sky.raf = requestAnimationFrame(loop);
}
function start() {
  if (reducedMotion) return drawStill();
  if (!sky.raf && visible()) { sky.last = 0; sky.raf = requestAnimationFrame(loop); }
}

// ---- boot ----
sky.canvas = $("ww-sky");
sky.ctx = sky.canvas?.getContext("2d") || null;
document.addEventListener("hanua:kitchen", (e) => { if (e.detail) { buildSky(); drawStill(); start(); } });
document.addEventListener("visibilitychange", start);
let resizeTimer = 0;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!$("kitchen-pane").inert) { buildSky(); drawStill(); } }, 150); });
// the now line moves and the parts that are over fade, once a minute; a fresh forecast every 30 minutes
setInterval(() => { if (state.weather) renderWindow(); }, 60_000);
setInterval(loadWeather, 30 * 60_000);
loadWeather();
