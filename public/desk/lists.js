// The Shopping list and Add reminder (Mel, 6 Oct 2026; brief docs/plans/2026-10-desk-arrange-and-lists.md, part C).
// Both live in Apple Reminders, so they're on Mel's phone at the shop and Siri can add to them; Hanua shows them and
// adds to them, and keeps no copy (server/calendar.js, /api/reminders). Shopping items have no date, so they never
// alert; a reminder has a time and an alert. Both are personal: put away at work. Windows drag by the title bar and
// resize from the corner, like To-do.txt (places kept in this browser).
import { $, focus, h, toast } from "../lib.js";
import { check } from "./page.js";

const post = async (url, body) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j;
};
const NOT_ALLOWED = "Hanua can't see Reminders yet. macOS asks once: say OK. If it didn't ask: System Settings → Privacy & Security → Reminders → Hanua Calendar.";

// ---- a window on the desktop: a title bar with the red close button, dragged by the bar, resized from the corner ----
function windowBar(win, title, tools, onClose) {
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: `Close ${title}`, title: "Close" });
  close.addEventListener("click", onClose);
  const bar = h("div", { className: "pw-bar txt-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
    h("span", { className: "pw-title", textContent: title }), h("span", { className: "pw-tools txt-date" }, ...tools));
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a")) return;
    const box = win.getBoundingClientRect(), host = win.offsetParent.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(host.width - box.width, ev.clientX - host.left - dx)), y = Math.max(0, Math.min(host.height - 60, ev.clientY - host.top - dy));
      win.style.left = `${x}px`; win.style.top = `${y}px`;
    };
    const up = () => { bar.removeEventListener("pointermove", move); keepPlace(win); };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up, { once: true });
  });
  return bar;
}
const placeKey = (win) => `win-${win.id}`;
function keepPlace(win) {
  try { localStorage.setItem(placeKey(win), JSON.stringify({ x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight })); } catch { /* fine */ }
}
function restorePlace(win) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(placeKey(win)) || "null"); } catch { p = null; }
  if (!p) return;
  win.style.left = `${p.x}px`; win.style.top = `${p.y}px`;
  if (p.w) { win.style.width = `${p.w}px`; win.style.height = `${p.h}px`; win.style.maxHeight = "none"; }
}
function resizable(win) {
  let ready = false;
  new ResizeObserver(() => { if (ready && !win.hidden) keepPlace(win); }).observe(win);
  return () => { ready = false; requestAnimationFrame(() => { ready = true; }); }; // only Mel's own resizing is kept
}

// ---- the Shopping list ----
const shop = $("shop-win");
let items = [], state = "loading", listName = "Shopping";
const shopReady = resizable(shop);
async function loadShop() {
  try {
    const j = await (await fetch("/api/reminders/shopping")).json();
    items = j.items || []; listName = j.list || listName;
    state = j.live === false && j.reason ? j.reason : j.live === false ? "sample" : "live";
  } catch { state = "error"; }
  renderShop();
}
async function addItem(title) {
  const t = title.trim();
  if (!t) return;
  const temp = { id: `new-${Date.now()}`, title: t, pending: true };
  items.push(temp); renderShop(true);
  try { const j = await post("/api/reminders/shopping", { title: t }); temp.id = j.id; temp.pending = false; }
  catch (err) { items = items.filter((x) => x !== temp); toast(`Couldn't add it: ${err.message}`, true); }
  renderShop(true);
}
async function tick(item) {
  item.done = true; renderShop();
  try {
    await post(`/api/reminders/${encodeURIComponent(item.id)}/done`, { done: true });
    toast(`${item.title}: got it`, false, { label: "Undo", run: async () => {
      try { await post(`/api/reminders/${encodeURIComponent(item.id)}/done`, { done: false }); item.done = false; renderShop(); }
      catch (err) { toast(err.message, true); }
    } });
    setTimeout(() => { if (item.done) { items = items.filter((x) => x !== item); renderShop(); } }, 4000); // ticked ones drop off; Reminders keeps them as completed
  } catch (err) { item.done = false; renderShop(); toast(err.message, true); }
}
function renderShop(keepTyping = false) {
  if (shop.hidden) return;
  const typed = shop.querySelector(".shop-add")?.value || "";
  const open = h("button", { type: "button", className: "pw-btn", textContent: "Reminders ↗", title: "Open the list in Reminders (share it, or set it to Groceries there)" });
  open.addEventListener("click", () => post("/api/reminders/show").catch(() => {}));
  const bar = windowBar(shop, "Shopping list", [open], () => { shop.hidden = true; $("open-shop").focus({ preventScroll: true }); });
  const input = h("input", { type: "text", className: "shop-add", placeholder: "Add an item, then Enter", ariaLabel: "Add to the shopping list", maxLength: 200, autocomplete: "off", value: keepTyping ? "" : typed });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); const v = input.value; input.value = ""; addItem(v); } });
  const rows = items.map((it) => {
    const t = check(Boolean(it.done), `Got ${it.title}`);
    t.disabled = Boolean(it.pending);
    t.addEventListener("click", () => { if (!it.done) tick(it); });
    return h("li", { className: `txt-line${it.done ? " done" : ""}` }, t, h("span", { className: "txt-text", textContent: it.title }));
  });
  const note = state === "denied" || state === "ask" ? NOT_ALLOWED : state === "error" ? "Reminders didn't answer. Try again in a moment." : !items.length ? "Nothing on the list yet." : "";
  const body = h("div", { className: "txt-body" }, input,
    rows.length ? h("ul", { className: "txt-list" }, rows) : null,
    note ? h("p", { className: "txt-empty", textContent: note }) : null,
    h("p", { className: "list-from", textContent: state === "sample" ? "Sample list (Reminders is off on this server)" : `In Reminders: ${listName}` }));
  shop.replaceChildren(bar, body);
  if (keepTyping) input.focus({ preventScroll: true });
}
export function openShop() {
  if (focus.on) return;
  const first = shop.hidden;
  shop.hidden = false;
  if (first) { restorePlace(shop); shopReady(); }
  renderShop();
  shop.querySelector(".shop-add")?.focus({ preventScroll: true });
  loadShop();
}

// ---- Add reminder: what and when, into Reminders with an alert ----
const rem = $("rem-win");
const remReady = resizable(rem);
const pad = (n) => String(n).padStart(2, "0");
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// quick picks: later today (in about 3 hours, on the hour), this evening (6 pm), tomorrow morning (9 am); or any time
function picks(now = new Date()) {
  const later = new Date(now); later.setMinutes(0, 0, 0); later.setHours(later.getHours() + 3);
  const evening = new Date(now); evening.setHours(18, 0, 0, 0);
  const morning = new Date(now); morning.setDate(morning.getDate() + 1); morning.setHours(9, 0, 0, 0);
  const out = [];
  if (later.getDate() === now.getDate() && later.getHours() < 22) out.push(["Later today", later]);
  if (evening > now && Math.abs(evening - later) > 30 * 60_000) out.push(["This evening", evening]);
  out.push(["Tomorrow morning", morning]);
  return out;
}
const whenText = (d) => d.toLocaleString("en-NZ", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function renderRem() {
  const bar = windowBar(rem, "Add reminder", [], () => { rem.hidden = true; $("open-remind").focus({ preventScroll: true }); });
  const what = h("input", { type: "text", className: "shop-add", placeholder: "Remind me to…", ariaLabel: "What to be reminded of", maxLength: 200, autocomplete: "off" });
  let when = picks()[0][1];
  const at = h("input", { type: "datetime-local", className: "rem-at", ariaLabel: "When", value: local(when), step: 300 });
  const chips = picks().map(([label, d], i) => {
    const b = h("button", { type: "button", className: `rem-pick${i === 0 ? " on" : ""}`, textContent: label, title: whenText(d) });
    b.addEventListener("click", () => { when = d; at.value = local(d); rem.querySelectorAll(".rem-pick").forEach((x) => x.classList.toggle("on", x === b)); });
    return b;
  });
  at.addEventListener("input", () => { if (at.value) when = new Date(at.value); rem.querySelectorAll(".rem-pick").forEach((x) => x.classList.remove("on")); });
  const save = h("button", { type: "button", className: "pl-go", textContent: "Remind me" });
  const go = async () => {
    const title = what.value.trim();
    if (!title) { what.focus(); return; }
    save.disabled = true;
    try {
      const j = await post("/api/reminders", { title, due: at.value });
      rem.hidden = true; $("open-remind").focus({ preventScroll: true });
      toast(`Reminder set: ${whenText(new Date(at.value))}${j.live === false ? " (sample: Reminders is off here)" : ""}`, false, { label: "Undo", run: () => post(`/api/reminders/${encodeURIComponent(j.id)}/remove`).catch((err) => toast(err.message, true)) });
    } catch (err) { toast(err.message.includes("allowed") ? NOT_ALLOWED : `Couldn't set it: ${err.message}`, true); }
    finally { save.disabled = false; }
  };
  save.addEventListener("click", go);
  what.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); go(); } });
  rem.replaceChildren(bar, h("div", { className: "txt-body rem-body" }, what, h("div", { className: "rem-picks" }, ...chips), h("div", { className: "rem-row" }, at, save)));
  what.focus({ preventScroll: true });
}
export function openRemind() {
  if (focus.on) return;
  const first = rem.hidden;
  rem.hidden = false;
  if (first) { restorePlace(rem); remReady(); }
  renderRem();
}

// at work both are put away (personal), files included
function applyWork() {
  for (const id of ["open-shop", "open-remind"]) $(id).hidden = focus.on;
  if (focus.on) { shop.hidden = true; rem.hidden = true; }
}
document.addEventListener("hanua:focus", applyWork);
addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (!rem.hidden && rem.contains(document.activeElement)) { rem.hidden = true; $("open-remind").focus({ preventScroll: true }); }
});

export function initLists(desktopFile) {
  desktopFile($("open-shop"), openShop);
  desktopFile($("open-remind"), openRemind);
  applyWork();
}
