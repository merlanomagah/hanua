// Plan my day: the page in its window (Mel, 6 Oct 2026): the date (Tue 06-Oct-2026), Today's focuses, three tasks,
// Meetings & events, the To-Do List in sections, the morning sweep, the archive, and Save & plan. Its widget,
// Today's plan, sits on the desktop. Rules: public/shared/desk.js (tested); the day itself: state.js.
// Plan ahead (Mel, 6 Oct 2026, evening; brief docs/plans/2026-10-plan-ahead-and-resizable-up-next.md): double-clicking
// the file opens the week, and a click on a day opens its page. A day ahead is the same page, saying so plainly
// ("Planning Wed 07-Oct", a faint tint, no ticks, no morning sweep), with Clear this day; Move to… sends picked lines
// to another day. Here `desk` is the page's day (state.js `page`), which is today's unless planning ahead.
import { carriedDays, clearDay, daySummary, moveLines, putLines, removeMeeting, setLines, takeLines, weekDays, CLASH_TEXT, deskSections, deskShape, fromMin, isFixed, keepPlan, lastFocus, leftovers, minsText, openItems, planDay, planDate, settle, shorterCol, stampLine, stepDay, timeLabel, toMin, DEFAULT_MINS, GENERAL, MAX_LINES, MAX_MEETINGS, MAX_NAME, MAX_SECTIONS, MEETING_PICKS, SECTION_ROWS, TIME_PICKS, TIME_WORDS } from "../shared/desk.js";
import { dayOf, parseDay, timeOf, todayStr, ymd } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { calendarItems, ensureApple } from "../app.js";
import { backup, changeDay, deskDay, desk as todayDesk, fixed, loaded, newId, page as desk, pageDay, pageEarlier as earlier, planningAhead, prompts, savePage as save, showDay, stale } from "./state.js";
import { openDayPicker } from "./daypick.js";
import { timeField } from "./timefield.js";
import { renderAgenda } from "./agenda.js";
import { openTxt, renderTxt } from "./todotxt.js";
import { dots, noteClosed, noteOpen, registerWindow } from "./window.js";
import { openDraft } from "./draft.js";
import { loadBackup, loadDesk } from "../planner.js";

let sweepLater = false;
let archive = null; // null = today's page; { days: [...], day, page } while looking back
let week = null; // null, or { shift, days, sums, further } while the week shows (double-clicking the file)
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

// ---- Undo, and several lines at once (Mel, 6 Oct 2026, part G) ----
// Anything that takes things away or changes many at once keeps a copy first and offers Undo
const KEPT = ["focus", "sections", "meetings", "settled", "settledAt", "order", "blocks", "overflow", "locked"];
const snapshot = (d) => structuredClone(Object.fromEntries(KEPT.map((k) => [k, d[k]])));
const redrawAll = (d = desk) => { save(d); renderTodo(); renderAgenda(); renderPlanWidget(); };
// target: the day changed (the page's, unless Up next changes today's while a day ahead is open)
export function undoable(text, change, target = desk) {
  const before = snapshot(target);
  change();
  redrawAll(target);
  toast(text, false, { label: "Undo", run: () => { Object.assign(target, structuredClone(before)); redrawAll(target); } });
}
// ⌘-click (or Ctrl-click) picks a line, Shift-click picks a run of them; then the bar at the bottom sets priority
// or time, moves them to another section, ticks or clears them. H / M / L set the priority too; Esc lets go.
let selected = new Set(), anchor = null;
const writtenRefs = () => desk.sections.flatMap((x) => x.lines.filter((l) => l.text).map((l) => l.id));
function pick(ref, range) {
  if (range && anchor) {
    const all = writtenRefs(), a = all.indexOf(anchor), b = all.indexOf(ref);
    if (a >= 0 && b >= 0) for (const r of all.slice(Math.min(a, b), Math.max(a, b) + 1)) selected.add(r);
  } else if (selected.has(ref)) selected.delete(ref);
  else selected.add(ref);
  anchor = ref;
  renderTodo();
}
export const clearPicks = () => { if (!selected.size) return false; selected = new Set(); anchor = null; renderTodo(); return true; };
function bulkBar() {
  const refs = [...selected].filter((r) => writtenRefs().includes(r));
  if (!refs.length) return null;
  const n = refs.length, many = `${n} line${n === 1 ? "" : "s"}`;
  const btn = (label, title, run, cls = "") => { const b = h("button", { type: "button", className: `bk-btn ${cls}`, textContent: label, title }); b.addEventListener("click", run); return b; };
  const pri = ["h", "m", "l"].map((p) => btn(PRI_LABEL[p], `Set ${many} to ${PRI_LABEL[p]} (${p.toUpperCase()})`, () => undoable(`${many}: ${PRI_LABEL[p]}`, () => setLines(desk, refs, { pri: p })), `p-${p}`));
  const time = h("select", { className: "bk-sel", ariaLabel: `Time for ${many}` }, h("option", { value: "", textContent: "Time…" }), TIME_PICKS.map((m) => h("option", { value: String(m), textContent: timeLabel(m) })));
  time.addEventListener("change", () => { const m = Number(time.value); if (m) undoable(`${many}: ${timeLabel(m)}`, () => setLines(desk, refs, { mins: m })); });
  // Move to… another section, or another day (Today, Tomorrow, or a day picked from the calendar)
  const today = todayStr(), tomorrow = stepDay(today, 1);
  const days = [pageDay !== today ? ["day:" + today, "Today"] : null, pageDay !== tomorrow ? ["day:" + tomorrow, "Tomorrow"] : null, ["pick", "A day…"]].filter(Boolean);
  const move = h("select", { className: "bk-sel", ariaLabel: `Move ${many} to` }, h("option", { value: "", textContent: "Move to…" }),
    h("optgroup", { label: "A section" }, desk.sections.map((x) => h("option", { value: x.id, textContent: x.name || "General" }))),
    h("optgroup", { label: "Another day" }, days.map(([v, t]) => h("option", { value: v, textContent: t }))));
  move.addEventListener("change", () => {
    if (move.value === "pick") { move.value = ""; openDayPicker(move, { not: pageDay, title: `Send ${many} to`, onPick: (day) => sendLines(refs, day) }); return; }
    if (move.value.startsWith("day:")) return sendLines(refs, move.value.slice(4));
    if (move.value) { const to = desk.sections.find((x) => x.id === move.value); undoable(`${many} moved to ${to?.name || "General"}`, () => moveLines(desk, refs, move.value)); }
  });
  return h("div", { className: "pl-bulk", role: "toolbar", ariaLabel: `${many} picked` },
    h("span", { className: "bk-count", textContent: `${many} picked` }), ...pri, time, move,
    pageDay > todayStr() ? null : btn("✓ Done", `Tick ${many}`, () => undoable(`${many} ticked`, () => setLines(desk, refs, { done: true }))),
    btn("Clear", `Take ${many} off the page`, () => undoable(`${many} cleared`, () => { const want = new Set(refs); for (const x of desk.sections) x.lines = x.lines.filter((l) => !want.has(l.id)); selected = new Set(); })),
    btn("✕", "Let go of the picked lines (Esc)", clearPicks, "bk-x"));
}
// Remove one task (Mel, 8 Oct 2026: the × left of its tick, in Plan my day and To-do.txt), with Undo. d: the day it's
// on (the page's, or today's from To-do.txt). Its block leaves Up next with it (a block whose task is gone is skipped);
// Undo puts back the line, its place in the order and the plan as they were.
export function removeLine(d, id) {
  const line = d.sections.flatMap((x) => x.lines).find((l) => l.id === id);
  if (!line?.text) return;
  selected.delete(id);
  undoable(`Removed: ${line.text}`, () => {
    for (const x of d.sections) {
      x.lines = x.lines.filter((l) => l.id !== id);
      while (x.lines.length && !x.lines.at(-1).text) x.lines.pop();
    }
    d.order = (d.order || []).filter((r) => r !== id);
  }, d);
}
// line: the line, or a function giving it (a row typed on just now has its line only once something's written)
const delButton = (d, line) => {
  const get = typeof line === "function" ? line : () => line;
  const b = h("button", { type: "button", className: "pl-del", textContent: "×", ariaLabel: "Remove this task", title: "Remove this task" });
  b.addEventListener("click", (e) => { e.stopPropagation(); const l = get(); if (l?.text) removeLine(d, l.id); });
  b.addEventListener("focus", () => { b.ariaLabel = `Remove ${get()?.text || "this task"}`; });
  return b;
};
export { delButton };
// Send picked lines to another day: they leave this page and wait on that one, under the same section (Undo brings
// them back and takes them off that day again)
export async function sendLines(refs, toDay) {
  const from = desk, fromDay = pageDay, before = snapshot(from);
  const taken = takeLines(from, refs, fromDay);
  if (!taken.length) return;
  const ok = await changeDay(toDay, (d) => putLines(d, taken, newId));
  if (!ok) { Object.assign(from, structuredClone(before)); renderTodo(); toast(`Couldn't send them to ${dayName(toDay)}: nothing was moved.`, true); return; }
  selected = new Set(); anchor = null;
  redrawAll(from);
  const n = taken.length, sent = new Set(taken.map((t) => t.placed));
  toast(`${n} line${n === 1 ? "" : "s"} sent to ${dayName(toDay)}`, false, { label: "Undo", run: async () => {
    await changeDay(toDay, (d) => { for (const s of d.sections) s.lines = s.lines.filter((l) => !sent.has(l.id)); });
    Object.assign(from, structuredClone(before)); redrawAll(from);
  } });
}
// "Tomorrow", "Today", or "Thu 15 Oct"
export function dayName(day) {
  const t = todayStr();
  return day === t ? "today" : day === stepDay(t, 1) ? "tomorrow" : parseDay(day).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}
$("todo").addEventListener("keydown", (e) => {
  if (!selected.size || e.target.closest?.("textarea, input, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const p = { h: "h", m: "m", l: "l" }[e.key.toLowerCase()];
  if (p) { e.preventDefault(); const refs = [...selected]; undoable(`${refs.length} line${refs.length === 1 ? "" : "s"}: ${PRI_LABEL[p]}`, () => setLines(desk, refs, { pri: p })); }
});
// Esc lets go of the picked lines first, before it closes the window
$("plan-day").addEventListener("cancel", (e) => { if (clearPicks()) e.preventDefault(); });

// a tickable line kept in its place: typing on it makes it real, a tick only once something's written
function tickLine(line, { label, section, index, onText, onTick, ensure }) {
  const li = h("li", { className: `pl-line${line?.done ? " done" : ""}${line?.text ? "" : " empty"}` });
  const tick = check(Boolean(line?.done), `Mark ${label} done`);
  if (pageDay > todayStr()) { tick.disabled = true; tick.title = "Ticks come on the day"; } // nothing's done before the day
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
  // ⌘-click / Shift-click picks it (part G)
  if (line?.id) {
    li.dataset.ref = line.id;
    li.classList.toggle("picked", selected.has(line.id));
    li.addEventListener("pointerdown", (e) => { if ((e.metaKey || e.ctrlKey || e.shiftKey) && line.text) e.preventDefault(); }); // no caret
    li.addEventListener("click", (e) => {
      if (!(e.metaKey || e.ctrlKey || e.shiftKey) || !line.text) return;
      e.preventDefault(); e.stopPropagation();
      document.activeElement?.blur?.();
      pick(line.id, e.shiftKey);
    }, true);
  }
  if (ensure) li.append(picks(() => line || { pri: "", mins: 0 }, (v) => { line = ensure(); Object.assign(line, v); save(); }));
  return li;
}

function focusesEl() {
  const hint = lastFocus(earlier, deskDay) || [];
  return tagged(h("section", { className: "pl-sec pl-focus" }, heading(pageDay === todayStr() ? "Today's focuses" : "Focuses", "focus"),
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
    // × to the left of the tick and → at the end (Mel, 8 Oct 2026): on every row, shown once the row has words in
    // it (the row's "empty" class), so a task typed just now has them too
    const lineNow = () => sec.lines[i];
    list.lastChild.prepend(delButton(desk, lineNow));
    const send = h("button", { type: "button", className: "pl-send", textContent: "→", ariaLabel: "Send to another day", title: "Send to another day" });
    send.addEventListener("click", () => { const l = lineNow(); if (l?.text) openDayPicker(send, { not: pageDay, title: "Send it to", onPick: (day) => sendLines([l.id], day) }); });
    list.lastChild.append(send);
    // a line emptied by deleting its text gets an Undo when you leave it (not while you're retyping it)
    const field = list.lastChild.querySelector(".pl-input");
    let had = null;
    field.addEventListener("focus", () => { had = sec.lines[i]?.text ? structuredClone(sec.lines[i]) : null; });
    field.addEventListener("blur", () => {
      const was = had; had = null;
      if (!was || sec.lines.some((l) => l.id === was.id && l.text)) return;
      toast(`Cleared: ${was.text}`, false, { label: "Undo", run: () => {
        const at = sec.lines.findIndex((l) => l.id === was.id);
        if (at >= 0) sec.lines[at] = was;
        else { while (sec.lines.length < i) sec.lines.push({ id: newId(), text: "", done: false, pri: "", mins: 0 }); if (sec.lines[i] && !sec.lines[i].text) sec.lines[i] = was; else sec.lines.splice(i, 0, was); }
        redrawAll();
      } });
    });
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
    x.addEventListener("click", () => undoable(`${sec.name || "Section"} removed`, () => { desk.sections = desk.sections.filter((s) => s !== sec); }));
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
  const act = (label, title, run, said = null) => {
    const b = h("button", { type: "button", className: "sw-act", textContent: label, title });
    b.addEventListener("click", () => (said ? undoable(said, run) : (run(), renderTodo()))); // every decision has an Undo
    return b;
  };
  return h("div", { className: "pl-sweep" },
    h("h3", { textContent: "Before you start" }),
    h("p", { className: "sw-lede", textContent: `${items.length} ${items.length === 1 ? "thing" : "things"} from earlier ${items.length === 1 ? "wasn't" : "weren't"} ticked off. Done already, bring into today, or let go?` }),
    h("ul", { className: "sw-list" }, items.map((it) => h("li", { className: "sw-item" },
      h("span", { className: "sw-from", textContent: fromText(it), title: fromText(it) }),
      h("span", { className: "sw-text", textContent: it.text }),
      h("span", { className: "sw-acts" },
        act("✓ Done", "It got done: tick it off", () => settleAs(it, "done"), `Done: ${it.text}`),
        act("→ Today", "Bring it into today", () => settleAs(it, "today"), `Brought into today: ${it.text}`),
        act("✕ Remove", "Let it go", () => settleAs(it, "gone"), `Let go: ${it.text}`))))),
    h("div", { className: "sw-foot" },
      act("All to today", "Bring every one into today", () => items.forEach((it) => settleAs(it, "today")), `${items.length} brought into today`),
      act("Let all go", "Let every one go", () => items.forEach((it) => settleAs(it, "gone")), `${items.length} let go`),
      act("Later", "Plan first; these wait until next time", () => { sweepLater = true; })));
}

// the archive: earlier days, read-only
export async function openArchive(at = null) {
  week = null;
  archive = { days: [], day: null, page: null };
  loadBackup();
  renderTodo();
  try { archive.days = (await (await fetch("/api/desk/days")).json()).filter((d) => d < deskDay); } catch { archive.days = []; }
  const day = at && archive.days.includes(at) ? at : archive.days[0];
  if (day) await showArchiveDay(day); else renderTodo();
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
    // typed, not the browser's time box (8 Oct 2026: Safari drew its own placeholder over what Mel typed)
    const time = timeField(m?.time, { label: `Meeting ${i + 1} time`, onSet: (t) => { ensure().time = t; save(); renderAgenda(); } });
    const timeBox = h("span", { className: "pl-timebox" }, time);
    const len = h("select", { className: `pl-mins${m?.mins ? "" : " unset"}`, ariaLabel: "How long", title: "How long (blank counts as 30 min)" },
      h("option", { value: "0", textContent: "30m?" }), MEETING_PICKS.map((v) => h("option", { value: String(v), textContent: minsText(v), selected: m?.mins === v })));
    len.addEventListener("change", () => { ensure().mins = Number(len.value); len.classList.toggle("unset", !Number(len.value)); save(); });
    const title = lineInput(m?.title || "", { label: `Meeting ${i + 1}`, placeholder: i === 0 && !m ? "e.g. Coffee with Sam" : "", section: "meet", index: i, onInput: (v) => {
      ensure().title = v; save(); renderAgenda();
      if (v && i === rows - 1 && rows < MAX_MEETINGS) renderTodo();
    } });
    // × takes a meeting row away (with Undo); an empty row has nothing to take away
    const del = m && (m.title || m.time) ? h("button", { type: "button", className: "pl-sec-x pl-meet-x", textContent: "×", ariaLabel: `Remove ${m.title || "this meeting"}`, title: "Remove this meeting" }) : null;
    del?.addEventListener("click", () => undoable(`Removed: ${m.title || "meeting"}`, () => removeMeeting(desk, m.id)));
    list.append(h("li", { className: "pl-line pl-meet" }, timeBox, title, len, focus.on ? null : workChip(Boolean(m?.work), "Meeting", () => { const x = ensure(); x.work = !x.work; save(); return x.work; }), del));
  }
  return tagged(h("section", { className: "pl-sec pl-meetings" }, heading("Meetings & events", "meetings"), list), "meet");
}

// the working day and Save & plan
export const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function dayBar() {
  const field = (k, label) => timeField(desk.day[k], { label, blank: false, lean: k === "start" ? "am" : "pm", onSet: (t) => { desk.day[k] = t; save(); } });
  const go = h("button", { type: "button", className: "pl-go", textContent: desk.locked ? (pageDay > todayStr() ? "Re-plan" : "Re-plan from now") : "Save & plan", title: "See the day as it would run, arrange the order, then lock it in" });
  go.addEventListener("click", () => openDraft());
  // a day ahead: Save just saves and goes back to the two weeks (Mel, 8 Oct 2026); the page also saves as you type
  const ahead = pageDay > todayStr();
  const keep = ahead ? h("button", { type: "button", className: "pl-go pl-save", textContent: "Save", title: "Save this day and go back to the two weeks" }) : null;
  keep?.addEventListener("click", () => {
    document.activeElement?.blur?.(); // a time or line being typed is taken first
    const day = pageDay;
    save();
    openWeek();
    toast(`Saved ${planDate(day)}`);
  });
  return h("div", { className: "pl-daybar" }, h("span", { className: "pl-daylabel", textContent: "My day" }), field("start", "Day starts"), h("span", { textContent: "–" }), field("end", "Day ends"), keep, go);
}
// fixed things on a day: its jotted meetings, and timed events already in the calendars (the page's day by default)
export function fixedOn(day = pageDay, d = desk) {
  const cal = calendarItems().filter((x) => dayOf(x.date) === day && timeOf(x.date) && x.kind !== "Due" && !x.goal)
    .map((x) => ({ start: timeOf(x.date), end: x.end && dayOf(x.end) === day && timeOf(x.end) ? timeOf(x.end) : fromMin(Math.min(1439, toMin(timeOf(x.date)) + DEFAULT_MINS)), title: focus.on && x.busy ? "Busy" : x.title }));
  const meets = d.meetings.filter((m) => m.time).map((m) => ({ start: m.time, end: fromMin(Math.min(1439, toMin(m.time) + (m.mins || DEFAULT_MINS))), title: focus.on && !m.work ? "Busy" : m.title || "Meeting" }));
  return [...cal, ...meets];
}
export const fixedToday = () => fixedOn(todayStr(), todayDesk);
export function renderTodo() {
  const today = todayStr();
  if (deskDay !== today && loaded) { archive = null; loadDesk(); return; } // a new day: a fresh page
  renderPlanWidget();
  // Priority and Time sit in two even columns down the page (Mel, 7 Oct 2026): the Time column is as wide as the
  // longest time word, which Mel can rename in Settings
  $("todo").style.setProperty("--mins-n", Math.max(4, ...Object.values(TIME_WORDS).map((w) => w.length)));
  const day = pageDay, ahead = day > today;
  const shows = deskSections(focus.on);
  // keep the cursor where it was across a re-render
  const at = document.activeElement?.closest?.("#todo [data-section]");
  const active = at ? { sec: at.dataset.section, i: [...at.querySelectorAll(".pl-input")].indexOf(document.activeElement), name: document.activeElement.classList.contains("pl-sec-name") } : null;
  const old = $("todo").querySelector(".pl-page");

  let body;
  // the morning sweep is today's only: a day ahead hasn't had a yesterday yet
  const items = shows.length && !archive && !week && !ahead ? leftovers({ ...earlier, [today]: desk }, today) : [];
  const dateBar = () => h("div", { className: "pl-datebar" }, h("p", { className: "pl-date", textContent: planDate(day) }),
    ahead ? h("span", { className: "pl-ahead-tag", textContent: dayName(day) === "tomorrow" ? "Planning tomorrow" : "Planning ahead" }) : null, dayBar());
  if (week) body = [weekEl()];
  else if (!shows.length) {
    // at work: only what's marked Work (meetings, Tasks if marked, Work sections); the rest is put away
    const work = desk.sections.filter((x) => x.work);
    body = [
      dateBar(),
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
      dateBar(),
      // the 3 Tasks were cut (6 Oct 2026): focuses and the day's meetings side by side, so the To-Do List comes up
      h("div", { className: "pl-cols pl-top" }, focusesEl(), meetingsEl()),
      h("div", { className: "pl-todo-head" }, h("h2", { textContent: "To-Do List" }), add),
      h("div", { className: "pl-cols" }, col(0), col(1)),
      items.length ? (() => { const b = h("button", { type: "button", className: "pl-later", textContent: `${items.length} from earlier still waiting` }); b.addEventListener("click", () => { sweepLater = false; renderTodo(); }); return b; })() : null,
    ];
  }
  if (stale) body.unshift(h("p", { className: "pl-stale", role: "alert", textContent: CLASH_TEXT[stale] }));
  const page = h("div", { className: `pl-page${archive ? " is-archive" : ""}${week ? " is-week" : ""}${ahead && !week && !archive ? " ahead" : ""}`, ariaLabel: week ? "The week" : `Plan for ${planDate(day)}` }, ...body);
  // a window with a title bar: the red button closes it, like a Mac window; Week, Archive, and back to today
  const btn = (label, title, run, hidden = false) => { const b = h("button", { type: "button", className: "pw-btn", textContent: label, title, hidden }); b.addEventListener("click", run); return b; };
  const onPage = !archive && !week;
  const tools = [
    onPage && ahead && daySummary(desk).written ? btn("Clear this day", `Take everything off ${planDate(day)} (with Undo)`, () => undoable(`Cleared ${planDate(day)}`, () => clearDay(desk))) : null,
    btn("To-do.txt", "Today's list, to tick off in any order", () => openTxt(), !onPage || ahead),
    btn("Week", "The week: pick a day to plan", () => openWeek(), week !== null || focus.on),
    archive || week || ahead ? btn("← Today", "Back to today's page", () => goDay(today)) : btn("Archive", "Earlier days' pages", () => openArchive(), focus.on),
  ].filter(Boolean);
  const title = archive ? "Archive" : week ? "Plan my day: the week" : ahead ? `Planning ${planDate(day)}` : "Plan my day.txt";
  const bar = h("div", { className: "pw-bar" }, dots("plan-day", () => $("plan-day").close()), h("span", { className: "pw-title", textContent: title }), h("span", { className: "pw-tools" }, ...tools));
  $("todo").replaceChildren(bar, page, ...(onPage ? [bulkBar()].filter(Boolean) : []));
  if (old && onPage && old.ariaLabel === page.ariaLabel) page.scrollTop = old.scrollTop;
  renderTxt();
  page.querySelectorAll(".pl-input").forEach(fitLine);
  if (active?.name) $("todo").querySelector(`[data-section="${active.sec}"] .pl-sec-name`)?.focus({ preventScroll: true });
  else if (active && active.i >= 0) focusLine(active.sec, active.i);
}
$("plan-day").addEventListener("close", () => {
  noteClosed("plan-day");
  // the next opening starts from today again (a day ahead's last change is saved as it goes)
  const wasElsewhere = archive || week || planningAhead();
  archive = null; week = null; clearPicks();
  if (wasElsewhere) showDay(todayStr()).then(renderTodo);
});

// ---- the week (Mel, 6 Oct 2026: double-click Plan my day, see the week, click the day to plan) ----
// Mon–Sun with what each day holds; ‹ › for other weeks; past days open in the Archive (read-only), today and days
// ahead open their page. Days further ahead that already have something written are listed underneath.
export async function openWeek(shift = 0) {
  archive = null;
  const days = [...weekDays(todayStr(), shift), ...weekDays(todayStr(), shift + 1)]; // two weeks: this and next (8 Oct 2026)
  week = { shift, days, sums: week?.shift === shift ? week.sums : {}, further: week?.further || [] };
  renderTodo();
  const mine = week;
  try {
    const sums = await (await fetch(`/api/desk/summary?days=${days.join(",")}`)).json();
    // further ahead: any day after this week (and after today) with something on it, the next eight
    const all = await (await fetch("/api/desk/days")).json();
    const later = all.filter((d) => d > days[13] && d > todayStr()).sort().slice(0, 20);
    const more = later.length ? await (await fetch(`/api/desk/summary?days=${later.join(",")}`)).json() : {};
    if (week !== mine) return;
    week.sums = sums;
    week.further = later.filter((d) => more[d]?.written).slice(0, 8).map((d) => ({ day: d, sum: more[d] }));
  } catch { if (week === mine) week.failed = true; }
  if (week === mine) renderTodo();
}
function weekEl() {
  const today = todayStr();
  // the days open here are drawn from what's on the page now, not the last save
  const sumOf = (d) => (d === today ? daySummary(todayDesk) : d === pageDay ? daySummary(desk) : week.sums[d]);
  const sumText = (x, past) => {
    if (!x) return [week.failed ? "Couldn't read" : past ? "" : "…"];
    if (!x.written) return [past ? "Nothing written" : "Nothing yet"];
    const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
    return [x.focus ? plural(x.focus, "focus", "focuses") : null,
      x.tasks || x.done ? `${plural(x.tasks + x.done, "task")}${x.done ? ` · ${x.done} done` : ""}` : null,
      x.meetings ? plural(x.meetings, "meeting") : null].filter(Boolean);
  };
  const card = (d) => {
    const past = d < today, x = sumOf(d);
    const b = h("button", { type: "button", className: `wk-day${d === today ? " today" : ""}${past ? " past" : ""}${x?.written ? " written" : ""}${x?.locked ? " locked" : ""}`,
      ariaLabel: `${planDate(d)}${d === today ? ", today" : ""}: ${sumText(x, past).join(", ")}${past ? " (opens in the Archive)" : ""}` },
      h("span", { className: "wk-name", textContent: parseDay(d).toLocaleDateString("en-NZ", { weekday: "short" }) }),
      h("span", { className: "wk-date", textContent: parseDay(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) }),
      d === today ? h("span", { className: "wk-tag", textContent: "Today" }) : null,
      h("span", { className: "wk-sum" }, sumText(x, past).map((t) => h("span", { textContent: t }))),
      !past && x?.titles?.length ? h("ul", { className: "wk-titles" }, x.titles.map((t) => h("li", { textContent: t }))) : null,
      x?.locked ? h("span", { className: "wk-lock", textContent: "Locked in" }) : !past && !x?.written ? h("span", { className: "wk-go", textContent: "Plan this day →" }) : null);
    b.addEventListener("click", () => (past ? openArchive(d) : goDay(d)));
    return b;
  };
  const nav = (label, step, aria) => { const b = h("button", { type: "button", className: "ip-nav wk-nav", textContent: label, ariaLabel: aria }); b.addEventListener("click", () => openWeek(week.shift + step)); return b; };
  const first = parseDay(week.days[0]), last = parseDay(week.days[13]);
  const span = `${first.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`;
  const thisWeek = week.shift ? (() => { const b = h("button", { type: "button", className: "pw-btn", textContent: "This week" }); b.addEventListener("click", () => openWeek(0)); return b; })() : null;
  const further = week.further.length ? h("div", { className: "wk-further" }, h("h4", { textContent: "Also planned ahead" }),
    h("ul", {}, week.further.map(({ day: d, sum }) => { const b = h("button", { type: "button", className: "wk-chip", textContent: `${planDate(d)} · ${sumText(sum).join(", ")}` }); b.addEventListener("click", () => goDay(d)); return h("li", {}, b); }))) : null;
  return h("div", { className: "pl-week" },
    h("header", { className: "wk-head" }, nav("‹", -1, "Week before"), h("div", { className: "wk-title" }, h("h2", { textContent: week.shift === 0 ? "This week and next" : week.shift === -1 ? "Last week and this" : "Two weeks" }), h("span", { textContent: span })), nav("›", 1, "Week after"), thisWeek),
    h("div", { className: "wk-grid" }, week.days.map(card)),
    h("p", { className: "wk-hint", textContent: "Click a day to plan it. Earlier days open in the Archive. To put a task on a day without opening it: → on a line, or When in To-do.txt." }),
    further);
}
// Open a day's page (today, or a day ahead) in the window
export async function goDay(day) {
  archive = null; week = null; clearPicks(); resetSweep();
  const ok = await showDay(day);
  if (!ok && day > todayStr()) toast(`Couldn't open ${planDate(day)} just now: try again in a moment.`, true);
  if (day > todayStr()) ensureApple(day); // that day's calendar, for Save & plan
  renderTodo();
  $("todo").querySelector(".pl-focus .pl-input")?.focus({ preventScroll: true });
}

// Today's plan widget was cut (Mel, 6 Oct 2026: redundant); the focuses go on the wall as post-its instead (part E).
// Kept as the one hook everything calls when the day's focuses or ticks change.
export function renderPlanWidget() {
  document.dispatchEvent(new Event("hanua:plan"));
}

const PLAN_ICON = '<svg viewBox="0 0 48 60" width="30" aria-hidden="true"><path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fdfcf9" stroke="#cfc8bb"/><path d="M9 24h28M9 30h28M9 36h28M9 42h20" stroke="#b9b2a5" stroke-width="2"/></svg>';
const showPlan = () => { if (!$("plan-day").open) $("plan-day").showModal(); };
registerWindow("plan-day", { title: "Plan my day", icon: PLAN_ICON, show: showPlan, hide: () => $("plan-day").close(), shown: () => $("plan-day").open });
// opened from the desktop file: the week first (at work, today's page: the week would show personal days); from
// anywhere else (To-do.txt, the morning, Up next): today's page
// Plan my day open at a given day (To-do.txt's "Open that day")
export function openDay(day) { showPlan(); noteOpen("plan-day"); goDay(day); }
export function openPlan({ week: asWeek = false } = {}) {
  showPlan(); noteOpen("plan-day");
  if (asWeek && !focus.on) openWeek();
  else if (week || archive || planningAhead()) goDay(todayStr());
}
