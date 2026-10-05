// ---------- the desk, seen front-on: the whole screen is a Mac desktop (a "Plan my day" file, widgets, a dock along the bottom) ----------
// The desk is its own pane, one slide down from the wall (or the kitchen), and one slide back up (Mel, 5 Oct 2026),
// except on phones, where the stacked room is taller than the screen and the page just scrolls.
// Plan my day opens over the whole page (Mel, 6 Oct 2026): the date (Tue 06-Oct-2026), Today's focuses (3 numbered
// lines) and a To-Do List of empty lines, on faint rows with the text in the middle of each. Kept in a small file per
// day on this Mac. Rules: public/shared/desk.js (tested).
import { bringForward, versionClash, CLASH_TEXT, DESK_VERSION, deskSections, deskShape, fromMin, lastFocus, leftovers, openItems, planDay, planDate, shorterCol, startDay, stepDay, stickiesUp, stickyShape, toMin, DEFAULT_MINS, GENERAL, MAX_LINES, MAX_MEETINGS, MAX_NAME, MAX_SECTIONS, SECTION_ROWS, STICKY_COLOURS, STICKY_MAX, STICKY_TEXT, TIME_PICKS } from "./shared/desk.js";
import { showBoard } from "./goals/board.js";
import { dayOf, parseDay, timeOf, todayStr, ymd } from "./shared/dates.js";
import { $, focus, h, longDate, reducedMotion, toast } from "./lib.js";
import { openGoal } from "./goals/form.js";
import { bookEl, renderNotes, calendarItems, ensureApple, openBook, openInCalendar, openTurntable, ROLE, sortByTime } from "./app.js";

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

// ---- the page: focuses and tasks at the top, the To-Do List in sections, a morning sweep and an archive ----
let deskDay = todayStr(), desk = deskShape({}), earlier = {}, prompts = {}, loaded = false;
let saveTimer = 0, sweepLater = false;
export let backup = null; // the nightly backup's status (/api/backup): a line in the Archive, a note on the desk if it fails
let stale = null; // "page" or "server" when the two save a day differently: saving stops and the page says so
let archive = null; // null = today's page; { days: [...], day, page } while looking back
const newId = () => Math.random().toString(36).slice(2, 10);

export async function loadDesk() {
  deskDay = todayStr();
  sweepLater = false;
  try {
    const res = await fetch(`/api/desk/${deskDay}`);
    if (res.ok) {
      const j = await res.json();
      stale = versionClash(j.v); // an old server answers without one
      earlier = j.earlier || {};
      desk = startDay(j.day, earlier, deskDay); // a new day: yesterday's section headers, empty
      if (!j.day?.started) save();
    }
  } catch { /* the server's away: an empty page */ }
  loaded = true;
  renderTodo();
  renderAgenda(); // the day's plan shows in Up next
  try { prompts = (await (await fetch("/api/desk/prompts")).json()).prompts || {}; renderTodo(); } catch { /* headings alone */ }
  loadBackup();
}
setInterval(() => loadBackup(), 3600_000); // a failure that happens while Hanua sits open still reaches the desk
export async function loadBackup() {
  try { backup = await (await fetch("/api/backup")).json(); } catch { backup = null; }
  renderNotes();
  if (archive) renderTodo();
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (stale) { toast(CLASH_TEXT[stale], true); return; }
    try {
      const res = await fetch(`/api/desk/${deskDay}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...desk, v: DESK_VERSION }) });
      if (res.status === 409) { stale = (await res.json().catch(() => ({}))).stale || "server"; renderTodo(); toast(CLASH_TEXT[stale], true); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
    }
    catch (err) { toast(`Today's page couldn't be saved: ${err.message}`, true); }
  }, 500);
}

const check = (done, label) => h("button", { type: "button", className: `check${done ? " on" : ""}`, ariaLabel: label, ariaPressed: String(done), innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' });
const tagged = (el, section) => { el.dataset.section = section; return el; };
function heading(name, key) {
  const prompt = prompts[key] || "";
  return h("div", { className: "pl-head" }, h("h3", { textContent: name }), prompt ? h("span", { className: "pl-prompt", textContent: prompt, title: prompt }) : null);
}
// a line you type on; Enter or ↓ goes to the next line, ↑ back. A long line wraps onto the next ruled line
// rather than being cut off (Mel, 6 Oct 2026), so it's a one-line textarea that grows a whole line at a time.
function lineInput(value, { placeholder = "", label, onInput, section, index }) {
  const input = h("textarea", { className: "pl-input", value, placeholder, ariaLabel: label, autocomplete: "off", spellcheck: true, maxLength: 200, rows: 1 });
  input.addEventListener("input", () => {
    if (/\n/.test(input.value)) input.value = input.value.replace(/\s*\n\s*/g, " "); // a pasted list stays one line
    fitLine(input);
    onInput(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const wrapped = input.offsetHeight > lineH(input) * 1.5;
    const atEnd = input.selectionStart === input.value.length, atStart = input.selectionEnd === 0;
    if (e.key === "Enter" || (e.key === "ArrowDown" && (!wrapped || atEnd))) { e.preventDefault(); focusLine(section, index + 1); }
    if (e.key === "ArrowUp" && (!wrapped || atStart)) { e.preventDefault(); focusLine(section, index - 1); }
  });
  return input;
}
const lineH = (el) => parseFloat(getComputedStyle(el).lineHeight) || 36;
// as tall as its text, in whole ruled lines, so the rules stay under the writing
function fitLine(el) {
  if (!el.isConnected || !el.offsetWidth) return;
  const line = lineH(el);
  el.style.height = `${line}px`;
  el.style.height = `${Math.max(1, Math.round(el.scrollHeight / line)) * line}px`;
}
// the window opening, or its width changing, re-wraps every line
const refit = new ResizeObserver(() => document.querySelectorAll("#todo .pl-input").forEach(fitLine));
refit.observe($("todo"));
function focusLine(section, index) {
  const el = document.querySelectorAll(`#todo [data-section="${section}"] .pl-input`)[index];
  if (!el) return;
  el.focus({ preventScroll: true });
  el.setSelectionRange(el.value.length, el.value.length);
}
const dayWord = (day) => parseDay(day).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });

// quick picks on a written line: priority and a rough time (blank = Medium, 30 min); not precise, just structure
const PRI_LABEL = { "": "Priority", h: "High", m: "Med", l: "Low" };
const minsLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60) : ""}` : `${m}m`); // 15m … 1h30, 2h
function picks(get, set) {
  const pri = h("select", { className: `pl-pri p-${get().pri || "none"}`, ariaLabel: "Priority", title: "Priority" },
    ["", "h", "m", "l"].map((v) => h("option", { value: v, textContent: PRI_LABEL[v], selected: get().pri === v })));
  const time = h("select", { className: `pl-mins${get().mins ? "" : " unset"}`, ariaLabel: "Roughly how long", title: "Roughly how long (blank counts as 30 min)" },
    h("option", { value: "0", textContent: "Time" }), TIME_PICKS.map((m) => h("option", { value: String(m), textContent: minsLabel(m), selected: get().mins === m })));
  pri.addEventListener("change", () => { set({ pri: pri.value }); pri.className = `pl-pri p-${pri.value || "none"}`; });
  time.addEventListener("change", () => { set({ mins: Number(time.value) }); time.classList.toggle("unset", !Number(time.value)); });
  return h("span", { className: "pl-picks" }, pri, time);
}
const workChip = (on, label, toggle) => {
  const b = h("button", { type: "button", className: `pl-work${on ? " on" : ""}`, ariaPressed: String(on), title: on ? "Work: shows at work" : "Mark as work, so it shows at work", ariaLabel: `${label}: work`,
    innerHTML: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="5" width="12" height="8" rx="1.5"/><path d="M6 5V3.5h4V5"/></svg><span>Work</span>' });
  b.addEventListener("click", () => { const v = toggle(); b.classList.toggle("on", v); b.ariaPressed = String(v); });
  return b;
};

// a tickable line kept in its place: typing on it makes it real, a tick only once something's written
function tickLine(line, { label, section, index, onText, onTick, ensure }) {
  const li = h("li", { className: `pl-line${line?.done ? " done" : ""}${line?.text ? "" : " empty"}` });
  const tick = check(Boolean(line?.done), `Mark ${label} done`);
  tick.addEventListener("click", () => {
    const done = onTick();
    if (done === null) return;
    li.classList.toggle("done", done); tick.classList.toggle("on", done); tick.ariaPressed = String(done);
  });
  const input = lineInput(line?.text || "", { label, section, index, onInput: (v) => {
    onText(v);
    li.classList.toggle("empty", !v);
    if (!v) { li.classList.remove("done"); tick.classList.remove("on"); }
  } });
  li.append(tick, input);
  if (ensure) li.append(picks(() => line || { pri: "", mins: 0 }, (v) => { line = ensure(); Object.assign(line, v); save(); }));
  return li;
}

function focusesEl() {
  const hint = lastFocus(earlier, deskDay) || [];
  return tagged(h("section", { className: "pl-sec pl-focus" }, heading("Today's focuses", "focus"),
    h("ol", { className: "pl-list" }, desk.focus.map((text, i) => h("li", { className: "pl-line" },
      h("span", { className: "pl-num", textContent: `${i + 1}.` }),
      lineInput(text, { label: `Focus ${i + 1}`, placeholder: hint[i] || "", section: "focus", index: i, onInput: (v) => { desk.focus[i] = v; save(); renderPlanWidget(); } }))))), "focus");
}
function tasksEl() {
  const head = heading("Tasks to complete", "key tasks");
  head.append(workChip(desk.keyWork, "Tasks to complete", () => { desk.keyWork = !desk.keyWork; save(); return desk.keyWork; }));
  return tagged(h("section", { className: "pl-sec pl-key" }, head,
    h("ol", { className: "pl-list" }, desk.key.map((k, i) => tickLine(k, { label: `Task ${i + 1}`, section: "key", index: i, ensure: () => k,
      onText: (v) => { k.text = v; if (!v) k.done = false; save(); renderPlanWidget(); },
      onTick: () => { if (!k.text) return null; k.done = !k.done; save(); renderPlanWidget(); return k.done; } })))), "key");
}
function sectionEl(sec) {
  const key = `s:${sec.id}`;
  const rows = Math.min(MAX_LINES, Math.max(SECTION_ROWS, sec.lines.length + 1));
  const list = h("ul", { className: "pl-list" });
  for (let i = 0; i < rows; i++) {
    const ensure = () => { while (sec.lines.length <= i) sec.lines.push({ id: newId(), text: "", done: false, pri: "", mins: 0 }); return sec.lines[i]; };
    list.append(tickLine(sec.lines[i], { label: `${sec.name || "section"} line ${i + 1}`, section: key, index: i, ensure,
      onText: (v) => {
        ensure().text = v;
        if (!v) sec.lines[i].done = false;
        while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
        save();
        if (v && i === rows - 1 && rows < MAX_LINES) renderTodo(); // writing on the last line: one more appears
      },
      onTick: () => { const l = sec.lines[i]; if (!l?.text) return null; l.done = !l.done; save(); return l.done; } }));
  }
  let head;
  if (sec.id === GENERAL) head = heading("General", "general");
  else {
    const name = h("input", { type: "text", className: "pl-sec-name", value: sec.name, placeholder: "Name this section", ariaLabel: "Section name", maxLength: MAX_NAME, autocomplete: "off" });
    name.addEventListener("input", () => { sec.name = name.value; save(); });
    name.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); focusLine(key, 0); } });
    const used = sec.lines.some((l) => l.text);
    const x = h("button", { type: "button", className: "pl-sec-x", textContent: "×", ariaLabel: `Remove the ${sec.name || "unnamed"} section`,
      title: used ? "Clear its lines first to remove it" : "Remove this section", disabled: used });
    x.addEventListener("click", () => { desk.sections = desk.sections.filter((s) => s !== sec); save(); renderTodo(); });
    head = h("div", { className: "pl-head" }, name, x);
  }
  head.append(workChip(sec.work, sec.name || "section", () => { sec.work = !sec.work; save(); return sec.work; }));
  return tagged(h("section", { className: "pl-sec pl-todo-sec" }, head, list), key);
}

// the morning sweep: unfinished things from the last week, each done, brought into today, or let go
function sweepEl(items) {
  const settle = (item, how) => { if (how === "today") bringForward(desk, item, newId()); else desk.settled[item.key] = how; };
  const act = (label, title, run) => { const b = h("button", { type: "button", className: "sw-act", textContent: label, title }); b.addEventListener("click", () => { run(); save(); renderTodo(); renderPlanWidget(); }); return b; };
  return h("div", { className: "pl-sweep" },
    h("h3", { textContent: "Before you start" }),
    h("p", { className: "sw-lede", textContent: `${items.length} ${items.length === 1 ? "thing" : "things"} from earlier ${items.length === 1 ? "wasn't" : "weren't"} ticked off. Done already, bring into today, or let go?` }),
    h("ul", { className: "sw-list" }, items.map((it) => h("li", { className: "sw-item" },
      h("span", { className: "sw-from", textContent: `${dayWord(it.day)} · ${it.section || "Tasks"}` }),
      h("span", { className: "sw-text", textContent: it.text }),
      h("span", { className: "sw-acts" },
        act("✓ Done", "It got done: tick it off", () => settle(it, "done")),
        act("→ Today", "Bring it into today", () => settle(it, "today")),
        act("✕ Remove", "Let it go", () => settle(it, "gone")))))),
    h("div", { className: "sw-foot" },
      act("All to today", "Bring every one into today", () => items.forEach((it) => settle(it, "today"))),
      act("Let all go", "Let every one go", () => items.forEach((it) => settle(it, "gone"))),
      act("Later", "Plan first; these wait until next time", () => { sweepLater = true; })));
}

// the archive: earlier days, read-only
export async function openArchive() {
  archive = { days: [], day: null, page: null };
  loadBackup();
  renderTodo();
  try { archive.days = (await (await fetch("/api/desk/days")).json()).filter((d) => d < deskDay); } catch { archive.days = []; }
  if (archive.days[0]) await showArchiveDay(archive.days[0]); else renderTodo();
}
async function showArchiveDay(day) {
  try { archive.page = deskShape((await (await fetch(`/api/desk/${day}`)).json()).day); archive.day = day; } catch { archive.page = null; }
  renderTodo();
}
function archiveEl() {
  const pick = h("ul", { className: "ar-days" }, archive.days.map((d) => {
    const b = h("button", { type: "button", className: `ar-day${d === archive.day ? " on" : ""}`, textContent: planDate(d) });
    b.addEventListener("click", () => showArchiveDay(d));
    return h("li", {}, b);
  }));
  const p = archive.page;
  const read = (text, done) => h("li", { className: `ar-line${done ? " done" : ""}` }, h("span", { className: "ar-tick", textContent: done ? "✓" : "○" }), h("span", { textContent: text }));
  const page = !p ? h("p", { className: "pl-covered", textContent: archive.days.length ? "Choose a day." : "No earlier days yet: yesterday's page lands here tomorrow." })
    : h("div", { className: "ar-page" }, h("p", { className: "pl-date", textContent: planDate(archive.day) }),
      h("h4", { textContent: "Focuses" }), h("ol", { className: "ar-list" }, p.focus.filter(Boolean).map((f) => h("li", { textContent: f }))),
      h("h4", { textContent: "Tasks to complete" }), h("ul", { className: "ar-list" }, p.key.filter((k) => k.text).map((k) => read(k.text, k.done))),
      ...p.sections.filter((s) => s.lines.some((l) => l.text)).flatMap((s) => [h("h4", { textContent: s.name || "Untitled" }), h("ul", { className: "ar-list" }, s.lines.filter((l) => l.text).map((l) => read(l.text, l.done)))]));
  return h("div", { className: "pl-archive" }, h("div", {}, pick, backupLine()), page);
}

// under the archive's days: when the room's data was last copied to iCloud Drive
function backupLine() {
  if (!backup || backup.off) return null;
  const when = (iso) => { const d = new Date(iso);
    return `${ymd(d) === todayStr() ? "today" : d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}`; };
  const text = backup.good ? `Backed up ${when(backup.good)}` : "Not backed up yet";
  return h("p", { className: `ar-backup${backup.warning ? " bad" : ""}`, title: backup.where ? `Copied to ${backup.where}` : "", textContent: backup.warning ? `${text}. ${backup.warning}.` : text });
}

// meetings and events for the day: a time, roughly how long, what, and whether it's work. Planned round, never over.
function meetingsEl() {
  const rows = Math.min(MAX_MEETINGS, Math.max(3, desk.meetings.length + 1));
  const list = h("ul", { className: "pl-list pl-meets" });
  for (let i = 0; i < rows; i++) {
    const ensure = () => { while (desk.meetings.length <= i) desk.meetings.push({ id: newId(), time: "", mins: 0, title: "", work: focus.on }); return desk.meetings[i]; };
    const m = desk.meetings[i];
    if (focus.on && m && !m.work) continue; // at work, only work meetings
    // an empty time says "Time", not a grey made-up time (Safari draws "12:30 PM" in an empty box)
    const time = h("input", { type: "time", className: `pl-time${m?.time ? "" : " blank"}`, value: m?.time || "", ariaLabel: `Meeting ${i + 1} time`, step: 300 });
    time.addEventListener("change", () => { ensure().time = time.value; time.classList.toggle("blank", !time.value); save(); renderAgenda(); });
    const timeBox = h("span", { className: "pl-timebox" }, time);
    const len = h("select", { className: `pl-mins${m?.mins ? "" : " unset"}`, ariaLabel: "How long", title: "How long (blank counts as 30 min)" },
      h("option", { value: "0", textContent: "30m?" }), TIME_PICKS.map((v) => h("option", { value: String(v), textContent: minsLabel(v), selected: m?.mins === v })));
    len.addEventListener("change", () => { ensure().mins = Number(len.value); len.classList.toggle("unset", !Number(len.value)); save(); });
    const title = lineInput(m?.title || "", { label: `Meeting ${i + 1}`, placeholder: i === 0 && !m ? "e.g. Coffee with Sam" : "", section: "meet", index: i, onInput: (v) => {
      ensure().title = v; save(); renderAgenda();
      if (v && i === rows - 1 && rows < MAX_MEETINGS) renderTodo();
    } });
    list.append(h("li", { className: "pl-line pl-meet" }, timeBox, title, len, focus.on ? null : workChip(Boolean(m?.work), "Meeting", () => { const x = ensure(); x.work = !x.work; save(); return x.work; })));
  }
  return tagged(h("section", { className: "pl-sec pl-meetings" }, heading("Meetings & events", "meetings"), list), "meet");
}

// the working day and Save & plan
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function dayBar() {
  const field = (k, label) => { const t = h("input", { type: "time", className: "pl-time", value: desk.day[k], ariaLabel: label, step: 900 }); t.addEventListener("change", () => { if (t.value) { desk.day[k] = t.value; save(); } }); return t; };
  const go = h("button", { type: "button", className: "pl-go", textContent: desk.blocks.length ? "Re-plan from now" : "Save & plan", title: "Time-block the day round your meetings, then open To-do.txt" });
  go.addEventListener("click", savePlan);
  return h("div", { className: "pl-daybar" }, h("span", { className: "pl-daylabel", textContent: "My day" }), field("start", "Day starts"), h("span", { textContent: "–" }), field("end", "Day ends"), go);
}
// fixed things today: jotted meetings, and timed events already in the calendars
function fixedToday() {
  const today = todayStr();
  const cal = calendarItems().filter((x) => dayOf(x.date) === today && timeOf(x.date) && x.kind !== "Due" && !x.goal)
    .map((x) => ({ start: timeOf(x.date), end: x.end && dayOf(x.end) === today && timeOf(x.end) ? timeOf(x.end) : fromMin(Math.min(1439, toMin(timeOf(x.date)) + DEFAULT_MINS)) }));
  const meets = desk.meetings.filter((m) => m.time).map((m) => ({ start: m.time, end: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))) }));
  return [...cal, ...meets];
}
function savePlan() {
  const { blocks, overflow } = planDay({ tasks: openItems(desk, focus.on), fixed: fixedToday(), from: nowHHMM(), day: desk.day });
  desk.blocks = blocks; desk.overflow = overflow;
  save();
  $("plan-day").close();
  renderAgenda();
  openTxt();
  const n = blocks.filter((b) => b.kind === "task").length;
  toast(n ? `Planned ${n} block${n === 1 ? "" : "s"}${overflow.length ? ` · ${overflow.length} didn't fit today` : ""}. Tick things off in any order.` : "Nothing to plan yet: add some tasks first.");
}
// what a block or list entry points at: a Task (k0..k2) or a line in a section
function refInfo(ref) {
  const k = /^k(\d)$/.exec(ref);
  if (k) { const obj = desk.key[Number(k[1])]; return obj && { obj, work: desk.keyWork, where: "Tasks" }; }
  for (const s of desk.sections) { const obj = s.lines.find((l) => l.id === ref); if (obj) return { obj, work: s.work, where: s.name || "General" }; }
  return null;
}
// the plan as agenda entries for Up next (today only): blocks still to do, breaks, and the jotted meetings
export function planEntries(day) {
  if (day !== deskDay) return [];
  const busy = (work) => focus.on && !work;
  const out = [];
  for (const b of desk.blocks) {
    if (b.kind === "break") { out.push({ plan: "break", title: "Break", date: `${day}T${b.start}`, until: b.end }); continue; }
    const info = refInfo(b.ref);
    if (!info?.obj.text || info.obj.done) continue; // ticked off: out of the time-blocked agenda
    out.push({ plan: "task", title: busy(info.work) ? "Busy" : info.obj.text, busy: busy(info.work), date: `${day}T${b.start}`, until: b.end, pri: info.obj.pri });
  }
  for (const m of desk.meetings) if (m.time && m.title) out.push({ plan: "meet", title: busy(m.work) ? "Busy" : m.title, busy: busy(m.work), date: `${day}T${m.time}`, until: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))) });
  return out;
}

export function renderTodo() {
  const today = todayStr();
  if (deskDay !== today && loaded) { archive = null; loadDesk(); return; } // a new day: a fresh page
  renderPlanWidget();
  const shows = deskSections(focus.on);
  // keep the cursor where it was across a re-render
  const at = document.activeElement?.closest?.("#todo [data-section]");
  const active = at ? { sec: at.dataset.section, i: [...at.querySelectorAll(".pl-input")].indexOf(document.activeElement), name: document.activeElement.classList.contains("pl-sec-name") } : null;
  const old = $("todo").querySelector(".pl-page");

  let body;
  const items = shows.length && !archive ? leftovers({ ...earlier, [today]: desk }, today) : [];
  if (!shows.length) {
    // at work: only what's marked Work (meetings, Tasks if marked, Work sections); the rest is put away
    const work = desk.sections.filter((x) => x.work);
    body = [
      h("div", { className: "pl-datebar" }, h("p", { className: "pl-date", textContent: planDate(today) }), dayBar()),
      h("div", { className: "pl-cols pl-top" }, meetingsEl(), desk.keyWork ? tasksEl() : h("div")),
      work.length ? h("div", { className: "pl-cols" }, h("div", { className: "pl-col" }, work.filter((_, i) => i % 2 === 0).map(sectionEl)), h("div", { className: "pl-col" }, work.filter((_, i) => i % 2 === 1).map(sectionEl))) : null,
      h("p", { className: "pl-covered", textContent: work.length || desk.keyWork ? "Personal parts of the page are put away at work." : "Mark a section Work (at home) and it shows here. The rest is put away at work." }),
    ];
  }
  else if (archive) body = [archiveEl()];
  else if (items.length && !sweepLater) body = [h("p", { className: "pl-date", textContent: planDate(today) }), sweepEl(items)];
  else {
    const add = h("button", { type: "button", className: "pl-add", textContent: "+ Add a section", disabled: desk.sections.length >= MAX_SECTIONS });
    add.addEventListener("click", () => {
      const sec = { id: `s${newId()}`, name: "", col: shorterCol(desk.sections), lines: [] };
      desk.sections.push(sec); save(); renderTodo();
      $("todo").querySelector(`[data-section="s:${sec.id}"] .pl-sec-name`)?.focus();
    });
    const col = (n) => h("div", { className: "pl-col" }, desk.sections.filter((s) => s.col === n).map(sectionEl));
    body = [
      h("div", { className: "pl-datebar" }, h("p", { className: "pl-date", textContent: planDate(today) }), dayBar()),
      h("div", { className: "pl-cols pl-top" }, focusesEl(), tasksEl()),
      meetingsEl(),
      h("div", { className: "pl-todo-head" }, h("h2", { textContent: "To-Do List" }), add),
      h("div", { className: "pl-cols" }, col(0), col(1)),
      items.length ? (() => { const b = h("button", { type: "button", className: "pl-later", textContent: `${items.length} from earlier still waiting` }); b.addEventListener("click", () => { sweepLater = false; renderTodo(); }); return b; })() : null,
    ];
  }
  if (stale) body.unshift(h("p", { className: "pl-stale", role: "alert", textContent: CLASH_TEXT[stale] }));
  const page = h("div", { className: `pl-page${archive ? " is-archive" : ""}`, ariaLabel: `Plan for ${planDate(today)}` }, ...body);
  // a window with a title bar: the red button closes it, like a Mac window; Archive looks back
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Close Plan my day", title: "Close (Esc)" });
  close.addEventListener("click", () => $("plan-day").close());
  const swap = h("button", { type: "button", className: "pw-btn", textContent: archive ? "← Today" : "Archive", title: archive ? "Back to today's page" : "Earlier days' pages", hidden: focus.on });
  swap.addEventListener("click", () => { if (archive) { archive = null; renderTodo(); } else openArchive(); });
  const bar = h("div", { className: "pw-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
    h("span", { className: "pw-title", textContent: archive ? "Archive" : "Plan my day.txt" }), h("span", { className: "pw-tools" }, swap));
  $("todo").replaceChildren(bar, page);
  if (old && !archive) page.scrollTop = old.scrollTop;
  renderTxt();
  page.querySelectorAll(".pl-input").forEach(fitLine);
  if (active?.name) $("todo").querySelector(`[data-section="${active.sec}"] .pl-sec-name`)?.focus({ preventScroll: true });
  else if (active && active.i >= 0) focusLine(active.sec, active.i);
}
$("plan-day").addEventListener("close", () => { if (archive) { archive = null; renderTodo(); } });

// ---- widgets on the desktop: Up next (the agenda), the weather window (weather-window.js), Today's plan ----
export function renderPlanWidget() {
  const w = $("w-plan");
  if (!w) return;
  w.hidden = focus.on; // personal: put away at work
  const f = desk.focus.filter(Boolean);
  const tasks = desk.key.filter((k) => k.text), done = tasks.filter((k) => k.done).length;
  w.replaceChildren(h("span", { className: "wg-label", textContent: "Today's plan" }),
    f.length ? h("ol", { className: "wg-focus" }, f.map((x) => h("li", { textContent: x }))) : h("p", { className: "wg-empty", textContent: "No focuses yet. Open Plan my day." }),
    h("p", { className: "wg-meta", textContent: tasks.length ? `${done} of ${tasks.length} task${tasks.length === 1 ? "" : "s"} done` : "No tasks set" }));
}
$("w-plan").addEventListener("click", () => openPlan());

// ---- the agenda, as the Up next widget: swipe (or ‹ ›) through the days ----
let padDay = todayStr();
export function renderAgenda() {
  const today = todayStr();
  const key = padDay;
  const rel = Math.round((parseDay(key) - parseDay(today)) / 86_400_000);
  // today's tasks are in the notebook, so today shows events only; other days show what's due too
  const items = sortByTime([...calendarItems().filter((x) => dayOf(x.date) === key && (key !== today || (x.kind !== "Due" && !x.goal))), ...planEntries(key)]);
  const now = new Date(), nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const list = h("ol", { className: "ip-list" });
  let nowPlaced = key !== today;
  for (const x of items) {
    const t = timeOf(x.date);
    if (!nowPlaced && t && t > nowHM) { list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` }))); nowPlaced = true; }
    if (x.plan) { // the day's time-blocks and jotted meetings (desk only; the wall's calendar stays high level)
      const word = x.plan === "break" ? "Break" : x.plan === "meet" ? "Meeting" : x.pri === "h" ? "Block · High" : "Block";
      const inner = [h("span", { className: "t", textContent: x.title }), h("span", { className: "k", textContent: x.busy ? "" : `${word} · until ${x.until}` })];
      const open = x.busy || x.plan === "break" ? h("span", { className: "slot-open busy" }, ...inner) : h("button", { type: "button", className: "slot-open", title: "Open To-do.txt" }, ...inner);
      if (open.tagName === "BUTTON") open.addEventListener("click", openTxt);
      list.append(h("li", { className: `slot plan-${x.plan}${t < nowHM && x.until <= nowHM ? " past" : ""}` }, h("time", { textContent: t }), open));
      continue;
    }
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
    h("div", { className: "ip-body" }, items.length ? list : h("p", { className: "empty", textContent: key === today ? "No meetings today." : "Nothing on this day." })));
  $("agenda").replaceChildren(h("span", { className: "wg-label", textContent: "Up next" }), screen);
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

// ---- the desktop: double-click a file to open it (Enter or a tap work too), like a real desktop ----
let lastPointer = "mouse";
function desktopFile(el, open) {
  el.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; });
  el.addEventListener("click", (e) => {
    if (e.detail === 0 || lastPointer === "touch") { el.classList.remove("sel"); return open(); } // keyboard or touch: one press opens it
    document.querySelectorAll(".desk-file.sel").forEach((f) => f.classList.remove("sel"));
    el.classList.add("sel");
  });
  el.addEventListener("dblclick", () => { el.classList.remove("sel"); open(); });
}
document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".desk-file")) document.querySelectorAll(".desk-file.sel").forEach((f) => f.classList.remove("sel")); });
const file = $("open-plan");
desktopFile(file, () => openPlan());
desktopFile($("open-txt"), () => openTxt());
export function openPlan() {
  if (!$("plan-day").open) $("plan-day").showModal();
}
$("plan-day").addEventListener("close", () => { if (!$("todo-txt").contains(document.activeElement)) file.focus({ preventScroll: true }); });

// ---- To-do.txt: the day's list, in plan order, to tick off in any order (ticked → out of the time-blocked agenda) ----
const txt = $("todo-txt");
let txtPos = null;
try { txtPos = JSON.parse(localStorage.getItem("todo-txt-pos") || "null"); } catch { txtPos = null; }
export function openTxt() {
  txt.hidden = false;
  renderTxt();
  if (txtPos) { txt.style.left = `${txtPos.x}px`; txt.style.top = `${txtPos.y}px`; }
  txt.querySelector(".txt-body")?.focus({ preventScroll: true });
}
function toggleRef(ref) {
  const info = refInfo(ref);
  if (!info?.obj.text) return;
  info.obj.done = !info.obj.done;
  save(); renderTodo(); renderAgenda(); renderPlanWidget();
}
export function renderTxt() {
  if (txt.hidden) return;
  const all = openItems({ ...desk, key: desk.key.map((k) => ({ ...k, done: false })), sections: desk.sections.map((x) => ({ ...x, lines: x.lines.map((l) => ({ ...l, done: false })) })) }, focus.on);
  const byRef = new Map(all.map((x) => [x.ref, x]));
  const row = (ref, time) => {
    const info = refInfo(ref);
    if (!info?.obj.text) return null;
    const done = info.obj.done;
    const tick = check(done, `Mark ${info.obj.text} ${done ? "not done" : "done"}`);
    tick.addEventListener("click", () => toggleRef(ref));
    return h("li", { className: `txt-line${done ? " done" : ""}` }, tick, h("span", { className: "txt-time", textContent: time || "" }),
      h("i", { className: `txt-pri p-${info.obj.pri || "none"}`, title: PRI_LABEL[info.obj.pri || ""] }), h("span", { className: "txt-text", textContent: info.obj.text }));
  };
  const planned = desk.blocks.filter((b) => b.kind === "task" && byRef.has(b.ref));
  const plannedRefs = new Set(planned.map((b) => b.ref));
  const over = desk.overflow.filter((r) => byRef.has(r) && !plannedRefs.has(r));
  const rest = all.filter((x) => !plannedRefs.has(x.ref) && !over.includes(x.ref));
  const group = (title, rows) => (rows.filter(Boolean).length ? [title ? h("h4", { textContent: title }) : null, h("ul", { className: "txt-list" }, rows)] : []);
  const close = h("button", { type: "button", className: "pw-close", ariaLabel: "Close To-do.txt", title: "Close" });
  close.addEventListener("click", () => { txt.hidden = true; $("open-txt").focus({ preventScroll: true }); });
  const bar = h("div", { className: "pw-bar txt-bar" }, h("span", { className: "pw-dots" }, close, h("i", { ariaHidden: "true" }), h("i", { ariaHidden: "true" })),
    h("span", { className: "pw-title", textContent: "To-do.txt" }), h("span", { className: "pw-tools txt-date", textContent: planDate(deskDay) }));
  const body = h("div", { className: "txt-body", tabIndex: -1 },
    ...group(planned.length ? "The plan" : "", planned.map((b) => row(b.ref, b.start))),
    ...group("Didn't fit today", over.map((r) => row(r))),
    ...group(planned.length ? "Not planned yet" : "To do", rest.map((x) => row(x.ref))),
    !all.length ? h("p", { className: "txt-empty", textContent: focus.on ? "No Work tasks today." : "Nothing on the list yet: open Plan my day." } ) : null,
    all.length && !planned.length ? h("p", { className: "txt-empty", textContent: "Press Save & plan in Plan my day to time-block these." }) : null);
  txt.replaceChildren(bar, body);
  // drag it by the title bar, like a window
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const box = txt.getBoundingClientRect(), host = txt.offsetParent.getBoundingClientRect();
    const dx = e.clientX - box.left, dy = e.clientY - box.top;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(host.width - box.width, ev.clientX - host.left - dx)), y = Math.max(0, Math.min(host.height - 60, ev.clientY - host.top - dy));
      txt.style.left = `${x}px`; txt.style.top = `${y}px`; txtPos = { x: Math.round(x), y: Math.round(y) };
    };
    const up = () => { bar.removeEventListener("pointermove", move); try { localStorage.setItem("todo-txt-pos", JSON.stringify(txtPos)); } catch { /* fine */ } };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up, { once: true });
  });
}

// ---- the focus timer: 25 minutes on, 5 off (a soft chime at the end, mutable); the rail shows it while it runs ----
const FOCUS_MS = 25 * 60_000, BREAK_MS = 5 * 60_000;
let timer = { mode: "focus", left: FOCUS_MS, endsAt: 0, muted: false };
try { timer = { ...timer, ...JSON.parse(localStorage.getItem("focus-timer") || "{}") }; } catch { /* a fresh timer */ }
const keepTimer = () => { try { localStorage.setItem("focus-timer", JSON.stringify(timer)); } catch { /* fine */ } };
const fullOf = (mode) => (mode === "focus" ? FOCUS_MS : BREAK_MS);
const leftNow = () => (timer.endsAt ? Math.max(0, timer.endsAt - Date.now()) : timer.left);
const mmss = (ms) => { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
function chime() {
  if (timer.muted) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.22]].forEach(([f, at]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.9);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + 1);
    });
  } catch { /* no sound available */ }
}
function timerAct(what) {
  if (what === "go") { if (timer.endsAt) { timer.left = leftNow(); timer.endsAt = 0; } else timer.endsAt = Date.now() + timer.left; }
  if (what === "reset") { timer.endsAt = 0; timer.left = fullOf(timer.mode); }
  if (what === "switch") { timer.mode = timer.mode === "focus" ? "break" : "focus"; timer.endsAt = 0; timer.left = fullOf(timer.mode); }
  if (what === "mute") timer.muted = !timer.muted;
  keepTimer(); renderTimer();
}
function renderTimer() {
  const left = leftNow(), running = Boolean(timer.endsAt);
  if (running && left <= 0) { // finished: chime, and the other half is ready to start
    const was = timer.mode;
    timer.mode = was === "focus" ? "break" : "focus"; timer.endsAt = 0; timer.left = fullOf(timer.mode); keepTimer();
    chime();
    toast(was === "focus" ? "Focus done. Take five." : "Break's over. Ready when you are.", false, { label: was === "focus" ? "Start break" : "Start focus", run: () => timerAct("go") });
    return renderTimer();
  }
  const frac = left / fullOf(timer.mode), r = 34, c = 2 * Math.PI * r;
  const chip = $("ts-timer");
  chip.hidden = !running;
  chip.textContent = `${timer.mode === "focus" ? "●" : "☕"} ${mmss(left)}`;
  // each second only the numbers and the ring move (the buttons stay put, so keyboard focus isn't lost)
  const shape = `${timer.mode}|${running}|${timer.muted}|${left < fullOf(timer.mode)}`;
  if ($("w-timer").dataset.shape === shape) {
    $("w-timer").querySelector(".tm-left").textContent = mmss(left);
    $("w-timer").querySelector(".tm-ring").setAttribute("stroke-dashoffset", String(c * (1 - frac)));
    return;
  }
  $("w-timer").dataset.shape = shape;
  const btn = (label, what, cls = "") => { const b = h("button", { type: "button", className: `tm-btn ${cls}`, textContent: label }); b.addEventListener("click", () => timerAct(what)); return b; };
  const ring = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="tm-track"/><circle cx="40" cy="40" r="${r}" class="tm-ring" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 40 40)"/></svg>`;
  $("w-timer").className = `widget wg-timer tm-${timer.mode}${running ? " running" : ""}`;
  $("w-timer").replaceChildren(
    h("span", { className: "wg-label", textContent: timer.mode === "focus" ? "Focus timer" : "Break" }),
    h("div", { className: "tm-row" },
      h("div", { className: "tm-dial", innerHTML: ring }, h("b", { className: "tm-left", textContent: mmss(left), role: "timer", ariaLabel: `${mmss(left)} left` })),
      h("div", { className: "tm-btns" }, btn(running ? "Pause" : left < fullOf(timer.mode) ? "Resume" : "Start", "go", "tm-go"), btn("Reset", "reset"),
        btn(timer.mode === "focus" ? "Break" : "Focus", "switch"),
        (() => { const m = h("button", { type: "button", className: "tm-btn tm-mute", ariaPressed: String(timer.muted), title: timer.muted ? "Chime off" : "Chime on", textContent: timer.muted ? "🔕" : "🔔" }); m.addEventListener("click", () => timerAct("mute")); return m; })())));
  // the rail: the countdown follows you round the room while it runs
  chip.dataset.tip = timer.mode === "focus" ? "Focusing: open the desk" : "On a break: open the desk";
}
$("ts-timer").addEventListener("click", () => showDesk(true));
renderTimer();
setInterval(() => { if (timer.endsAt) renderTimer(); }, 1000);

// the dock, like a Mac's: Calendar opens the Calendar app on today, Notion the Hanua page, the record player the turntable
$("dock-records").addEventListener("click", openTurntable);
$("dock-goals").addEventListener("click", () => showBoard(true));
$("dock-calendar").addEventListener("click", () => openInCalendar({ date: todayStr() }));
function dockDate() { // the Calendar tile shows today, like the real one
  const d = parseDay(todayStr());
  $("dock-cal-day").textContent = d.toLocaleDateString("en-NZ", { weekday: "short" }).toUpperCase();
  $("dock-cal-date").textContent = String(d.getDate());
}
dockDate();
setInterval(dockDate, 60_000);
fetch("/api/desk/links").then((r) => r.json()).then(({ notion }) => { if (notion) $("dock-notion").href = notion; }).catch(() => { /* Notion's own home page is fine */ });

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
