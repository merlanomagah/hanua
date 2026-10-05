// Plan my day: the page in its window (Mel, 6 Oct 2026): the date (Tue 06-Oct-2026), Today's focuses, three tasks,
// Meetings & events, the To-Do List in sections, the morning sweep, the archive, and Save & plan. Its widget,
// Today's plan, sits on the desktop. Rules: public/shared/desk.js (tested); the day itself: state.js.
import { carriedDays, CLASH_TEXT, deskSections, deskShape, fromMin, isFixed, keepPlan, lastFocus, leftovers, minsText, openItems, planDay, planDate, settle, shorterCol, stampLine, timeLabel, toMin, DEFAULT_MINS, GENERAL, MAX_LINES, MAX_MEETINGS, MAX_NAME, MAX_SECTIONS, MEETING_PICKS, SECTION_ROWS, TIME_PICKS, TIME_WORDS } from "../shared/desk.js";
import { dayOf, parseDay, timeOf, todayStr, ymd } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { calendarItems } from "../app.js";
import { backup, desk, deskDay, earlier, fixed, loaded, newId, prompts, save, stale } from "./state.js";
import { renderAgenda } from "./agenda.js";
import { openTxt, renderTxt } from "./todotxt.js";
import { dots, noteClosed, noteOpen, registerWindow } from "./window.js";
import { openDraft } from "./draft.js";
import { loadBackup, loadDesk } from "../planner.js";

let sweepLater = false;
let archive = null; // null = today's page; { days: [...], day, page } while looking back
export const resetSweep = () => { sweepLater = false; };
document.addEventListener("hanua:desk-stale", () => renderTodo());
document.addEventListener("hanua:backup", () => { if (archive) renderTodo(); });

export const check = (done, label) => h("button", { type: "button", className: `check${done ? " on" : ""}`, ariaLabel: label, ariaPressed: String(done), innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' });
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
export const PRI_LABEL = { "": "Priority", h: "High", m: "Med", l: "Low" };
// Time is a word with the minutes in brackets in the list ("Quick (10m)"); on the line just the word, so lines stay narrow
const timeWord = (m) => TIME_WORDS[m] || (m ? minsText(m) : "Time");
function picks(get, set) {
  const pri = h("select", { className: `pl-pri p-${get().pri || "none"}`, ariaLabel: "Priority", title: "Priority" },
    ["", "h", "m", "l"].map((v) => h("option", { value: v, textContent: PRI_LABEL[v], selected: get().pri === v })));
  const now = get().mins, picksFor = TIME_PICKS.includes(now) || !now ? TIME_PICKS : [...TIME_PICKS, now].sort((a, b) => a - b); // an older 1h30 stays
  const time = h("select", { className: "pl-mins-pick", ariaLabel: "Roughly how long", title: "Roughly how long (blank counts as Half hour)" },
    h("option", { value: "0", textContent: "Time" }), picksFor.map((m) => h("option", { value: String(m), textContent: timeLabel(m), selected: now === m })));
  const shown = h("span", { className: `pl-mins${now ? "" : " unset"}`, textContent: timeWord(now), ariaHidden: "true" }, time);
  pri.addEventListener("change", () => { set({ pri: pri.value }); pri.className = `pl-pri p-${pri.value || "none"}`; });
  time.addEventListener("change", () => { const m = Number(time.value); set({ mins: m }); shown.firstChild.textContent = timeWord(m); shown.classList.toggle("unset", !m); });
  return h("span", { className: "pl-picks" }, pri, shown);
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
function sectionEl(sec) {
  const key = `s:${sec.id}`;
  const rows = Math.min(MAX_LINES, Math.max(SECTION_ROWS, sec.lines.length + 1));
  const list = h("ul", { className: "pl-list" });
  for (let i = 0; i < rows; i++) {
    const ensure = () => { while (sec.lines.length <= i) sec.lines.push({ id: newId(), text: "", done: false, pri: "", mins: 0 }); return sec.lines[i]; };
    list.append(tickLine(sec.lines[i], { label: `${sec.name || "section"} line ${i + 1}`, section: key, index: i, ensure,
      onText: (v) => {
        const l = ensure();
        l.text = v;
        if (!v) l.done = false;
        stampLine(l); // when it was first written (cleared: forgotten)
        while (sec.lines.length && !sec.lines.at(-1).text) sec.lines.pop();
        save();
        if (v && i === rows - 1 && rows < MAX_LINES) renderTodo(); // writing on the last line: one more appears
      },
      onTick: () => { const l = sec.lines[i]; if (!l?.text) return null; l.done = !l.done; stampLine(l); save(); renderPlanWidget(); return l.done; } }));
  }
  let head;
  // General and the fixed sections (Spark NZ, Jump issues: config/areas.json) keep their name and can't be removed
  if (sec.id === GENERAL) head = heading("General", "general");
  else if (isFixed(sec, fixed)) head = heading(sec.name, sec.name.toLowerCase());
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
  const settleAs = (item, how) => settle(desk, item, how, newId());
  const today = todayStr();
  // where it's from, and how long it's been waiting (from the day it was first written; Mel: here only, not on the line)
  const fromText = (it) => { const n = carriedDays(it, today); return `${it.section} · ${dayWord(it.from || it.day)}${n > 1 ? ` · day ${n}` : ""}`; };
  const act = (label, title, run) => { const b = h("button", { type: "button", className: "sw-act", textContent: label, title }); b.addEventListener("click", () => { run(); save(); renderTodo(); renderPlanWidget(); }); return b; };
  return h("div", { className: "pl-sweep" },
    h("h3", { textContent: "Before you start" }),
    h("p", { className: "sw-lede", textContent: `${items.length} ${items.length === 1 ? "thing" : "things"} from earlier ${items.length === 1 ? "wasn't" : "weren't"} ticked off. Done already, bring into today, or let go?` }),
    h("ul", { className: "sw-list" }, items.map((it) => h("li", { className: "sw-item" },
      h("span", { className: "sw-from", textContent: fromText(it), title: fromText(it) }),
      h("span", { className: "sw-text", textContent: it.text }),
      h("span", { className: "sw-acts" },
        act("✓ Done", "It got done: tick it off", () => settleAs(it, "done")),
        act("→ Today", "Bring it into today", () => settleAs(it, "today")),
        act("✕ Remove", "Let it go", () => settleAs(it, "gone")))))),
    h("div", { className: "sw-foot" },
      act("All to today", "Bring every one into today", () => items.forEach((it) => settleAs(it, "today"))),
      act("Let all go", "Let every one go", () => items.forEach((it) => settleAs(it, "gone"))),
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
      h("option", { value: "0", textContent: "30m?" }), MEETING_PICKS.map((v) => h("option", { value: String(v), textContent: minsText(v), selected: m?.mins === v })));
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
export const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function dayBar() {
  const field = (k, label) => { const t = h("input", { type: "time", className: "pl-time", value: desk.day[k], ariaLabel: label, step: 900 }); t.addEventListener("change", () => { if (t.value) { desk.day[k] = t.value; save(); } }); return t; };
  const go = h("button", { type: "button", className: "pl-go", textContent: desk.locked ? "Re-plan from now" : "Save & plan", title: "See the day as it would run, arrange the order, then lock it in" });
  go.addEventListener("click", () => openDraft());
  return h("div", { className: "pl-daybar" }, h("span", { className: "pl-daylabel", textContent: "My day" }), field("start", "Day starts"), h("span", { textContent: "–" }), field("end", "Day ends"), go);
}
// fixed things today: jotted meetings, and timed events already in the calendars
export function fixedToday() {
  const today = todayStr();
  const cal = calendarItems().filter((x) => dayOf(x.date) === today && timeOf(x.date) && x.kind !== "Due" && !x.goal)
    .map((x) => ({ start: timeOf(x.date), end: x.end && dayOf(x.end) === today && timeOf(x.end) ? timeOf(x.end) : fromMin(Math.min(1439, toMin(timeOf(x.date)) + DEFAULT_MINS)), title: focus.on && x.busy ? "Busy" : x.title }));
  const meets = desk.meetings.filter((m) => m.time).map((m) => ({ start: m.time, end: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))), title: focus.on && !m.work ? "Busy" : m.title || "Meeting" }));
  return [...cal, ...meets];
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
      meetingsEl(),
      work.length ? h("div", { className: "pl-cols" }, h("div", { className: "pl-col" }, work.filter((_, i) => i % 2 === 0).map(sectionEl)), h("div", { className: "pl-col" }, work.filter((_, i) => i % 2 === 1).map(sectionEl))) : null,
      h("p", { className: "pl-covered", textContent: work.length ? "Personal parts of the page are put away at work." : "Mark a section Work (at home) and it shows here. The rest is put away at work." }),
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
      // the 3 Tasks were cut (6 Oct 2026): focuses and the day's meetings side by side, so the To-Do List comes up
      h("div", { className: "pl-cols pl-top" }, focusesEl(), meetingsEl()),
      h("div", { className: "pl-todo-head" }, h("h2", { textContent: "To-Do List" }), add),
      h("div", { className: "pl-cols" }, col(0), col(1)),
      items.length ? (() => { const b = h("button", { type: "button", className: "pl-later", textContent: `${items.length} from earlier still waiting` }); b.addEventListener("click", () => { sweepLater = false; renderTodo(); }); return b; })() : null,
    ];
  }
  if (stale) body.unshift(h("p", { className: "pl-stale", role: "alert", textContent: CLASH_TEXT[stale] }));
  const page = h("div", { className: `pl-page${archive ? " is-archive" : ""}`, ariaLabel: `Plan for ${planDate(today)}` }, ...body);
  // a window with a title bar: the red button closes it, like a Mac window; Archive looks back
  const swap = h("button", { type: "button", className: "pw-btn", textContent: archive ? "← Today" : "Archive", title: archive ? "Back to today's page" : "Earlier days' pages", hidden: focus.on });
  swap.addEventListener("click", () => { if (archive) { archive = null; renderTodo(); } else openArchive(); });
  const txtBtn = h("button", { type: "button", className: "pw-btn", textContent: "To-do.txt", title: "Today's list, to tick off in any order", hidden: Boolean(archive) });
  txtBtn.addEventListener("click", () => openTxt());
  const bar = h("div", { className: "pw-bar" }, dots("plan-day", () => $("plan-day").close()),
    h("span", { className: "pw-title", textContent: archive ? "Archive" : "Plan my day.txt" }), h("span", { className: "pw-tools" }, txtBtn, swap));
  $("todo").replaceChildren(bar, page);
  if (old && !archive) page.scrollTop = old.scrollTop;
  renderTxt();
  page.querySelectorAll(".pl-input").forEach(fitLine);
  if (active?.name) $("todo").querySelector(`[data-section="${active.sec}"] .pl-sec-name`)?.focus({ preventScroll: true });
  else if (active && active.i >= 0) focusLine(active.sec, active.i);
}
$("plan-day").addEventListener("close", () => { noteClosed("plan-day"); if (archive) { archive = null; renderTodo(); } });

// Today's plan widget was cut (Mel, 6 Oct 2026: redundant); the focuses go on the wall as post-its instead (part E).
// Kept as the one hook everything calls when the day's focuses or ticks change.
export function renderPlanWidget() {
  document.dispatchEvent(new Event("hanua:plan"));
}

const PLAN_ICON = '<svg viewBox="0 0 48 60" width="30" aria-hidden="true"><path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M9 24h28M9 30h28M9 36h28M9 42h20" stroke="#b9b2a5" stroke-width="2"/></svg>';
const showPlan = () => { if (!$("plan-day").open) $("plan-day").showModal(); };
registerWindow("plan-day", { title: "Plan my day", icon: PLAN_ICON, show: showPlan, hide: () => $("plan-day").close(), shown: () => $("plan-day").open });
export function openPlan() { showPlan(); noteOpen("plan-day"); }
