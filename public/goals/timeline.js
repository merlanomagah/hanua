// ---- Timeline: every goal as a bar from its start to its due date, grouped the way the hierarchy is ----
import { addDays, dayOf, daysBetween, parseDay, todayStr, ymd } from "../shared/dates.js";
import { goalSpan, treeOrder } from "../shared/goals.js";
import { $, api, fmtDay, h, state, toast } from "../lib.js";
import { STATE_CLASS, goalById, kidsOf, renderBoard, tlLevelPicker, tlLevels, tlRoot } from "./board.js";
import { openGoal } from "./form.js";
export function renderTimeline() {
  const goals = state.goals.goals;
  let list = goals.filter((g) => tlLevels.has(g.level || "Task"));
  if (tlRoot && goalById(tlRoot)) {
    const ids = new Set([tlRoot]);
    const down = (id) => kidsOf(id).forEach((c) => { if (!ids.has(c.id)) { ids.add(c.id); down(c.id); } });
    down(tlRoot);
    list = list.filter((g) => ids.has(g.id));
  }
  list.sort(treeOrder(goals));
  const dated = list.filter((g) => g.start || g.due);
  const undated = list.filter((g) => !g.start && !g.due);
  const box = h("div", { className: "tl-wrap" }, tlLevelPicker());
  if (!dated.length) {
    box.append(h("p", { className: "pin-empty", textContent: list.length ? "None of these goals have dates yet. Give them a start or due date and they'll appear here." : "No goals at these levels yet." }));
  } else {
    const spans = new Map(dated.map((g) => [g.id, goalSpan(g)]));
    const today = todayStr();
    const lo = [...spans.values()].reduce((m, s) => (s.start < m ? s.start : m), today);
    const hi = [...spans.values()].reduce((m, s) => (s.end > m ? s.end : m), today);
    // whole months either side, and at least three months on screen
    const first = parseDay(lo); first.setDate(1);
    const last = parseDay(hi); last.setMonth(last.getMonth() + 1, 0);
    if ((last - first) / 86_400_000 < 89) last.setTime(new Date(first.getFullYear(), first.getMonth() + 3, 0).getTime());
    const from = ymd(first), days = daysBetween(from, ymd(last)) + 1;
    const narrow = $("cork-cols").clientWidth < 760;
    const LABEL = narrow ? 130 : 250;
    const dayW = Math.max(narrow ? 4 : 3, ($("cork-cols").clientWidth - LABEL - 24) / days);
    const x = (iso) => daysBetween(from, iso) * dayW;
    const months = [];
    for (let d = new Date(first); d <= last; d.setMonth(d.getMonth() + 1)) {
      const iso = ymd(d), end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      months.push(h("span", { className: "tl-month", style: `left:${x(iso)}px;width:${(daysBetween(iso, ymd(end)) + 1) * dayW}px`,
        textContent: d.toLocaleDateString(undefined, d.getMonth() === 0 || !months.length ? { month: "short", year: "numeric" } : { month: "short" }) }));
    }
    const depthOf = (g) => { let n = 0; for (let p = goalById(g.parent), seen = new Set(); p && !seen.has(p.id); p = goalById(p.parent)) { seen.add(p.id); if (tlLevels.has(p.level)) n++; } return n; };
    const rows = dated.map((g) => {
      const s = spans.get(g.id);
      const lvl = (g.level || "Task").toLowerCase();
      const st = STATE_CLASS[(g.status || "new").toLowerCase()] || "new";
      const late = g.due && st !== "done" && dayOf(g.due) < today;
      const label = h("button", { type: "button", className: "tl-label", style: `padding-left:${10 + depthOf(g) * 14}px`, title: `Review “${g.title}”` },
        h("span", { className: "sp-type", textContent: g.level || "Task" }), h("span", { className: "tl-name", textContent: g.title }));
      const left = x(s.start), w = Math.max(dayW, (daysBetween(s.start, s.end) + 1) * dayW);
      const bar = h("button", {
        type: "button", className: `tl-bar ${st}${late ? " late" : ""}${s.guessStart ? " guess-start" : ""}${s.guessEnd ? " guess-end" : ""}`,
        style: `left:${left}px;width:${w}px`,
        title: `${g.level}: ${g.title}\n${fmtDay(s.start)} → ${fmtDay(s.end)}${s.guessStart ? " (no start date: estimated)" : ""}${s.guessEnd ? " (no due date: estimated)" : ""}\n${g.status || "New"} · ${g.progress ?? 0}%\nDrag to move it; drag an end to change just that date`,
      }, Object.assign(h("i"), { style: `width:${g.progress ?? 0}%` }), w >= 110 ? h("span", { textContent: g.title }) : null,
        ...(w >= 24 ? ["start", "end"].map((end) => { const grip = h("span", { className: `tl-grip ${end}` }); grip.dataset.end = end; return grip; }) : []));
      // a short bar has its name beside it
      const beside = w < 110 ? h("span", { className: "tl-beside", style: `left:${left + w + 6}px`, textContent: g.title }) : null;
      label.addEventListener("click", () => openGoal(g));
      bar.dataset.id = g.id;
      dragDates(bar, beside, g, s, dayW);
      return h("div", { className: `tl-row lv lvl-${lvl}` }, label, h("div", { className: "tl-track" }, bar, beside));
    });
    const width = days * dayW;
    const grid = h("div", { className: "tl-grid", style: `--label:${LABEL}px;width:${LABEL + width}px` },
      h("div", { className: "tl-head" }, h("span", { className: "tl-corner", textContent: `${dated.length} goal${dated.length === 1 ? "" : "s"}` }), h("div", { className: "tl-months" }, months)),
      h("div", { className: "tl-body" },
        h("div", { className: "tl-lines", ariaHidden: "true" }, months.map((m) => h("i", { style: `left:${m.style.left}` }))),
        today >= from && today <= ymd(last) ? h("span", { className: "tl-today", style: `left:calc(var(--label) + ${x(today) + dayW / 2}px)` }) : null,
        rows));
    box.append(h("div", { className: "tl" }, grid));
  }
  if (undated.length) {
    box.append(h("div", { className: "tl-undated" },
      h("span", { className: "cp-label", textContent: `No dates yet (${undated.length})` }),
      undated.map((g) => {
        const b = h("button", { type: "button", className: `tl-chip lv lvl-${(g.level || "Task").toLowerCase()}`, textContent: g.title, title: `Add dates to “${g.title}”` });
        b.addEventListener("click", () => openGoal(g));
        return b;
      })));
  }
  return box;
}
// Drag a bar: the middle moves both dates, an end moves just that date. A click still opens the goal.
// Arrow keys nudge it a day (with Shift, just the due date). Saves straight away, with Undo.
export function dragDates(bar, beside, g, s, dayW) {
  const left0 = parseFloat(bar.style.left);
  const tip = h("span", { className: "tl-tip" });
  const shifted = (mode, n) => {
    const d = { start: mode === "end" ? s.start : addDays(s.start, n), end: mode === "start" ? s.end : addDays(s.end, n) };
    if (d.end < d.start) mode === "start" ? (d.start = d.end) : (d.end = d.start);
    return d;
  };
  const show = (d) => {
    const l = left0 + daysBetween(s.start, d.start) * dayW, w = (daysBetween(d.start, d.end) + 1) * dayW;
    bar.style.left = `${l}px`;
    bar.style.width = `${w}px`;
    if (beside) beside.style.left = `${l + w + 6}px`;
    tip.style.left = `${l}px`;
    tip.textContent = `${fmtDay(d.start, { day: "numeric", month: "short" })} → ${fmtDay(d.end, { day: "numeric", month: "short" })}`;
    if (!tip.isConnected) bar.parentElement.append(tip);
  };
  // Moving keeps an estimated end estimated. Stretching one end fixes both, so the bar stays where you put it.
  const save = (mode, n) => {
    const d = shifted(mode, n), values = {};
    if (mode !== "move" || !s.guessStart) values.start = d.start;
    if (mode !== "move" || !s.guessEnd) values.due = d.end;
    setGoalDates(g, values);
  };
  let drag = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { mode: e.target.closest(".tl-grip")?.dataset.end || "move", x0: e.clientX, n: 0, moved: false };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 4) return;
    drag.moved = true;
    bar.classList.add("dragging");
    drag.n = Math.round(dx / dayW);
    show(shifted(drag.mode, drag.n));
  });
  bar.addEventListener("pointerup", () => {
    const d = drag;
    drag = null;
    if (!d) return;
    bar.classList.remove("dragging");
    tip.remove();
    if (!d.moved) return openGoal(g);
    if (d.n) save(d.mode, d.n); else renderBoard();
  });
  bar.addEventListener("pointercancel", () => { if (drag) { drag = null; renderBoard(); } });
  bar.addEventListener("click", (e) => { if (e.detail === 0) openGoal(g); }); // Enter or Space
  let key = null;
  bar.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const mode = e.shiftKey ? "end" : "move";
    if (key && key.mode !== mode) { clearTimeout(key.timer); const k = key; key = null; save(k.mode, k.n); return; }
    key ??= { mode, n: 0 };
    key.n += e.key === "ArrowRight" ? 1 : -1;
    show(shifted(mode, key.n));
    clearTimeout(key.timer);
    key.timer = setTimeout(() => { const k = key; key = null; tip.remove(); if (k.n) save(k.mode, k.n); }, 700);
  });
}

export async function setGoalDates(g, values, undoing = false) {
  const before = {};
  const refocus = document.activeElement?.classList.contains("tl-bar");
  const focusBar = () => { if (refocus) $("cork-cols").querySelector(`.tl-bar[data-id="${CSS.escape(g.id)}"]`)?.focus({ preventScroll: true }); };
  if ("start" in values) before.start = dayOf(g.start);
  if ("due" in values) before.due = dayOf(g.due);
  Object.assign(g, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null])));
  renderBoard();
  focusBar();
  try {
    const res = await api(`/api/goals/${g.id}`, { values });
    if (res.live) { state.goals = await api("/api/goals"); renderBoard(); focusBar(); }
    const now = goalSpan(goalById(g.id) || g);
    if (!undoing) toast(`“${g.title}”: ${fmtDay(now.start, { day: "numeric", month: "short" })} → ${fmtDay(now.end, { day: "numeric", month: "short" })}${res.live ? "" : " (sample, not saved to Notion)"}.`, false,
      { label: "Undo", run: () => setGoalDates(goalById(g.id) || g, before, true) });
  } catch (err) {
    Object.assign(g, Object.fromEntries(Object.entries(before).map(([k, v]) => [k, v || null])));
    renderBoard();
    toast(err.message, true);
  }
}

// open the Timeline with today in view
export function scrollTimelineToToday() {
  const tl = $("cork-cols").querySelector(".tl"), mark = tl?.querySelector(".tl-today");
  if (tl && mark) tl.scrollLeft = Math.max(0, mark.offsetLeft - tl.clientWidth / 3);
}
