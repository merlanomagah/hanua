// Hanua Settings (Mel, 8 Oct 2026; brief docs/plans/2026-10-settings-everywhere-and-two-mac-fix.md): the whole room's
// settings, from the gear on the top rail (or ⌃,) wherever Mel is: the wall, the kitchen, the goals board or the desk.
// The desk keeps its own Settings in the dock (Planner, Focus timer, Lists, Desk); each window points to the other.
// Groups: Sleep screen (Touch ID, the PIN: this Mac; sleep after: both Macs), Room (the lights' hours, the away
// clocks, the greeting's languages), Calendars (which show, which are Work, where new events go), Weather (the town),
// Appearance (this Mac) and This Mac (what it's connected to, whether it backs up). Every group says where its choices
// live. Not a modal dialog: the Undo in a toast stays clickable, and changes show behind it as they're made.
import { $, api, focus, h, toast } from "../lib.js";
import { change, defaults, put, settings } from "./store.js";
import { group, row, where } from "./common.js";
import { SLEEP_PICKS } from "../shared/settings.js";
import { GREETINGS } from "../shared/greetings.js";
import { inCalendars, writableCalendars } from "../shared/events.js";
import { APPEARANCES, DEFAULT_APPEARANCE } from "../shared/appearance.js";
import { appearance, setAppearance } from "../appearance.js";
import { forgetTouch, hasTouch, restoreTouch, setUpTouch, touchAvailable } from "../lock.js";
import { resizable, restorePlace, windowBar } from "../desk/window.js";
import { typingIn } from "../sync.js";

const win = $("hanua-settings");
const ready = resizable(win);
let opener = null, placed = false, saving = 0;
let touch = null, cals = null, mac = null, pin = null; // pin: which PIN form is open ("change" | "forget" | null)

// ---- Sleep screen ----
function sleepGroup() {
  if (touch === null) touchAvailable().then((ok) => { touch = ok; render(); });
  const touchRow = touch === null ? h("span", { className: "set-note", textContent: "Checking…" })
    : !touch ? h("span", { className: "set-note", textContent: "This Mac (or this browser) has no Touch ID: your PIN wakes Hanua." })
      : hasTouch() ? h("span", { className: "set-inline" }, h("span", { className: "set-on", textContent: "On" }), button("Turn off", () => {
        const id = forgetTouch(); render();
        toast("Touch ID is off: your PIN wakes Hanua", false, { label: "Undo", run: () => { restoreTouch(id); render(); } });
      }))
        : button("Set up Touch ID", async () => { if (await setUpTouch()) render(); });
  const after = h("select", { className: "set-in", ariaLabel: "Sleep after" }, SLEEP_PICKS.map((m) => h("option", { value: m, textContent: `${m} minutes`, selected: settings.sleep.after === m })));
  after.addEventListener("change", () => change((n) => { n.sleep.after = Number(after.value); }));
  return group("Sleep screen", settings.sleep.after === defaults.sleep.after ? null : () => put({ ...settings, sleep: defaults.sleep }, { undoText: "Sleeps after 15 minutes again" }),
    h("div", { className: "set-row" }, h("span", { className: "set-label", textContent: "Touch ID" }), touchRow, where(false)),
    h("div", { className: "set-row" }, h("span", { className: "set-label", textContent: "PIN" }),
      pin ? null : button("Change PIN…", () => { pin = "change"; render(); win.querySelector(".set-pin input")?.focus(); }),
      pin ? null : button("Forget PIN…", () => { pin = "forget"; render(); win.querySelector(".set-pin input")?.focus(); }), where(false)),
    pin ? pinForm() : null,
    row("Sleeps after", after, where(true)),
    h("p", { className: "set-note", textContent: "Without a touch, a key or a scroll." }),
    h("p", { className: "set-note", textContent: "A curtain against glances: lock the Mac itself when you step away. Forgot your PIN? Double-click “Reset Hanua PIN” in the Hanua folder." }));
}
const digits = (label) => h("input", { type: "password", className: "set-in set-pin-in", inputMode: "numeric", autocomplete: "off", maxLength: 4, pattern: "\\d{4}", ariaLabel: label, placeholder: "••••" });
function pinForm() {
  const now = digits("Current PIN"), next = pin === "change" ? digits("New PIN") : null, again = pin === "change" ? digits("New PIN again") : null;
  const msg = h("p", { className: "set-note", ariaLive: "polite" });
  const form = h("form", { className: "set-pin" },
    h("label", { className: "set-row" }, h("span", { className: "set-label", textContent: "Current PIN" }), now),
    next ? h("label", { className: "set-row" }, h("span", { className: "set-label", textContent: "New PIN" }), next) : null,
    again ? h("label", { className: "set-row" }, h("span", { className: "set-label", textContent: "Once more" }), again) : null,
    pin === "forget" ? h("p", { className: "set-note", textContent: "Hanua will ask you to choose a new PIN the next time it sleeps." }) : null,
    h("div", { className: "set-row" }, h("span", { className: "set-label" }),
      h("button", { type: "submit", className: "set-reset set-go", textContent: pin === "change" ? "Change PIN" : "Forget PIN" }),
      button("Cancel", () => { pin = null; render(true); })),
    msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(now.value) || (next && !/^\d{4}$/.test(next.value))) { msg.textContent = "PINs are 4 digits."; return; }
    if (next && next.value !== again.value) { msg.textContent = "The new PINs don't match."; again.value = ""; again.focus(); return; }
    try {
      const r = await api(pin === "change" ? "/api/lock/change" : "/api/lock/forget", pin === "change" ? { current: now.value, pin: next.value } : { current: now.value });
      if (!r.ok) { now.value = ""; now.focus(); msg.textContent = r.wait ? `Too many tries. Try again in ${r.wait} seconds.` : "That isn't your current PIN."; return; }
      toast(pin === "change" ? "PIN changed (on this Mac)" : "PIN forgotten: choose a new one when Hanua next sleeps");
      pin = null; render(true);
    } catch (err) { msg.textContent = err.message; }
  });
  return form;
}

// ---- Room ----
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const hourText = (n) => `${n % 12 || 12} ${n < 12 ? "am" : "pm"}`;
let ZONES = [];
try { ZONES = Intl.supportedValuesOf("timeZone"); } catch { /* an older browser: the three as they are */ }
function roomGroup() {
  const r = settings.room;
  const hourPick = (k, label) => {
    const s = h("select", { className: "set-in set-hour", ariaLabel: label }, HOURS.map((n) => h("option", { value: n, textContent: hourText(n), selected: r[k] === n })));
    s.addEventListener("change", () => change((x) => { x.room[k] = Number(s.value); }));
    return s;
  };
  const clocks = r.clocks.map((c, i) => {
    const city = h("input", { type: "text", className: "set-in set-city", value: c.city, ariaLabel: `Clock ${i + 1}: city`, maxLength: 24 });
    city.addEventListener("change", () => { if (city.value.trim()) change((x) => { x.room.clocks[i].city = city.value.trim(); }); else city.value = c.city; });
    const zones = ZONES.includes(c.zone) ? ZONES : [c.zone, ...ZONES];
    const zone = h("select", { className: "set-in", ariaLabel: `Clock ${i + 1}: time zone` }, zones.map((z) => h("option", { value: z, textContent: z.replace(/_/g, " "), selected: z === c.zone })));
    zone.addEventListener("change", () => change((x) => { x.room.clocks[i] = { city: zone.value.split("/").pop().replace(/_/g, " "), zone: zone.value }; }));
    return h("div", { className: "set-clock" }, city, zone);
  });
  const langs = GREETINGS.map((g) => {
    const box = h("input", { type: "checkbox", checked: !r.greetOff.includes(g.lang) });
    box.addEventListener("change", () => change((x) => { x.room.greetOff = box.checked ? x.room.greetOff.filter((l) => l !== g.lang) : [...x.room.greetOff, g.lang]; }));
    return h("label", { className: "set-check set-lang" }, box, h("span", { lang: g.lang, textContent: g.name }));
  });
  return group("Room", JSON.stringify(r) === JSON.stringify(defaults.room) ? null : () => put({ ...settings, room: defaults.room }, { undoText: "Room back to Hanua's: lights 9 pm / 4 am, Sydney, Suva, Los Angeles" }),
    where(true),
    row("Lights off", hourPick("lightsOff", "Lights off at"), h("span", { textContent: "on" }), hourPick("lightsOn", "Lights on at")),
    h("p", { className: "set-note", textContent: "They switch by themselves once at each time; a pull of the cord still wins. “Good night” follows the same hours." }),
    h("p", { className: "set-sub", textContent: "Clocks for elsewhere" }), h("div", { className: "set-clocks" }, clocks),
    h("p", { className: "set-sub", textContent: "Greeting languages" }), h("div", { className: "set-langs" }, langs));
}

// ---- Calendars ----
function calendarsGroup() {
  if (!cals) { loadCals(); return group("Calendars", null, h("p", { className: "set-note", textContent: "Asking Calendar for your calendars…" })); }
  const c = settings.calendars;
  const all = cals.calendars.map((x) => x.title);
  const shownNow = c.shown.length ? c.shown : cals.shown?.length ? cals.shown : all;
  const workNow = c.work.length ? c.work : cals.work || [];
  const tick = (list, title, k) => {
    const box = h("input", { type: "checkbox", checked: inCalendars(title, list), ariaLabel: `${k === "shown" ? "Show" : "Work"}: ${title}` });
    box.addEventListener("change", () => change((x) => {
      const now = all.filter((t) => (t === title ? box.checked : inCalendars(t, list)));
      x.calendars[k] = now.length || k === "work" ? now : [];
    }));
    return box;
  };
  const rows = cals.calendars.map((x) => h("tr", {},
    h("td", {}, h("span", { className: "set-dot", style: `background:${x.color || "#999"}` }), x.title),
    h("td", {}, tick(shownNow, x.title, "shown")), h("td", {}, tick(workNow, x.title, "work"))));
  const own = writableCalendars(cals.calendars);
  const pick = h("select", { className: "set-in", ariaLabel: "New events go in" },
    h("option", { value: "", textContent: cals.default ? `${cals.default} (your Mac's default)` : "Your Mac's default" }),
    own.map((x) => h("option", { value: x.title, textContent: x.title, selected: settings.calendar?.default === x.title })));
  pick.addEventListener("change", () => change((x) => { x.calendar = { default: pick.value }; }));
  const isDefault = !c.shown.length && !c.work.length && !settings.calendar?.default;
  return group("Calendars", isDefault ? null : () => put({ ...settings, calendars: defaults.calendars, calendar: defaults.calendar }, { undoText: "Calendars back to Hanua's" }),
    where(true),
    !cals.live && cals.reason !== "off" ? h("p", { className: "set-note", textContent: "Hanua can't see Calendar yet: System Settings → Privacy & Security → Calendars → Hanua Calendar → Full Access." }) : null,
    rows.length ? h("table", { className: "set-cals" }, h("thead", {}, h("tr", {}, h("th", { textContent: "Calendar" }), h("th", { textContent: "Show" }), h("th", { textContent: "Work" }))), h("tbody", {}, rows)) : null,
    h("p", { className: "set-note", textContent: "At work, only Work calendars show (the rest as Busy)." }),
    row("New events go in", pick));
}
async function loadCals() {
  try { cals = await (await fetch("/api/calendar/calendars")).json(); } catch { cals = { live: false, calendars: [] }; }
  render();
}

// ---- Weather ----
function weatherGroup() {
  const town = h("input", { type: "text", className: "set-in", value: settings.weather.place, placeholder: "Your town, e.g. Auckland", ariaLabel: "Weather town", maxLength: 80 });
  town.addEventListener("change", () => change((x) => { x.weather.place = town.value.trim(); }));
  return group("Weather", settings.weather.place ? () => put({ ...settings, weather: defaults.weather }, { undoText: "Weather back to the town in .env" }) : null,
    where(true), row("Town", town),
    h("p", { className: "set-note", textContent: "For the kitchen window and the desk's weather. Looked up on Open-Meteo (no account)." }));
}

// ---- Appearance (this Mac's choice, kept in browser storage like the lights) ----
function appearanceGroup() {
  const pick = h("select", { className: "set-in", ariaLabel: "Appearance" }, Object.entries(APPEARANCES).map(([v, label]) => h("option", { value: v, textContent: label, selected: appearance === v })));
  const set = (v, undoText) => {
    const before = appearance;
    setAppearance(v); render();
    if (undoText) toast(undoText, false, { label: "Undo", run: () => { setAppearance(before); render(); } });
  };
  pick.addEventListener("change", () => set(pick.value));
  return group("Appearance", appearance === DEFAULT_APPEARANCE ? null : () => set(DEFAULT_APPEARANCE, "Appearance back to following your Mac"),
    where(false), row("Dark windows", pick),
    h("p", { className: "set-note", textContent: "The desk's windows, widgets and dock go dark; the room's real things keep their colours and dim with the lights. ⌃D switches it from the rail." }));
}

// ---- This Mac ----
function macGroup() {
  if (!mac) { loadMac(); return group("This Mac", null, h("p", { className: "set-note", textContent: "Checking…" })); }
  const yes = (ok, on, off) => h("li", { className: ok ? "" : "bad", textContent: ok ? on : off });
  const back = h("input", { type: "checkbox", checked: mac.backup.on });
  back.addEventListener("change", async () => {
    try { await api("/api/this-mac", { backup: back.checked }); } catch (err) { toast(`Not changed: ${err.message}`, true); }
    loadMac();
  });
  const when = mac.backup.at ? new Date(mac.backup.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
  return group("This Mac", null, where(false),
    h("ul", { className: "set-status" },
      mac.sample ? h("li", { className: "bad", textContent: "A sample server: test data, never your real folder" }) : null,
      yes(mac.notion, "Notion: connected", "Notion: no key in .env on this Mac (copy the line from your other Mac's .env)"),
      yes(mac.claude, "Claude: connected", "Claude: no key in .env on this Mac"),
      yes(mac.room.shared, `Days, menus, stickies, Settings: shared through iCloud Drive › ${mac.room.folder}`, "Days, menus, stickies, Settings: on this Mac only")),
    versionLine(mac.version),
    h("label", { className: "set-check" }, back, h("span", { textContent: `Back up the room each night${when ? ` (last: ${when}${mac.backup.ok === false ? ", failed" : ""})` : ""}` })),
    h("p", { className: "set-note", textContent: "One Mac is enough: the one that's always on. Copies go to “Hanua backup” in your home folder, outside iCloud." }));
}
// which version this Mac runs, and how its last look at GitHub went (it updates itself every 5 minutes)
function versionLine(v) {
  if (!v?.self) return h("p", { className: "set-note", textContent: "This Hanua doesn't update itself (a test copy, or started by hand)." });
  const ago = v.pull?.at ? Math.max(0, Math.round((Date.now() - Date.parse(v.pull.at)) / 60_000)) : null;
  const when = ago === null ? "" : ago < 1 ? " (checked just now)" : ` (checked ${ago} min ago)`;
  const how = v.blocked ? `an update didn't take: ${v.blocked.why}` : { "up to date": "up to date with GitHub", updated: "just updated", offline: "can't reach GitHub right now", "not main": "on a working copy, not taking updates", "changed here": "has changes of its own, not taking updates", "its own commits": "has its own changes, not taking updates" }[v.pull?.how] || "checking for updates";
  return h("p", { className: `set-note${v.blocked || ["changed here", "its own commits"].includes(v.pull?.how) ? " bad" : ""}`, textContent: `Version ${v.commit || "?"}: ${how}${when}.` });
}
async function loadMac() {
  try { mac = await (await fetch("/api/this-mac")).json(); } catch { mac = null; }
  render();
}

function button(text, run) {
  const b = h("button", { type: "button", className: "set-reset", textContent: text });
  b.addEventListener("click", run);
  return b;
}
function otherWindow() {
  const b = button("Desk Settings →", () => { hide(); document.dispatchEvent(new CustomEvent("hanua:desk-settings")); });
  return h("p", { className: "set-note set-other" }, "Planner, focus timer, lists and the desk's layout are in ", b);
}

// force: redraw even with a field in focus (Mel just finished with it, e.g. the PIN form saved)
function render(force = false) {
  if (win.hidden || !settings) return;
  if (force !== true && typingIn(win)) { win.addEventListener("focusout", () => setTimeout(render, 50), { once: true }); return; }
  const scroll = win.querySelector(".txt-body")?.scrollTop || 0;
  const bar = windowBar(win, "Hanua Settings", [h("span", { className: "set-saved", ariaLive: "polite" })], close);
  const min = bar.querySelector(".pw-min");
  if (min) { min.disabled = true; min.ariaLabel = null; min.title = ""; } // nowhere to minimise to off the desk
  const body = h("div", { className: "txt-body set-body" }, sleepGroup(), roomGroup(), focus.on ? null : calendarsGroup(), weatherGroup(), appearanceGroup(), macGroup(), otherWindow());
  win.replaceChildren(bar, body);
  body.scrollTop = scroll;
}
document.addEventListener("hanua:settings-saved", () => {
  render();
  clearTimeout(saving);
  const note = win.querySelector(".set-saved");
  if (note && !win.hidden) { note.textContent = "Saved"; saving = setTimeout(() => { note.textContent = ""; }, 1600); }
});
document.addEventListener("hanua:focus", render); // at work the Calendars group is put away
addEventListener("hanua:appearance", render); // the rail's switch changed it

export function openHanuaSettings(from = document.activeElement) {
  if (!settings) return;
  opener = from;
  win.hidden = false;
  if (!placed) { restorePlace(win); placed = true; ready(); }
  touch = null; cals = null; mac = null; pin = null;
  render();
  win.querySelector(".pw-close")?.focus({ preventScroll: true });
}
function hide() { win.hidden = true; pin = null; }
function close() {
  hide();
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}
win.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });

$("ts-settings").addEventListener("click", (e) => (win.hidden ? openHanuaSettings(e.currentTarget) : close()));
// ⌃, (Safari keeps ⌘, for its own settings), like ⌃L, ⌃F, ⌃D and ⌃B
document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || e.metaKey || e.altKey || (e.key !== "," && e.code !== "Comma")) return;
  e.preventDefault();
  if (win.hidden) openHanuaSettings($("ts-settings")); else close();
});
