// Shared by every part of the page: element helpers, the one state object, the API, toasts.
import { daysBetween, parseDay, todayStr, ymd } from "./shared/dates.js";

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
export const records = (id) => area(id)?.records ?? [];
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

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

export async function api(path, body) {
  const res = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// A short message at the bottom. Pass an action ({ label, run }) to offer e.g. Undo.
export function toast(msg, bad = false, action = null) {
  const t = $("toast");
  t.replaceChildren(msg);
  if (action) {
    const b = h("button", { type: "button", className: "toast-act", textContent: action.label });
    b.addEventListener("click", () => { t.classList.remove("show"); action.run(); });
    t.append(b);
  }
  t.classList.toggle("bad", bad);
  t.classList.toggle("has-action", Boolean(action));
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 3500);
}
