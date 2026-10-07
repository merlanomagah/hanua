// Desk Settings (Mel, 6 Oct 2026, roadmap step 6; brief docs/plans/2026-10-desk-settings.md): a gear in the dock opens a
// window like the others, in groups: Planner (fixed sections, usual day, time words), Focus timer, Lists (which
// Reminders lists the desk uses, picked from hers) and Desk (the morning window, Hanua's own layout). Everything that
// isn't the desk's (sleep screen, lights, clocks, calendars, weather, appearance) is in Hanua Settings on the rail
// (public/settings/window.js, 8 Oct 2026). Both read and save the same Settings (public/settings/store.js): every
// change saves and applies at once; each group goes back to Hanua's defaults, with Undo.
import { TIME_PICKS, minsText, withFixed } from "../shared/desk.js";
import { change, defaults, put, settings } from "../settings/store.js";
import { group, row } from "../settings/common.js";
import { renameSections, renames } from "../shared/settings.js";
import { $, focus, h, toast } from "../lib.js";
import { desk, save, setFixed } from "./state.js";
import { renderTodo } from "./page.js";
import { noteClosed, noteOpen, registerWindow, resizable, restorePlace, windowBar } from "./window.js";
import { ownLayout } from "./arrange.js";
import { timeField } from "./timefield.js";
import { saidUpdated, syncState, typingIn } from "../sync.js";
import { openHanuaSettings } from "../settings/window.js";

export { settings } from "../settings/store.js";
let lists = null;
const win = $("settings-win");
const ready = resizable(win);

// After any save or a change from the other Mac: fixed sections renamed → today's section of the old name takes the
// new one; then today has every fixed one. This window redraws unless Mel is in one of its fields.
document.addEventListener("hanua:settings-saved", (e) => {
  const { before, here } = e.detail || {};
  if (here && before && JSON.stringify(before.fixedSections) !== JSON.stringify(settings.fixedSections)) {
    renameSections(desk, renames(before.fixedSections, settings.fixedSections));
    setFixed(settings.fixedSections);
    withFixed(desk, settings.fixedSections);
    save();
  } else setFixed(settings.fixedSections);
  renderTodo();
  if (typingIn(win)) { win.addEventListener("focusout", () => setTimeout(render, 50), { once: true }); return; }
  render();
  clearTimeout(saving);
  const note = win.querySelector(".set-saved");
  if (note && !win.hidden) { note.textContent = "Saved"; saving = setTimeout(() => { note.textContent = ""; }, 1600); }
});
let saving = 0;
const base = () => defaults;

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
  const time = (k, label) => timeField(settings.day[k], { label, blank: false, lean: k === "start" ? "am" : "pm", onSet: (t) => change((n) => { n.day[k] = t; }) }); // typed (8 Oct 2026)
  const words = TIME_PICKS.map((m) => {
    const w = h("input", { type: "text", className: "set-in set-word", value: settings.timeWords[m], ariaLabel: `Word for ${minsText(m)}`, maxLength: 16 });
    w.addEventListener("change", () => change((n) => { n.timeWords[m] = w.value.trim(); }));
    return h("label", { className: "set-wordrow" }, h("span", { textContent: minsText(m) }), w);
  });
  return group("Planner", () => put({ ...settings, fixedSections: base().fixedSections, day: base().day, timeWords: base().timeWords }, { undoText: "Planner settings back to Hanua's" }),
    h("p", { className: "set-sub", textContent: "Sections every day has, after General" }), h("ul", { className: "set-list" }, fixedRows), add,
    row("Your usual day", time("start", "Usual start"), h("span", { textContent: "–" }), time("end", "Usual end")),
    h("p", { className: "set-note", textContent: "A new day starts with these hours; today's are on the page." }),
    h("p", { className: "set-sub", textContent: "Words for the time picks" }), h("div", { className: "set-words" }, words));
}
function timerGroup() {
  const num = (k, label, lo, hi) => { const n = h("input", { type: "number", className: "set-in set-num", min: lo, max: hi, value: settings.timer[k], ariaLabel: label }); n.addEventListener("change", () => change((x) => { x.timer[k] = Number(n.value); })); return n; };
  return group("Focus timer", () => put({ ...settings, timer: base().timer }, { undoText: "Timer back to 25 / 5" }),
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
  return group("Lists", () => put({ ...settings, lists: base().lists }, { undoText: "Lists back to Hanua's" }),
    row("Shopping list", pick("shopping", "Shopping list", "Shopping (made if missing)")),
    row("Add reminder puts them in", pick("reminders", "Reminders list", lists.defaultList ? `${lists.defaultList} (your default)` : "Your default list")),
    !lists.live ? h("p", { className: "set-note", textContent: lists.reason === "denied" || lists.reason === "ask" ? "Hanua can't see Reminders yet: allow it when macOS asks (or System Settings → Privacy & Security → Reminders → Hanua Calendar)." : "Reminders is off on this server: sample lists." }) : null);
}
async function loadLists() {
  try { lists = await (await fetch("/api/reminders/lists")).json(); } catch { lists = { live: false, lists: [] }; }
  render();
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
// the other window: Hanua Settings (on the rail) holds everything that isn't the desk's (8 Oct 2026)
function otherWindow() {
  const b = h("button", { type: "button", className: "set-reset", textContent: "Hanua Settings →" });
  b.addEventListener("click", () => { hide(); openHanuaSettings($("dock-settings")); });
  return h("p", { className: "set-note set-other" }, "Sleep screen, lights, clocks, calendars, weather and appearance are in ", b);
}
// where the days, menus, stickies and Settings live: this Mac only, or the iCloud folder both Macs share
function sharedLine() {
  const s = syncState;
  if (!s?.shared) return `Your days, menus and stickies are kept on this Mac only.${s?.setup ? ` ${s.setup}.` : ""}`;
  if (s.warning) return s.warning;
  const ago = s.lastRemote ? Math.round((Date.now() - new Date(s.lastRemote)) / 60_000) : null;
  return `Shared with your other Mac (iCloud Drive › ${s.folder}).${ago === null ? "" : ` Last change from it: ${ago < 1 ? "just now" : `${ago} min ago`}.`}`;
}
document.addEventListener("hanua:sync", () => { if (!win.hidden && !typingIn(win)) render(); }); // never mid-typing

function render() {
  if (win.hidden || !settings) return;
  const scroll = win.querySelector(".txt-body")?.scrollTop || 0;
  const bar = windowBar(win, "Desk Settings", [h("span", { className: "set-saved", ariaLive: "polite" })], () => { hide(); $("dock-settings").focus({ preventScroll: true }); });
  const body = h("div", { className: "txt-body set-body" }, plannerGroup(), timerGroup(), focus.on ? null : listsGroup(), deskGroup(), otherWindow());
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
const ICON = '<svg viewBox="0 0 24 24" width="30" aria-hidden="true" fill="none" stroke="#5c564c" stroke-width="1.6"><path d="M9.59 5.00 L9.84 2.65 L14.16 2.65 L14.41 5.00 L15.24 5.35 L17.09 3.86 L20.14 6.91 L18.65 8.76 L19.00 9.59 L21.35 9.84 L21.35 14.16 L19.00 14.41 L18.65 15.24 L20.14 17.09 L17.09 20.14 L15.24 18.65 L14.41 19.00 L14.16 21.35 L9.84 21.35 L9.59 19.00 L8.76 18.65 L6.91 20.14 L3.86 17.09 L5.35 15.24 L5.00 14.41 L2.65 14.16 L2.65 9.84 L5.00 9.59 L5.35 8.76 L3.86 6.91 L6.91 3.86 L8.76 5.35Z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/></svg>';
registerWindow("settings-win", { title: "Desk Settings", icon: ICON, show, hide, shown: () => !win.hidden });
export function openSettings() { if (!settings) return; show(); noteOpen("settings-win"); }

$("dock-settings").addEventListener("click", openSettings);
