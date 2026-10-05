// ---------- the desk, seen front-on: the bricks are a Mac desktop (a "Plan my day" file and a dock), the agenda pinned on the wall ----------
// The desk is its own pane, one slide down from the wall (or the kitchen), and one slide back up (Mel, 5 Oct 2026),
// except on phones, where the stacked room is taller than the screen and the page just scrolls.
// Plan my day opens over the whole page (Mel, 6 Oct 2026): the date (Tue 06-Oct-2026), Today's focuses (3 numbered
// lines) and a To-Do List of empty lines, on faint rows with the text in the middle of each. Kept in a small file per
// day on this Mac. Rules: public/shared/desk.js (tested).
import { deskSections, deskShape, lastFocus, planDate, stepDay, stickiesUp, stickyShape, MAX_LINES, STICKY_COLOURS, STICKY_MAX, STICKY_TEXT, TODO_ROWS } from "./shared/desk.js";
import { dayOf, parseDay, timeOf, todayStr } from "./shared/dates.js";
import { $, focus, h, longDate, reducedMotion, toast } from "./lib.js";
import { openGoal } from "./goals/form.js";
import { bookEl, calendarItems, ensureApple, openBook, openInCalendar, openTurntable, ROLE, sortByTime } from "./app.js";

// ---- the desk as a pane ----
export let onDesk = false;
const stacked = () => matchMedia("(max-width: 900px)").matches;
let deskTimer = 0;
export function showDesk(on) {
  if (stacked()) {
    if (on) $("desk-pane").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    return;
  }
  if (on === onDesk) return;
  onDesk = on;
  const room = document.querySelector(".room");
  // one push, like the kitchen: first put each pane exactly where it shows now (no transitions), scroll to the top in
  // the same frame so nothing moves, then let both slide a screen's height together
  room.style.setProperty(on ? "--wall-y" : "--desk-y", `${-window.scrollY}px`);
  room.classList.add("desk-start");
  room.classList.toggle("desk-leave", !on);
  room.classList.toggle("on-desk", on);
  window.scrollTo(0, 0);
  void room.offsetHeight; // the start positions are laid out, so removing the class now slides from them
  room.classList.remove("desk-start");
  $("wall").inert = on;
  $("desk-pane").inert = !on;
  // keyboard focus follows the slide (only when it was in the pane that just went away)
  if (document.activeElement?.closest?.(on ? "#wall" : "#desk-pane")) (on ? $("desk-up") : $("to-desk")).focus({ preventScroll: true });
  // the canary leaves perches that just went away, once the slide has finished
  clearTimeout(deskTimer);
  deskTimer = setTimeout(() => {
    if (!onDesk) room.classList.remove("desk-leave"); // slid away: now it can hide (styles.css)
    window.dispatchEvent(new Event("resize"));
  }, reducedMotion ? 0 : 620);
  document.dispatchEvent(new CustomEvent("hanua:desk", { detail: on }));
}
function fitPanes() {
  // crossing the phone width: back to one scrolling page, or back to panes (starting on the wall)
  if (stacked()) { document.querySelector(".room").classList.remove("on-desk"); $("wall").inert = false; $("desk-pane").inert = false; onDesk = false; }
  else if (!onDesk) $("desk-pane").inert = true;
}
fitPanes();
addEventListener("resize", fitPanes);
// the goals board and the kitchen live up on the wall: going to either leaves the desk
document.addEventListener("hanua:board", (e) => { if (e.detail !== false) showDesk(false); });
document.addEventListener("hanua:kitchen", (e) => { if (e.detail) showDesk(false); });
$("to-desk").addEventListener("click", () => showDesk(true));
$("kitchen-to-desk").addEventListener("click", () => showDesk(true));
$("desk-up").addEventListener("click", () => showDesk(false));
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && onDesk && !document.querySelector("dialog[open]") && !e.target.closest?.("input, textarea")) showDesk(false);
});
// A flick down at the bottom of the wall slides to the desk; a flick up at the top of the desk slides back
let flick = 0, flickTimer = 0;
addEventListener("wheel", (e) => {
  if (stacked() || Math.abs(e.deltaX) > Math.abs(e.deltaY) || document.querySelector("dialog[open]")) { flick = 0; return; }
  const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  const inPage = e.target.closest?.(".pl-page");
  const down = !onDesk && e.deltaY > 0 && atBottom;
  const up = onDesk && e.deltaY < 0 && scrollY <= 0 && !(inPage && inPage.scrollTop > 0);
  if (!down && !up) { flick = 0; return; }
  flick += e.deltaY;
  clearTimeout(flickTimer);
  flickTimer = setTimeout(() => { flick = 0; }, 160);
  if (Math.abs(flick) > 240) { flick = 0; e.preventDefault(); showDesk(down); }
}, { passive: false });

// ---- the page: Today's focuses and a To-Do List ----
let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
let saveTimer = 0;
const newId = () => Math.random().toString(36).slice(2, 10);

export async function loadDesk() {
  deskDay = todayStr();
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (res.ok) { const j = await res.json(); desk = deskShape(j.day); earlier = j.earlier || {}; }
  } catch { /* the server's away: an empty page */ }
  loaded = true;
  renderTodo();
  try { prompts = (await (await fetch("/api/desk/prompts")).json()).prompts || {}; renderTodo(); } catch { /* headings alone */ }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/desk/${deskDay}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(desk) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
    }
    catch (err) { toast(`Today's page couldn't be saved: ${err.message}`, true); }
  }, 500);
}

const check = (done, label) => h("button", { type: "button", className: `check${done ? " on" : ""}`, ariaLabel: label, ariaPressed: String(done), innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' });
const secEl = (name, ...kids) => { const el = h("section", { className: `pl-sec pl-${name}` }, ...kids); el.dataset.section = name; return el; };
function heading(name, key) {
  const prompt = prompts[key] || "";
  return h("div", { className: "pl-head" }, h("h3", { textContent: name }), prompt ? h("span", { className: "pl-prompt", textContent: prompt, title: prompt }) : null);
}
// a line you type on; Enter goes to the next line, arrows move between lines
function lineInput(value, { placeholder = "", label, onInput, section, index }) {
  const input = h("input", { type: "text", className: "pl-input", value, placeholder, ariaLabel: label, autocomplete: "off", spellcheck: true, maxLength: 200 });
  input.addEventListener("input", () => onInput(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusLine(section, index + 1); }
    if (e.key === "ArrowUp") { e.preventDefault(); focusLine(section, index - 1); }
  });
  return input;
}
function focusLine(section, index) {
  document.querySelectorAll(`#todo [data-section="${section}"] .pl-input`)[index]?.focus({ preventScroll: true });
}

export function renderTodo() {
  const today = todayStr();
  if (deskDay !== today && loaded) { loadDesk(); return; } // a new day: a fresh page
  const shows = deskSections(focus.on);
  const sections = [];

  if (shows.includes("focus")) {
    const hint = lastFocus(earlier, today) || [];
    sections.push(secEl("focus", heading("Today's focuses", "focus"),
      h("ol", { className: "pl-list" }, desk.focus.map((text, i) => h("li", { className: "pl-line" },
        h("span", { className: "pl-num", textContent: `${i + 1}.` }),
        lineInput(text, { label: `Focus ${i + 1}`, placeholder: hint[i] || "", section: "focus", index: i, onInput: (v) => { desk.focus[i] = v; save(); } }))))));
  }
  if (shows.includes("todo")) {
    // empty lines to write on, kept in place: a line typed halfway down stays halfway down
    const rows = Math.min(MAX_LINES, Math.max(TODO_ROWS, desk.general.length + 1));
    const list = h("ul", { className: "pl-list" });
    for (let i = 0; i < rows; i++) {
      const l = desk.general[i];
      const tick = check(Boolean(l?.done), "Mark done");
      const li = h("li", { className: `pl-line${l?.done ? " done" : ""}${l?.text ? "" : " empty"}` });
      const input = lineInput(l?.text || "", { label: `To-do line ${i + 1}`, section: "todo", index: i, onInput: (v) => {
        while (desk.general.length <= i) desk.general.push({ id: newId(), text: "", done: false });
        desk.general[i].text = v;
        if (!v) desk.general[i].done = false;
        while (desk.general.length && !desk.general.at(-1).text) desk.general.pop(); // no trailing blanks kept
        li.classList.toggle("empty", !v);
        if (!v) li.classList.remove("done");
        save();
      } });
      tick.addEventListener("click", () => {
        const line = desk.general[i];
        if (!line?.text) return;
        line.done = !line.done; li.classList.toggle("done", line.done); tick.classList.toggle("on", line.done); tick.ariaPressed = String(line.done); save();
      });
      li.append(tick, input);
      list.append(li);
    }
    sections.push(secEl("todo", heading("To-Do List", "to-do"), list));
  }

  // keep the cursor where it was across a re-render
  const at = document.activeElement?.closest?.("#todo [data-section]");
  const active = at ? { sec: at.dataset.section, i: [...at.querySelectorAll(".pl-input")].indexOf(document.activeElement) } : null;
  const old = $("todo").querySelector(".pl-page");
  const page = h("div", { className: "pl-page", ariaLabel: `Plan for ${planDate(today)}` },
    h("p", { className: "pl-date", textContent: planDate(today) }),
    shows.length ? h("div", { className: "pl-cols" }, ...sections)
      : h("p", { className: "pl-covered", textContent: "Today's page is put away at work." }));
  // a window over the whole page with a title bar; its red button closes it, like a Mac window
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Close Plan my day", title: "Close (Esc)" });
  close.addEventListener("click", () => $("plan-day").close());
  const bar = h("div", { className: "pw-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
    h("span", { className: "pw-title", textContent: "Plan my day.txt" }));
  $("todo").replaceChildren(bar, page);
  if (old) page.scrollTop = old.scrollTop;
  if (active && active.i >= 0) focusLine(active.sec, active.i);
}

// ---- the agenda on a ruled sheet pinned to the wall: swipe (or ‹ ›) through the days ----
let padDay = todayStr();
export function renderAgenda() {
  const today = todayStr();
  const key = padDay;
  const rel = Math.round((parseDay(key) - parseDay(today)) / 86_400_000);
  // today's tasks are in the notebook, so today shows events only; other days show what's due too
  const items = sortByTime(calendarItems().filter((x) => dayOf(x.date) === key && (key !== today || (x.kind !== "Due" && !x.goal))));
  const now = new Date(), nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const list = h("ol", { className: "ip-list" });
  let nowPlaced = key !== today;
  for (const x of items) {
    const t = timeOf(x.date);
    if (!nowPlaced && t && t > nowHM) { list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` }))); nowPlaced = true; }
    const inner = [h("span", { className: "t", textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }), h("span", { className: "k", textContent: x.goal ? x.kind : x.busy ? "" : x.kind })];
    const open = x.busy ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.goal ? "Open the goal" : x.apple ? "Open in Calendar" : "Open in your book" }, ...inner);
    if (!x.busy) open.addEventListener("click", () => (x.goal ? openGoal(x.goal) : x.apple ? openInCalendar(x) : openBook(x.kind === "Due" ? ROLE.tasks : ROLE.events, bookEl(x.kind === "Due" ? ROLE.tasks : ROLE.events), x.id)));
    list.append(h("li", { className: `slot${key === today && t && t < nowHM ? " past" : ""}`, style: `--dot:${x.color}` },
      h("time", { textContent: t || (x.kind === "Due" || x.goal ? "Due" : "All day") }), open,
      x.url ? h("a", { className: "slot-out", href: x.url, target: "_blank", rel: "noopener", title: "Open in Notion", ariaLabel: `Open ${x.title} in Notion`, textContent: "↗" }) : null));
  }
  if (items.length && !nowPlaced) list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` })));
  const nav = (label, step) => { const b = h("button", { type: "button", className: "ip-nav", textContent: label, ariaLabel: step < 0 ? "Previous day" : "Next day" }); b.addEventListener("click", () => movePad(step)); return b; };
  const back = h("button", { type: "button", className: "ip-today", textContent: "Today" });
  back.addEventListener("click", () => { padDay = todayStr(); renderAgenda(); });
  const word = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : parseDay(key).toLocaleDateString(undefined, { weekday: "long" });
  const screen = h("div", { className: "ip-screen" },
    h("header", { className: "ip-head" }, nav("‹", -1),
      h("div", { className: "ip-title" }, h("h2", { textContent: word }), h("span", { className: "ip-date", textContent: longDate(parseDay(key), false) })),
      nav("›", 1)),
    rel ? h("div", { className: "ip-back" }, back) : null,
    h("div", { className: "ip-body" }, items.length ? list : h("p", { className: "empty", textContent: key === today ? "No meetings today." : "Nothing on this day." })),
    h("div", { className: "ip-dots", ariaHidden: "true" }, [-2, -1, 0, 1, 2].map((n) => h("i", { className: n === 0 ? "on" : "" }))));
  $("agenda").replaceChildren(h("span", { className: "ag-pin", ariaHidden: "true" }), screen);
}
function movePad(step) {
  padDay = stepDay(padDay, step);
  ensureApple(padDay);
  const screen = $("agenda").querySelector(".ip-screen");
  renderAgenda();
  if (!reducedMotion && screen) $("agenda").querySelector(".ip-screen").animate([{ transform: `translateX(${step * 24}px)`, opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "ease-out" });
}
// swipe: two fingers sideways on the trackpad, a finger on a touch screen, or the arrow keys when it has focus
let padX = 0, padTimer = 0, padLock = 0;
$("agenda").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault(); e.stopPropagation();
  if (Date.now() < padLock) return;
  padX += e.deltaX;
  clearTimeout(padTimer);
  padTimer = setTimeout(() => { padX = 0; }, 220);
  if (Math.abs(padX) < 60) return;
  movePad(padX > 0 ? 1 : -1);
  padX = 0; padLock = Date.now() + 450;
}, { passive: false });
let padTouch = null;
$("agenda").addEventListener("touchstart", (e) => { padTouch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("agenda").addEventListener("touchend", (e) => {
  if (!padTouch) return;
  const dx = e.changedTouches[0].clientX - padTouch.x, dy = e.changedTouches[0].clientY - padTouch.y;
  padTouch = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) movePad(dx < 0 ? 1 : -1);
});
$("agenda").addEventListener("keydown", (e) => {
  if (e.target.closest("button, a") && e.target.closest(".ip-list")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); movePad(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); movePad(1); }
});

// ---- the desktop on the bricks: double-click "Plan my day" to open it over the whole page (Enter or a tap work too) ----
const file = $("open-plan");
let lastPointer = "mouse";
file.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; });
file.addEventListener("click", (e) => {
  if (e.detail === 0 || lastPointer === "touch") return openPlan(); // keyboard or touch: one press opens it
  file.classList.add("sel");
});
file.addEventListener("dblclick", openPlan);
document.addEventListener("pointerdown", (e) => { if (!file.contains(e.target)) file.classList.remove("sel"); });
export function openPlan() {
  file.classList.remove("sel");
  if (!$("plan-day").open) $("plan-day").showModal();
}
$("plan-day").addEventListener("close", () => file.focus({ preventScroll: true }));
// the dock: the record player brings up the turntable (more to come)
$("dock-records").addEventListener("click", openTurntable);

// ---- sticky notes on the wall: typed here, kept on this Mac until taken down (× in the corner, with Undo) ----
let stickies = [];
let stickySave = 0;
export async function loadStickies() {
  try { stickies = stickyShape(await (await fetch("/api/stickies")).json()); } catch { stickies = []; }
  renderStickies();
}
function saveStickies() {
  clearTimeout(stickySave);
  stickySave = setTimeout(() => fetch("/api/stickies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stickies) })
    .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); })
    .catch((err) => toast(`Sticky notes couldn't be saved: ${err.message}`, true)), 400);
}
export function renderStickies(focusId) {
  const wall = $("stickies");
  const up = stickiesUp(stickies);
  wall.hidden = focus.on; // personal: put away at work
  wall.replaceChildren(...up.map((n, i) => {
    const text = h("textarea", { className: "st-text", value: n.text, ariaLabel: "Sticky note", maxLength: STICKY_TEXT, placeholder: "Write something…", spellcheck: true });
    text.addEventListener("input", () => { const s = stickies.find((x) => x.id === n.id); if (s) { s.text = text.value; saveStickies(); } });
    const x = h("button", { type: "button", className: "st-x", ariaLabel: "Take this note down", title: "Take it down", textContent: "×" });
    x.addEventListener("click", () => takeDown(n.id));
    const note = h("div", { className: `desk-sticky st-${n.colour}`, style: `--tilt:${[-2.5, 1.8, -1, 2.6, -1.8, 1.2][i % 6]}deg` }, x, text);
    if (n.id === focusId) requestAnimationFrame(() => text.focus());
    return note;
  }));
  $("add-sticky").disabled = up.length >= STICKY_MAX;
  $("add-sticky").title = up.length >= STICKY_MAX ? "The wall's full: take one down first" : "Add a sticky note to the wall";
}
function takeDown(id) {
  const n = stickies.find((x) => x.id === id);
  if (!n) return;
  n.down = todayStr();
  saveStickies(); renderStickies();
  toast("Note taken down", false, { label: "Undo", run: () => { n.down = null; saveStickies(); renderStickies(); } });
}
$("add-sticky").addEventListener("click", () => {
  if (stickiesUp(stickies).length >= STICKY_MAX) return;
  const id = newId();
  stickies.push({ id, text: "", colour: STICKY_COLOURS[stickies.length % STICKY_COLOURS.length], added: todayStr(), down: null });
  saveStickies(); renderStickies(id);
});
