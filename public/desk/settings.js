// Settings (Mel, 6 Oct 2026, roadmap step 6; brief docs/plans/2026-10-desk-settings.md): a gear in the dock opens a
// window like the others, in four groups: Planner (fixed sections, usual day, time words), Focus timer, Lists (which
// Reminders lists the desk uses, picked from hers) and Desk (the morning window, Hanua's own layout). Every change saves
// at once and applies at once (the hanua:settings event); each group goes back to Hanua's defaults, with Undo.
// Kept on this Mac (data/room/settings.json via /api/settings), so the nightly backup has them.
import { setTimeWords, TIME_PICKS, minsText, withFixed } from "../shared/desk.js";
import { renameSections, renames } from "../shared/settings.js";
import { $, focus, h, toast } from "../lib.js";
import { desk, save, setFixed } from "./state.js";
import { renderTodo } from "./page.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";
import { ownLayout } from "./arrange.js";
import { saidUpdated, syncState, typingIn } from "../sync.js";
import { APPEARANCES, DEFAULT_APPEARANCE } from "../shared/appearance.js";
import { appearance, setAppearance } from "../appearance.js";

export let settings = null;
let base = null, lists = null;
const win = $("settings-win");
const ready = resizable(win);

let rev; // the revision of Settings this window has: a change made on the other Mac since is never undone from here
export async function loadSettings(quiet = false) {
  let j;
  try { const res = await fetch("/api/settings"); if (!res.ok) return; j = await res.json(); } catch { return; }
  if (quiet && j.rev === rev) return;
  ({ settings, defaults: base } = j); rev = j.rev ?? null;
  applySettings();
  if (quiet) { if (!win.hidden) render(); renderTodo(); saidUpdated(toast); }
}
// the other Mac changed Settings: use them here too (the window redraws unless Mel is in one of its fields)
document.addEventListener("hanua:room", (e) => {
  const { kind } = e.detail || {};
  if (kind !== "all" && kind !== "settings") return;
  if (typingIn(win)) { win.addEventListener("focusout", () => setTimeout(() => loadSettings(true), 50), { once: true }); return; }
  loadSettings(true);
});
function applySettings() {
  setTimeWords(settings.timeWords);
  document.dispatchEvent(new CustomEvent("hanua:settings", { detail: settings }));
}

// save the whole set (the server tidies it), apply it, and say so quietly in the title bar
let saving = 0;
async function put(next, { undoText = null } = {}) {
  const before = settings;
  try {
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, base: rev }) });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.settings) {
      // changed on the other Mac since this window read them: show theirs, so nothing of theirs is undone; Mel's
      // change can then be made again on top
      ({ settings, defaults: base } = j); rev = j.rev ?? null;
      applySettings(); render(); renderTodo();
      toast("Settings were just changed on your other Mac: they're shown now. Make your change again if it's still needed.", true);
      return;
    }
    if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
    ({ settings, defaults: base } = j); rev = j.rev ?? rev;
  } catch (err) { toast(`Settings couldn't be saved: ${err.message}`, true); return; }
  // fixed sections renamed: today's section of the old name takes the new one; then today has every fixed one
  const pairs = renames(before.fixedSections, settings.fixedSections);
  setFixed(settings.fixedSections);
  renameSections(desk, pairs);
  withFixed(desk, settings.fixedSections);
  save();
  applySettings();
  renderTodo();
  render();
  clearTimeout(saving);
  const note = win.querySelector(".set-saved");
  if (note) { note.textContent = "Saved"; saving = setTimeout(() => { note.textContent = ""; }, 1600); }
  if (undoText) toast(undoText, false, { label: "Undo", run: () => put(before) });
}
const change = (fn) => { const next = structuredClone(settings); fn(next); put(next); };

const group = (title, reset, ...rows) => {
  const r = reset ? h("button", { type: "button", className: "set-reset", textContent: "Back to Hanua's defaults" }) : null;
  r?.addEventListener("click", reset);
  return h("section", { className: "set-group" }, h("div", { className: "set-head" }, h("h3", { textContent: title }), r), ...rows);
};
const row = (label, ...field) => h("label", { className: "set-row" }, h("span", { className: "set-label", textContent: label }), ...field);

function plannerGroup() {
  const fixedRows = settings.fixedSections.map((f, i) => {
    const name = h("input", { type: "text", className: "set-in", value: f.name, ariaLabel: `Fixed section ${i + 1}`, maxLength: 40 });
    name.addEventListener("change", () => { if (name.value.trim()) change((n) => { n.fixedSections[i].name = name.value.trim(); }); else name.value = f.name; });
    const work = h("button", { type: "button", className: `pl-work${f.work ? " on" : ""}`, ariaPressed: String(f.work), title: f.work ? "Work: shows at work" : "Personal", textContent: "Work" });
    work.addEventListener("click", () => change((n) => { n.fixedSections[i].work = !f.work; }));
    const mv = (d, label) => { const b = h("button", { type: "button", className: "set-mv", textContent: d < 0 ? "↑" : "↓", ariaLabel: `${label} ${f.name}`, disabled: d < 0 ? i === 0 : i === settings.fixedSections.length - 1 }); b.addEventListener("click", () => change((n) => { const [x] = n.fixedSections.splice(i, 1); n.fixedSections.splice(i + d, 0, x); })); return b; };
    const del = h("button", { type: "button", className: "set-mv", textContent: "×", ariaLabel: `Stop keeping ${f.name} every day`, title: "Not fixed any more (today's stays as an ordinary section)" });
    del.addEventListener("click", () => put({ ...settings, fixedSections: settings.fixedSections.filter((_, j) => j !== i) }, { undoText: `${f.name} isn't fixed any more` }));
    return h("li", { className: "set-fixed" }, name, work, mv(-1, "Move up"), mv(1, "Move down"), del);
  });
  const add = h("input", { type: "text", className: "set-in", placeholder: "+ Add a fixed section, then Enter", ariaLabel: "New fixed section", maxLength: 40 });
  add.addEventListener("keydown", (e) => { if (e.key === "Enter" && add.value.trim()) { e.preventDefault(); const v = add.value.trim(); change((n) => { n.fixedSections.push({ name: v, work: false }); }); } });
  const time = (k, label) => { const t = h("input", { type: "time", className: "pl-time", value: settings.day[k], ariaLabel: label, step: 900 }); t.addEventListener("change", () => { if (t.value) change((n) => { n.day[k] = t.value; }); }); return t; };
  const words = TIME_PICKS.map((m) => {
    const w = h("input", { type: "text", className: "set-in set-word", value: settings.timeWords[m], ariaLabel: `Word for ${minsText(m)}`, maxLength: 16 });
    w.addEventListener("change", () => change((n) => { n.timeWords[m] = w.value.trim(); }));
    return h("label", { className: "set-wordrow" }, h("span", { textContent: minsText(m) }), w);
  });
  return group("Planner", () => put({ ...settings, fixedSections: base.fixedSections, day: base.day, timeWords: base.timeWords }, { undoText: "Planner settings back to Hanua's" }),
    h("p", { className: "set-sub", textContent: "Sections every day has, after General" }), h("ul", { className: "set-list" }, fixedRows), add,
    row("Your usual day", time("start", "Usual start"), h("span", { textContent: "–" }), time("end", "Usual end")),
    h("p", { className: "set-note", textContent: "A new day starts with these hours; today's are on the page." }),
    h("p", { className: "set-sub", textContent: "Words for the time picks" }), h("div", { className: "set-words" }, words));
}
function timerGroup() {
  const num = (k, label, lo, hi) => { const n = h("input", { type: "number", className: "set-in set-num", min: lo, max: hi, value: settings.timer[k], ariaLabel: label }); n.addEventListener("change", () => change((x) => { x.timer[k] = Number(n.value); })); return n; };
  return group("Focus timer", () => put({ ...settings, timer: base.timer }, { undoText: "Timer back to 25 / 5" }),
    row("Focus", num("focus", "Focus minutes", 5, 120), h("span", { textContent: "minutes" })),
    row("Break", num("rest", "Break minutes", 1, 60), h("span", { textContent: "minutes" })));
}
function listsGroup() {
  if (!lists) { loadLists(); return group("Lists", null, h("p", { className: "set-note", textContent: "Asking Reminders for your lists…" })); }
  const pick = (k, label, fallback) => {
    const s = h("select", { className: "set-in", ariaLabel: label }, h("option", { value: "", textContent: fallback }), lists.lists.map((n) => h("option", { value: n, textContent: n, selected: settings.lists[k] === n })));
    s.addEventListener("change", () => change((x) => { x.lists[k] = s.value; }));
    return s;
  };
  return group("Lists", () => put({ ...settings, lists: base.lists }, { undoText: "Lists back to Hanua's" }),
    row("Shopping list", pick("shopping", "Shopping list", "Shopping (made if missing)")),
    row("Add reminder puts them in", pick("reminders", "Reminders list", lists.defaultList ? `${lists.defaultList} (your default)` : "Your default list")),
    !lists.live ? h("p", { className: "set-note", textContent: lists.reason === "denied" || lists.reason === "ask" ? "Hanua can't see Reminders yet: allow it when macOS asks (or System Settings → Privacy & Security → Reminders → Hanua Calendar)." : "Reminders is off on this server: sample lists." }) : null);
}
async function loadLists() {
  try { lists = await (await fetch("/api/reminders/lists")).json(); } catch { lists = { live: false, lists: [] }; }
  render();
}
// Appearance (brief docs/plans/2026-10-dark-mode.md): this Mac's choice, kept in browser storage like the lights
function appearanceGroup() {
  const pick = h("select", { className: "set-in", ariaLabel: "Appearance" }, Object.entries(APPEARANCES).map(([v, label]) => h("option", { value: v, textContent: label, selected: appearance === v })));
  const set = (v, undoText) => {
    const before = appearance;
    setAppearance(v);
    render();
    if (undoText) toast(undoText, false, { label: "Undo", run: () => { setAppearance(before); render(); } });
  };
  pick.addEventListener("change", () => set(pick.value));
  return group("Appearance", appearance === DEFAULT_APPEARANCE ? null : () => set(DEFAULT_APPEARANCE, "Appearance back to following your Mac"),
    row("Dark windows", pick),
    h("p", { className: "set-note", textContent: "The desk's windows, widgets and dock go dark; the room's real things keep their colours and dim with the lights. This Mac only." }));
}
function deskGroup() {
  const auto = h("input", { type: "checkbox", checked: settings.desk.autoOpen });
  auto.addEventListener("change", () => change((x) => { x.desk.autoOpen = auto.checked; }));
  const own = h("button", { type: "button", className: "set-reset", textContent: "Use Hanua's own layout" });
  own.addEventListener("click", () => ownLayout());
  return group("Desk", null,
    h("label", { className: "set-check" }, auto, h("span", { textContent: "On my first visit each day, open To-do.txt (planned) or Plan my day (started)" })),
    h("div", { className: "set-row" }, h("span", { className: "set-label", textContent: "Layout" }), own),
    h("p", { className: "set-note", textContent: "To save your own: right-click the desk → Save current layout as default." }),
    h("p", { className: "set-note set-sync", textContent: sharedLine() }));
}
// where the days, menus, stickies and Settings live: this Mac only, or the iCloud folder both Macs share
function sharedLine() {
  const s = syncState;
  if (!s?.shared) return "Your days, menus and stickies are kept on this Mac only.";
  if (s.warning) return s.warning;
  const ago = s.lastRemote ? Math.round((Date.now() - new Date(s.lastRemote)) / 60_000) : null;
  return `Shared with your other Mac (iCloud Drive › ${s.folder}).${ago === null ? "" : ` Last change from it: ${ago < 1 ? "just now" : `${ago} min ago`}.`}`;
}
document.addEventListener("hanua:sync", () => { if (!win.hidden && !typingIn(win)) render(); }); // never mid-typing

function render() {
  if (win.hidden || !settings) return;
  const scroll = win.querySelector(".txt-body")?.scrollTop || 0;
  const bar = windowBar(win, "Settings", [h("span", { className: "set-saved", ariaLive: "polite" })], () => { hide(); $("dock-settings").focus({ preventScroll: true }); });
  const body = h("div", { className: "txt-body set-body" }, plannerGroup(), timerGroup(), focus.on ? null : listsGroup(), appearanceGroup(), deskGroup());
  win.replaceChildren(bar, body);
  body.scrollTop = scroll;
}
let placed = false;
function show() {
  win.hidden = false;
  if (!placed) { restorePlace(win); placed = true; ready(); }
  lists = null;
  render();
}
const hide = () => { win.hidden = true; noteClosed("settings-win"); };
const ICON = '<svg viewBox="0 0 24 24" width="30" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="#5c564c" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#5c564c" stroke-width="1.6" stroke-linecap="round"/></svg>';
registerWindow("settings-win", { title: "Settings", icon: ICON, show, hide, shown: () => !win.hidden });
export function openSettings() { if (!settings) return; show(); noteOpen("settings-win"); }

$("dock-settings").addEventListener("click", openSettings);
loadSettings();
