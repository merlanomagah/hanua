// Shared by every part of the page: element helpers, the one state object, the API, toasts.
import { daysBetween, parseDay, todayStr, ymd } from "./shared/dates.js";

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

export const $ = (id) => document.getElementById(id);
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isNarrow = () => matchMedia("(max-width: 900px)").matches;

export const state = { areas: [], money: null, status: {}, goals: { goals: [], live: false, notionUrl: null }, records: [], reviews: { reviews: [], live: false }, shop: { items: [], live: false, coinsPerDollar: 10, coinsPerLevel: { Epic: 1000, Feature: 250, PBI: 50, Task: 10 } } };

// ---------- helpers ----------

export function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export const num = (n, dp = 0) => Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const money = (n, dp = 0) => "$" + num(n, dp);

export function fmtDay(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return iso ? parseDay(iso).toLocaleDateString(undefined, opts) : "";
}
// "Saturday, 3 October" in a fixed order, whatever the browser's locale
export function longDate(d, comma = true) {
  const wd = d.toLocaleDateString(undefined, { weekday: "long" });
  const mon = d.toLocaleDateString(undefined, { month: "long" });
  return `${wd}${comma ? "," : ""} ${d.getDate()} ${mon}`;
}
export const area = (id) => state.areas.find((a) => a.id === id);

// Focus ("At work"): only what's marked Work is on screen, for when someone can see it. Allow-list, so anything
// unmarked stays hidden. The Work book shows; the Calendar shows Work events and "Busy" for the rest; every
// other book, money, earnings and the shop are hidden. Goals show when their Area (or an ancestor's) is Work.
export const focus = { on: store("room-focus") === "work" };
const FOCUS_BOOKS = new Set(["work", "calendar"]);
const isWork = (v) => /^work$/i.test(v || "");
export const hiddenInFocus = (id) => focus.on && !FOCUS_BOOKS.has(id);
const busy = (r) => (isWork(r.status) ? r : { id: r.id, date: r.date, title: "Busy", status: "Busy", busy: true, fields: {} });
export const records = (id) => {
  const list = area(id)?.records ?? [];
  if (!focus.on) return list;
  if (hiddenInFocus(id)) return [];
  return id === "calendar" ? list.map(busy) : list;
};
// a goal is Work when its Area (or its nearest ancestor's) is Work; byId: Map of every goal by id
export const isWorkGoal = (g, byId, depth = 0) => (g.area ? isWork(g.area) : Boolean(g.parent) && depth < 8 && byId.has(g.parent) && isWorkGoal(byId.get(g.parent), byId, depth + 1));
export function focusGoals(list) {
  if (!focus.on) return list;
  const byId = new Map(list.map((g) => [g.id, g]));
  return list.filter((g) => isWorkGoal(g, byId));
}
export const isDone = (r) => /^(done|complete|reached)/i.test(r.status || "");

// The newest Notion edit across a book's rows, and how long ago that was in words
export function lastEdited(id) {
  return records(id).reduce((max, r) => (r.edited && new Date(r.edited) > new Date(max || 0) ? r.edited : max), null);
}
export function ago(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = daysBetween(ymd(new Date(iso)), todayStr());
  if (days <= 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `on ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}
export const updatedLine = (id) => { const e = lastEdited(id); return e ? `updated ${ago(e)}` : ""; };


export async function api(path, body) {
  const res = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// A short message at the bottom. Pass an action ({ label, run }) to offer e.g. Undo, or a list of them for a choice
// (which then waits longer).
// Messages queue (Foundations F5, 9 Oct 2026): a problem, or a choice with two or more answers (Use theirs / Keep mine),
// is never wiped by a later message; that one waits and shows next. Anything else replaces what's showing, as before
// (a newer Undo replaces an older one). Problems are announced at once to screen readers (role alert).
const waiting = [];
let showing = null; // { bad, choices }
const important = (m) => m && (m.bad || m.choices > 1);
export function toast(msg, bad = false, action = null) {
  const acts = Array.isArray(action) ? action : action ? [action] : [];
  const m = { msg, bad, acts, choices: acts.length };
  if (important(showing) && $("toast").classList.contains("show")) {
    waiting.push(m); // in the order they came
    if (waiting.length > 6) waiting.splice(0, waiting.length - 6);
    return;
  }
  show(m);
}
function show(m) {
  const t = $("toast");
  showing = m;
  t.replaceChildren(m.msg);
  for (const a of m.acts) {
    const b = h("button", { type: "button", className: "toast-act", textContent: a.label });
    b.addEventListener("click", () => { t.classList.remove("show"); clearTimeout(toast.timer); a.run(); next(); });
    t.append(b);
  }
  t.setAttribute("role", m.bad ? "alert" : "status");
  t.classList.toggle("bad", m.bad);
  t.classList.toggle("has-action", m.acts.length > 0);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.classList.remove("show"); next(); }, m.acts.length > 1 ? 15000 : m.acts.length ? 6000 : m.bad ? 6000 : 3500);
}
function next() {
  showing = null;
  const m = waiting.shift();
  if (m) setTimeout(() => show(m), 250);
}
