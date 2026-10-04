// ---------- the desk: a notebook to plan the day, and the agenda on an iPad lying beside it ----------
// The desk is its own pane, one slide down from the wall (or the kitchen), and one slide back up (Mel, 5 Oct 2026),
// except on phones, where the stacked room is taller than the screen and the page just scrolls.
// The notebook has four sections on drawn lines (the text sits in the middle of each line by construction):
// Focus (3), Key tasks (3), General and Work. Focus, Key tasks and General jottings live in a small file per day on
// this Mac; Work is the Work book in Notion, and a Work line typed here goes there after five quiet minutes.
// Rules: public/shared/desk.js (tested).
import { carriedOver, deskSections, deskShape, lastFocus, stepDay, workReady, WORK_WAIT_MS } from "./shared/desk.js";
import { isGoalDone } from "./shared/goals.js";
import { dayOf, parseDay, timeOf, todayStr } from "./shared/dates.js";
import { $, api, area, focus, focusGoals, h, isDone, isWorkGoal, longDate, records, reducedMotion, state, toast } from "./lib.js";
import { goalById, moveGoal } from "./goals/board.js";
import { openGoal } from "./goals/form.js";
import { openQuick } from "./goals/quick.js";
import { bookEl, calendarItems, openBook, ROLE, sortByTime, toggleTask } from "./app.js";

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
  document.querySelector(".room").classList.toggle("on-desk", on);
  $("wall").inert = on;
  $("desk-pane").inert = !on;
  $("ts-desk").classList.toggle("on", on);
  window.scrollTo(0, 0);
  // keyboard focus follows the slide (only when it was in the pane that just went away)
  if (document.activeElement?.closest?.(on ? "#wall" : "#desk-pane")) (on ? $("desk-up") : $("ts-desk")).focus({ preventScroll: true });
  // the canary leaves perches that just went away, once the slide has finished
  clearTimeout(deskTimer);
  deskTimer = setTimeout(() => window.dispatchEvent(new Event("resize")), reducedMotion ? 0 : 620);
  document.dispatchEvent(new CustomEvent("hanua:desk", { detail: on }));
}
function fitPanes() {
  // crossing the phone width: back to one scrolling page, or back to panes (starting on the wall)
  if (stacked()) { document.querySelector(".room").classList.remove("on-desk"); $("wall").inert = false; $("desk-pane").inert = false; $("ts-desk").classList.remove("on"); onDesk = false; }
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

// ---- the notebook ----
let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
let saveTimer = 0;
const newId = () => Math.random().toString(36).slice(2, 10);
const data = (el, set) => { for (const [k, v] of Object.entries(set)) el.dataset[k] = v; return el; };

export async function loadDesk() {
  deskDay = todayStr();
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (res.ok) { const j = await res.json(); desk = deskShape(j.day); earlier = j.earlier || {}; }
  } catch { /* the server's away: an empty page */ }
  loaded = true;
  renderTodo();
  sendReadyWork();
  try { prompts = (await (await fetch("/api/desk/prompts")).json()).prompts || {}; renderTodo(); } catch { /* headings alone */ }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/desk/${deskDay}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(desk) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
    }
    catch (err) { toast(`Today's notes couldn't be saved: ${err.message}`, true); }
  }, 500);
}

// ---- Work lines: kept here for five quiet minutes, then added to the Work book ----
let sending = false;
async function sendReadyWork() {
  if (sending || !loaded) return;
  const ready = workReady(desk.work);
  if (!ready.length) return;
  sending = true;
  for (const w of ready) {
    try {
      const { record, live } = await api(`/api/areas/${ROLE.tasks}/records`, { title: w.text, due: deskDay });
      desk.work = desk.work.filter((x) => x.id !== w.id);
      area(ROLE.tasks)?.records.unshift(record);
      save();
      toast(live ? `Added to your Work book: ${w.text}` : `${w.text}: added (sample data, so Notion isn't changed)`, false,
        { label: "Undo", run: () => undoWork(record) });
    } catch (err) { toast(`Couldn't add “${w.text}” to your Work book: ${err.message}`, true); break; }
  }
  sending = false;
  renderTodo();
}
async function undoWork(record) {
  const book = area(ROLE.tasks);
  if (book) book.records = book.records.filter((r) => r.id !== record.id);
  renderTodo();
  try { await api(`/api/areas/${ROLE.tasks}/records/${record.id}/delete`, {}); toast("Taken out of your Work book (it's in Notion's trash)"); }
  catch (err) { toast(err.message, true); }
}
setInterval(() => { sendReadyWork(); refreshWaits(); }, 20_000);
function waitText(w) {
  if (!w.text) return "";
  const mins = Math.ceil((WORK_WAIT_MS - (Date.now() - w.edited)) / 60_000);
  return mins > 0 ? `to Notion in ${mins} min` : "to Notion now";
}
function refreshWaits() {
  for (const el of document.querySelectorAll("#todo [data-wait]")) {
    const w = desk.work.find((x) => x.id === el.dataset.wait);
    if (w) el.textContent = waitText(w);
  }
}

// ---- building the page ----
const check = (done, label) => h("button", { type: "button", className: `check${done ? " on" : ""}`, ariaLabel: label, ariaPressed: String(done), innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' });
const secEl = (name, ...kids) => data(h("section", { className: "pl-sec" }, ...kids), { section: name });
function heading(name, key) {
  const prompt = prompts[key] || "";
  return h("div", { className: "pl-head" }, h("h3", { textContent: name }), prompt ? h("span", { className: "pl-prompt", textContent: prompt, title: prompt }) : null);
}
// a line you type on; Enter makes the next line, Backspace on an empty line takes it away
function lineInput(value, { placeholder = "", label, onInput, onEnter, onEmptyBack, list }) {
  const input = h("input", { type: "text", className: "pl-input", value, placeholder, ariaLabel: label, autocomplete: "off", spellcheck: true, maxLength: 200 });
  if (list) input.setAttribute("list", list);
  input.addEventListener("input", () => onInput(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); onEnter?.(); }
    if (e.key === "Backspace" && !input.value && onEmptyBack) { e.preventDefault(); onEmptyBack(); }
  });
  return input;
}
function focusLine(section, index) {
  document.querySelectorAll(`#todo [data-section="${section}"] .pl-input`)[index]?.focus({ preventScroll: true });
}

// one of today's tasks from Notion (the Work book, or a goal Task): tick it here as on the board
function taskRow(item, today) {
  const { r, g, title, done } = item;
  const late = item.date && dayOf(item.date) < today && !done;
  const tick = check(done, `Mark ${title} ${done ? "not done" : "done"}`);
  const li = h("li", { className: `pl-line task${done ? " done" : ""}${g ? " goal-task" : ""}` });
  if (g) {
    const parent = goalById(g.parent);
    const name = h("button", { type: "button", className: "t", textContent: title, title: `${title}: change state or due date` });
    name.dataset.act = "quick";
    name.addEventListener("click", () => openQuick(g, name));
    li.append(tick, name, h("span", { className: `m g${late ? " late" : ""}`, title: parent ? `For “${parent.title}”` : "A goal Task",
      textContent: late ? `Overdue · ${fmtShort(item.date)}` : parent ? parent.title : "Goal" }));
    tick.addEventListener("click", () => { li.classList.toggle("done", !done); moveGoal(g, done ? "Active" : "Done"); });
  } else {
    const name = h("button", { type: "button", className: "t", textContent: title, title: "Open in your Work book" });
    name.addEventListener("click", () => openBook(ROLE.tasks, bookEl(ROLE.tasks), r.id));
    li.append(tick, name, h("span", { className: `m${late ? " late" : ""}`, textContent: late ? `Overdue · ${fmtShort(r.date)}` : r.status || "To do" }));
    tick.addEventListener("click", () => toggleTask(r, li));
  }
  return li;
}
const fmtShort = (d) => parseDay(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function renderTodo() {
  const today = todayStr();
  if (deskDay !== today && loaded) { loadDesk(); return; } // a new day: a fresh page (yesterday's offered again)
  const all = state.goals?.goals || [];
  const byId = new Map(all.map((g) => [g.id, g]));
  // today's tasks from Notion: open Work book rows due by today (or undated), goal Tasks due by today, and any finished today
  const work = records(ROLE.tasks)
    .filter((r) => (!isDone(r) && (!r.date || dayOf(r.date) <= today)) || (isDone(r) && dayOf(r.date) === today))
    .map((r) => ({ r, title: r.title, date: r.date, done: isDone(r) }));
  const goalTasks = focusGoals(all)
    .filter((g) => g.level === "Task" && (isGoalDone(g) ? dayOf(g.completed) === today : g.due && dayOf(g.due) <= today))
    .map((g) => ({ g, title: g.title, date: g.due, done: isGoalDone(g), work: isWorkGoal(g, byId) }));
  const order = (a, b) => Number(a.done) - Number(b.done) || (a.date || "9").localeCompare(b.date || "9");
  const workTasks = [...work, ...goalTasks.filter((t) => t.work)].sort(order);
  const generalTasks = goalTasks.filter((t) => !t.work).sort(order);
  const shows = deskSections(focus.on);
  const sections = [];

  if (shows.includes("focus")) {
    const hint = lastFocus(earlier, today) || [];
    sections.push(secEl("focus", heading("Focus", "focus"),
      h("ol", { className: "pl-list" }, desk.focus.map((text, i) => h("li", { className: "pl-line" },
        h("span", { className: "pl-num", textContent: `${i + 1}` }),
        lineInput(text, { label: `Focus area ${i + 1}`, placeholder: hint[i] || "", onInput: (v) => { desk.focus[i] = v; save(); }, onEnter: () => focusLine("focus", i + 1) }))))));
  }
  if (shows.includes("key")) {
    sections.push(secEl("key", heading("Key tasks", "key tasks"),
      h("ol", { className: "pl-list" }, desk.key.map((k, i) => {
        const tick = check(k.done, `Mark key task ${i + 1} ${k.done ? "not done" : "done"}`);
        const li = h("li", { className: `pl-line${k.done ? " done" : ""}` }, tick,
          lineInput(k.text, { label: `Key task ${i + 1}`, list: "pl-suggest", onInput: (v) => { desk.key[i].text = v; save(); }, onEnter: () => focusLine("key", i + 1) }));
        tick.addEventListener("click", () => { k.done = !k.done; li.classList.toggle("done", k.done); tick.classList.toggle("on", k.done); tick.ariaPressed = String(k.done); save(); });
        return li;
      })),
      // suggestions for key tasks: today's tasks already in Notion
      h("datalist", { id: "pl-suggest" }, [...workTasks, ...generalTasks].filter((t) => !t.done).map((t) => h("option", { value: t.title })))));
  }
  if (shows.includes("general")) {
    const carried = carriedOver({ ...earlier, [today]: desk }, today);
    const list = h("ul", { className: "pl-list" });
    for (const c of carried) {
      const bring = h("button", { type: "button", className: "pl-act", textContent: "today", title: "Bring it into today" });
      const drop = h("button", { type: "button", className: "pl-act", textContent: "let go", title: prompts.carried || "Put it down" });
      bring.addEventListener("click", () => { desk.settled[c.key] = "today"; desk.general.push({ id: newId(), text: c.text, done: false }); save(); renderTodo(); });
      drop.addEventListener("click", () => { desk.settled[c.key] = "gone"; save(); renderTodo(); });
      list.append(h("li", { className: "pl-line carried" }, h("span", { className: "pl-from", textContent: parseDay(c.day).toLocaleDateString(undefined, { weekday: "short" }) }),
        h("span", { className: "t", textContent: c.text }), h("span", { className: "pl-acts" }, bring, drop)));
    }
    for (const t of generalTasks) list.append(taskRow(t, today));
    typedLines(list, desk.general, "general", true);
    sections.push(secEl("general", heading("General", "general"), list));
  }
  if (shows.includes("work")) {
    const list = h("ul", { className: "pl-list" });
    for (const t of workTasks) list.append(taskRow(t, today));
    typedLines(list, desk.work, "work", false);
    sections.push(secEl("work", heading("Work", "work"), list));
  }
  if (focus.on) sections.push(h("p", { className: "pl-covered", textContent: "Focus, key tasks and General are put away at work." }));

  // keep the cursor where it was across a re-render
  const active = document.activeElement?.closest?.("#todo") ? { sec: document.activeElement.closest("[data-section]")?.dataset.section, i: [...document.querySelectorAll(`#todo [data-section="${document.activeElement.closest("[data-section]")?.dataset.section}"] .pl-input`)].indexOf(document.activeElement) } : null;
  const page = h("div", { className: "pl-page", ariaLabel: `Plan for ${longDate(parseDay(today), false)}` }, ...sections);
  const old = $("todo").querySelector(".pl-page");
  if (old) page.scrollTop = old.scrollTop;
  $("todo").replaceChildren(h("img", { src: "assets/obj/notepad.png", alt: "" }), page);
  if (old) page.scrollTop = old.scrollTop;
  if (active && active.i >= 0) focusLine(active.sec, active.i);
}

// typed lines (General jottings, or Work lines resting before they go to Notion), always with one empty line to write on
function typedLines(list, lines, section, tickable) {
  const rows = lines.filter((l) => l.text);
  rows.push({ id: newId(), text: "", done: false, edited: 0, blank: true });
  rows.forEach((l, i) => {
    const commit = (v) => {
      let line = lines.find((x) => x.id === l.id);
      if (!line && v) { line = { id: l.id, text: "", done: false }; lines.push(line); delete l.blank; }
      if (!line) return;
      line.text = v;
      if (section === "work") line.edited = Date.now();
      if (!v) lines.splice(lines.indexOf(line), 1);
      save();
      const wait = list.querySelector(`[data-wait="${l.id}"]`);
      if (wait) wait.textContent = section === "work" ? waitText(line) : "";
    };
    const input = lineInput(l.text, {
      label: `${section === "work" ? "Work" : "General"} line`, placeholder: l.blank ? (section === "work" ? "Add a work task…" : "Add something…") : "",
      onInput: commit,
      onEnter: () => { if (input.value) { renderTodo(); focusLine(section, i + 1); } },
      onEmptyBack: i > 0 ? () => { renderTodo(); focusLine(section, Math.max(0, i - 1)); } : null,
    });
    const li = h("li", { className: `pl-line typed${l.done ? " done" : ""}` });
    if (tickable) {
      const tick = check(l.done, "Mark done");
      tick.addEventListener("click", () => {
        const line = lines.find((x) => x.id === l.id);
        if (!line) return;
        line.done = !line.done; li.classList.toggle("done", line.done); tick.classList.toggle("on", line.done); tick.ariaPressed = String(line.done); save();
      });
      if (l.blank) tick.disabled = true;
      li.append(tick);
    } else li.append(h("span", { className: "pl-bullet", ariaHidden: "true", textContent: "–" }));
    li.append(input);
    if (section === "work") li.append(data(h("span", { className: "m pl-wait", textContent: l.blank ? "" : waitText(l) }), { wait: l.id }));
    list.append(li);
  });
}

// ---- the agenda on the iPad: swipe (or ‹ ›) through the days ----
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
    const open = x.busy ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: x.goal ? "Open the goal" : "Open in your book" }, ...inner);
    if (!x.busy) open.addEventListener("click", () => (x.goal ? openGoal(x.goal) : openBook(x.kind === "Due" ? ROLE.tasks : ROLE.events, bookEl(x.kind === "Due" ? ROLE.tasks : ROLE.events), x.id)));
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
    h("div", { className: "ip-status", ariaHidden: "true" }, h("span", { textContent: nowHM }), h("span", { textContent: "●●● ▮" })),
    h("header", { className: "ip-head" }, nav("‹", -1),
      h("div", { className: "ip-title" }, h("h2", { textContent: word }), h("span", { className: "ip-date", textContent: longDate(parseDay(key), false) })),
      nav("›", 1)),
    rel ? h("div", { className: "ip-back" }, back) : null,
    h("div", { className: "ip-body" }, items.length ? list : h("p", { className: "empty", textContent: key === today ? "No meetings today." : "Nothing on this day." })),
    h("div", { className: "ip-dots", ariaHidden: "true" }, [-2, -1, 0, 1, 2].map((n) => h("i", { className: n === 0 ? "on" : "" }))));
  $("agenda").replaceChildren(h("span", { className: "ip-camera", ariaHidden: "true" }), screen);
}
function movePad(step) {
  padDay = stepDay(padDay, step);
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
