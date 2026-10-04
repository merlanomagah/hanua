// ---------- goals pin board: swipe right to slide the wall aside ----------
import { dayOf, daysBetween, todayStr } from "../shared/dates.js";
import { LEVELS, isGoalDone, levelIndex, lineageIn, rollUp, treeOrder } from "../shared/goals.js";
import { GUIDE, WIP_LIMIT } from "../coach.js";
import { $, api, fmtDay, h, reducedMotion, state, store, toast } from "../lib.js";
import { layoutSpider, renderSpider } from "./tree.js";
import { renderTimeline, scrollTimelineToToday } from "./timeline.js";
import { openPlan } from "./plan.js";
import { askFelt, openGoal } from "./form.js";
import { reviewDue } from "./review.js";
import { coinText, dollars, epicValue, renderTopShelf } from "../shelf.js";
import { renderCalendar } from "../app.js";

// Status and Area options come from the Goals database in Notion (sent with /api/goals); these are the fallbacks.
export const GOAL_STATUS = ["New", "Active", "At risk", "Done"];
export const GOAL_AREAS = ["Work", "Health", "Learning", "People", "Money", "Personal"];
export const STATE_CLASS = { new: "new", active: "active", "at risk": "risk", done: "done" };
export const CARD_TILTS = ["-1.2deg", "0.9deg", "-0.5deg", "1.5deg", "-1.6deg", "0.6deg"];

export let onBoard = false;
export function showBoard(on) {
  if (on === onBoard) return;
  onBoard = on;
  if (on) renderBoard();
  $("wall").classList.toggle("on-board", on);
  if (!on) $("wall").style.minHeight = "";
  $("ts-goals")?.classList.toggle("on", on);
  $("board-pane").inert = !on;
  $("wall-in").inert = on;
  // the wall sits right under the top shelf, so the top of the page shows it (or the board) in full
  if (window.scrollY > 40) window.scrollTo({ top: 0, behavior: reducedMotion || window.scrollY > 1200 ? "auto" : "smooth" });
  (on ? $("goal-add") : $("to-board")).focus({ preventScroll: true });
}
$("to-board").addEventListener("click", () => showBoard(true));
$("to-wall").addEventListener("click", () => showBoard(false));

// Trackpad: two fingers moving right shows the board, left brings the wall back.
export let swipeX = 0, swipeTimer = 0, swipeLock = 0;
$("wall").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || document.querySelector("dialog[open]")) return;
  e.preventDefault();
  if (Date.now() < swipeLock) return;
  swipeX += e.deltaX;
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => { swipeX = 0; }, 250);
  if (Math.abs(swipeX) < 70) return;
  showBoard(swipeX < 0);
  swipeX = 0;
  swipeLock = Date.now() + 700;
}, { passive: false });

// Touch: a finger dragged sideways across the wall.
export let touch0 = null;
$("wall").addEventListener("touchstart", (e) => { touch0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("wall").addEventListener("touchend", (e) => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest(".goal-card, .pin-list")) showBoard(dx > 0);
});

// ---- board state ----
// Views: "tree" is the Hierarchy columns, "kanban" the Board, "spider" the Tree diagram, "timeline" the Timeline.
export const BOARD_VIEWS = ["tree", "kanban", "spider", "timeline"];
export let boardView = BOARD_VIEWS.includes(store("goals-view")) ? store("goals-view") : "tree";
export let boardLevel = LEVELS.some((l) => l.name === store("goals-level")) ? store("goals-level") : "Task";
export let focusGoal = null;
export const setFocusGoal = (id) => { focusGoal = id; };
export let spiderRoot = store("goals-root") || null; // the goal in the centre of the Tree view
export let tlRoot = store("goals-tl-root") || ""; // "" = every goal on the Timeline
export let tlLevels = new Set((store("goals-tl-levels") || LEVELS.map((l) => l.name).join(",")).split(",").filter((n) => LEVELS.some((l) => l.name === n)));
if (!tlLevels.size) tlLevels = new Set(LEVELS.map((l) => l.name));
export const goalById = (id) => state.goals.goals.find((g) => g.id === id);

// A goal plus everything above and below it: the thread shown when you pick a card.
export const lineage = (id) => lineageIn(state.goals.goals, id);

export function renderBoard() {
  const { goals, live, notionUrl, error } = state.goals;
  const open = goals.filter((g) => !isGoalDone(g));
  const count = (st) => goals.filter((g) => (g.status || "").toLowerCase() === st).length;
  const soon = open.filter((g) => g.due && daysBetween(todayStr(), g.due) >= 0 && daysBetween(todayStr(), g.due) <= 7).length;
  $("board-sub").textContent = error
    ? `Couldn't reach Notion: ${error}`
    : `${open.length} open · ${count("active")} active · ${count("at risk")} at risk · ${count("done")} done · ${soon} due this week${live ? "" : " · sample goals"}`;
  $("goals-notion").hidden = !notionUrl;
  if (notionUrl) $("goals-notion").href = notionUrl;
  $("goals-guide").hidden = !state.goals.guideUrl;
  if (state.goals.guideUrl) $("goals-guide").href = state.goals.guideUrl;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === boardView)));
  document.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.level === boardLevel)));
  $("level-seg").hidden = boardView !== "kanban";
  fillRootPicker();
  $("review-open").classList.toggle("due", reviewDue());
  $("review-open").title = reviewDue() ? "Your weekly review is due" : `Last review ${fmtDay(state.reviews.reviews[0]?.date)}`;
  $("goal-add").textContent = boardView === "kanban" ? `+ New ${boardLevel}` : "+ New ▾";
  $("goal-add").setAttribute("aria-haspopup", boardView === "kanban" ? "false" : "menu");
  $("cork").classList.toggle("kanban", boardView === "kanban");
  $("cork").classList.toggle("view-spider", boardView === "spider");
  $("cork").classList.toggle("view-timeline", boardView === "timeline");
  if (focusGoal && !goalById(focusGoal)) focusGoal = null;
  const thread = focusGoal ? lineage(focusGoal) : null;
  let n = 0;
  const cols = boardView === "spider" ? [renderSpider()]
    : boardView === "timeline" ? [renderTimeline()]
    : boardView === "kanban"
    ? GOAL_STATUS.map((st) => {
        const list = goals.filter((g) => g.level === boardLevel && (g.status || "New") === st).sort(treeOrder(goals));
        // Personal Kanban: cap what's in progress, so things get finished
        const over = st === "Active" && list.length > WIP_LIMIT;
        const col = h("section", { className: `pin-col state-${STATE_CLASS[st.toLowerCase()]}${over ? " over-limit" : ""}` },
          h("h3", { className: "pin-tag", title: st === "Active" ? `Work-in-progress limit: ${WIP_LIMIT}. Finish one before starting another.` : "" }, st,
            h("span", { className: "pin-count", textContent: st === "Active" ? `${list.length}/${WIP_LIMIT}` : list.length })),
          over ? h("p", { className: "wip-note", textContent: `Over your limit of ${WIP_LIMIT}. Finish or park one before starting more.` }) : null,
          h("div", { className: "pin-list" }, list.length ? list.map((g) => goalCard(g, n++, thread)) : h("p", { className: "pin-empty", textContent: "Drop a card here" })));
        dropZone(col, st);
        return col;
      })
    : LEVELS.map((lvl) => {
        const list = goals.filter((g) => (g.level || "Task") === lvl.name).sort(treeOrder(goals));
        return h("section", { className: `pin-col lvl-${lvl.name.toLowerCase()}` },
          h("h3", { className: "pin-tag", title: GUIDE[lvl.name].what }, lvl.name, h("span", { className: "pin-when", textContent: ` · ${lvl.when}` }), h("span", { className: "pin-count", textContent: list.length })),
          h("div", { className: "pin-list" }, list.length ? list.map((g) => goalCard(g, n++, thread)) : h("p", { className: "pin-empty", textContent: lvl.name === "Epic" ? "Start with a big goal for the year" : "Nothing pinned" })));
      });
  $("cork-cols").replaceChildren(...cols);
  $("cork-cols").querySelectorAll(".pin-list").forEach((l) => l.addEventListener("scroll", drawThreads, { passive: true }));
  if (boardView === "spider") layoutSpider();
  if (boardView === "timeline") scrollTimelineToToday();
  renderTopShelf();
  renderCalendar();
  // the wall stretches to fit a long board (phones stack the columns)
  $("wall").style.minHeight = onBoard ? `${$("board-pane").offsetHeight}px` : "";
  requestAnimationFrame(drawThreads);
}

export function actButton(act, label) {
  const b = h("button", { type: "button", className: "g-act", textContent: label });
  b.dataset.act = act;
  return b;
}

export function goalCard(g, i, thread) {
  const st = STATE_CLASS[(g.status || "new").toLowerCase()] || "new";
  const late = g.due && st !== "done" && dayOf(g.due) < todayStr();
  const lvl = (g.level || "Task").toLowerCase();
  const childLevel = LEVELS[levelIndex(g.level) + 1];
  const parent = goalById(g.parent);
  const kids = g.children?.length || 0;
  const el = h("article", {
    className: `goal-card lvl-${lvl} ${st}${thread ? (thread.has(g.id) ? " lit" : " dim") : ""}${focusGoal === g.id ? " focus" : ""}`,
    tabIndex: 0, ariaLabel: `${g.level || "Task"}: ${g.title}, ${g.status || "New"}`,
  },
    h("span", { className: "g-top" },
      h("span", { className: "g-type", textContent: g.level || "Task" }),
      g.priority ? h("span", { className: `g-pri p${g.priority}`, textContent: `P${g.priority}`, title: `Priority ${g.priority}` }) : null,
      g.area ? h("span", { className: "g-area", textContent: g.area }) : null),
    h("span", { className: "g-title", textContent: g.title }),
    boardView === "kanban" && parent ? h("span", { className: "g-parent", textContent: `↑ ${parent.title}` }) : null,
    focusGoal === g.id && g.why ? h("span", { className: "g-why", textContent: g.why }) : null,
    h("span", { className: "g-bar", title: kids ? `${g.childDone} of ${kids} done` : "" }, Object.assign(h("i"), { style: `width:${g.progress ?? 0}%` })),
    h("span", { className: "g-meta" },
      h("span", { className: "g-state" }, h("i"), g.status || "New"),
      h("span", { className: late ? "late" : "", textContent: [
        kids ? `${g.childDone}/${kids}` : `${g.progress ?? 0}%`,
        g.effortTotal ? `${g.effortTotal} pts` : null,
        g.due ? `${late ? "was due" : "due"} ${fmtDay(g.due, { day: "numeric", month: "short" })}` : null,
      ].filter(Boolean).join(" · ") })),
    g.level === "Epic" ? (() => { const v = epicValue(g); return h("span", { className: "g-value", textContent: `${dollars(v.earned)} of ${dollars(v.target)}` }); })() : null,
    focusGoal === g.id ? h("span", { className: "g-actions" },
      actButton("edit", "Edit"),
      childLevel ? actButton("plan", `Plan ${childLevel.plural}`) : null,
      g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null) : null,
    st === "done" ? h("span", { className: "g-stamp", textContent: "Done" }) : null,
    actButton("delete", "×"));
  el.querySelector('[data-act="delete"]').className = "g-del";
  el.querySelector('[data-act="delete"]').title = "Delete";
  el.querySelector('[data-act="delete"]').ariaLabel = `Delete ${g.title}`;
  el.dataset.id = g.id;
  el.style.setProperty("--r", CARD_TILTS[i % CARD_TILTS.length]);
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "edit") return openGoal(g);
    if (act === "delete") return confirmDelete(g);
    if (act === "plan") return openPlan(g);
    if (e.target.closest("a")) return;
    focusGoal = focusGoal === g.id ? null : g.id;
    renderBoard();
  });
  el.addEventListener("dblclick", () => openGoal(g));
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) openGoal(g); });
  if (boardView === "kanban") {
    el.draggable = true;
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", g.id); e.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
  }
  return el;
}

// Deleting asks first, then moves the goal to Notion's trash (restorable there).
export let confirmAction = null;
export function confirmDelete(g) {
  const kids = state.goals.goals.filter((c) => c.parent === g.id).length;
  $("confirm-title").textContent = `Delete “${g.title}”?`;
  $("confirm-note").textContent = `${state.goals.live ? "It moves to Notion's trash, where you can restore it for 30 days." : "Sample goals: this only removes it from this page."}${kids ? ` Its ${kids} ${LEVELS[levelIndex(g.level) + 1]?.plural || "children"} stay, but lose their link to it.` : ""}`;
  confirmAction = async () => {
    try {
      const res = await api(`/api/goals/${g.id}/delete`, {});
      if (res.live) state.goals = await api("/api/goals");
      else { state.goals.goals = state.goals.goals.filter((x) => x.id !== g.id).map((x) => (x.parent === g.id ? { ...x, parent: null } : x)); recalcSample(); }
      if (focusGoal === g.id) focusGoal = null;
      toast(res.live ? "Moved to Notion's trash" : "Removed (sample goals)");
      renderBoard();
    } catch (err) { toast(err.message, true); }
  };
  $("confirm-dialog").showModal();
}
$("confirm-no").addEventListener("click", () => { confirmAction = null; $("confirm-dialog").close(); });
$("confirm-yes").addEventListener("click", () => { const run = confirmAction; confirmAction = null; $("confirm-dialog").close(); run?.(); });

// Red string, pin to pin, between a picked goal and its parents and children.
export function drawThreads() {
  const svg = $("threads");
  svg.replaceChildren();
  if (!focusGoal || !onBoard) return;
  const ids = lineage(focusGoal);
  const box = $("cork").getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const pin = (id) => {
    const card = $("cork-cols").querySelector(`.goal-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return null;
    const r = card.getBoundingClientRect(), list = card.closest(".pin-list").getBoundingClientRect();
    if (r.bottom < list.top || r.top > list.bottom) return null; // scrolled out of view
    return { x: r.left + r.width / 2 - box.left, y: r.top - box.top + 2 };
  };
  const NS = "http://www.w3.org/2000/svg";
  for (const id of ids) {
    const g = goalById(id);
    if (!g?.parent || !ids.has(g.parent)) continue;
    const a = pin(g.parent), b = pin(id);
    if (!a || !b) continue;
    const sag = Math.min(60, Math.abs(b.x - a.x) * 0.18 + 14);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.max(a.y, b.y) + sag} ${b.x},${b.y}`);
    svg.append(path);
  }
}
window.addEventListener("resize", () => { if (onBoard) { drawThreads(); if (boardView === "spider") layoutSpider(); } });

// Kanban: drop a card on a column to change its state. Saves straight away, with Undo.
export function dropZone(col, status) {
  col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
  col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("over"); });
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    col.classList.remove("over");
    const g = goalById(e.dataTransfer.getData("text/plain"));
    if (g && (g.status || "New") !== status) moveGoal(g, status);
  });
}

export async function moveGoal(g, status, undoing = false) {
  const before = g.status || "New";
  // the Completed date feeds the weekly review: set on Done, cleared if it moves back
  const completed = status === "Done" ? todayStr() : before === "Done" ? "" : undefined;
  g.status = status;
  renderBoard();
  try {
    const res = await api(`/api/goals/${g.id}`, { values: { status, completed } });
    if (res.live) state.goals = await api("/api/goals");
    else { if (completed !== undefined) g.completed = completed || null; recalcSample(); }
    renderBoard();
    if (status === "Done" && !undoing) askFelt(goalById(g.id) || g);
    const active = state.goals.goals.filter((x) => x.level === g.level && x.status === "Active").length;
    const wip = status === "Active" && active > WIP_LIMIT ? ` That's ${active} active, over your limit of ${WIP_LIMIT}.` : "";
    const earned = status === "Done" ? coinText(g) : "";
    if (!undoing) toast(`“${g.title}” moved to ${status}${res.live ? "" : " (sample, not saved to Notion)"}.${earned}${wip}`, Boolean(wip), { label: "Undo", run: () => moveGoal(goalById(g.id) || g, before, true) });
  } catch (err) {
    g.status = before;
    renderBoard();
    toast(err.message, true);
  }
}

// Sample goals: roll progress up locally, the way the server does for real ones.
export function recalcSample() {
  rollUp(state.goals.goals);
}

document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  boardView = b.dataset.view;
  store("goals-view", boardView);
  // a goal picked on the board opens the Tree at that goal
  if (boardView === "spider" && focusGoal) setSpiderRoot(LEVELS[levelIndex(goalById(focusGoal)?.level) + 1] ? focusGoal : goalById(focusGoal)?.parent || focusGoal);
  renderBoard();
}));
document.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
  boardLevel = b.dataset.level;
  store("goals-level", boardLevel);
  renderBoard();
}));
$("cork").addEventListener("click", (e) => {
  if (focusGoal && boardView !== "spider" && boardView !== "timeline" && !e.target.closest(".goal-card")) { focusGoal = null; renderBoard(); }
});

// ---- picking the goal for the Tree and Timeline views ----
export const kidsOf = (id) => state.goals.goals.filter((c) => c.parent === id).sort(treeOrder(state.goals.goals));
// Top-level goals worth looking at: Epics, and anything stand-alone that has goals under it
export function rootChoices() {
  const goals = state.goals.goals;
  return goals.filter((g) => (!g.parent || !goalById(g.parent)) && (g.level === "Epic" || g.children?.length)).sort(treeOrder(goals));
}
export function setSpiderRoot(id) {
  spiderRoot = id || null;
  store("goals-root", spiderRoot || "");
}
export function fillRootPicker() {
  const sel = $("goal-root");
  sel.hidden = boardView !== "spider" && boardView !== "timeline";
  if (sel.hidden) return;
  const roots = rootChoices();
  const opts = roots.map((g) => h("option", { value: g.id, textContent: `${g.level === "Epic" ? "" : `${g.level}: `}${g.title}` }));
  if (boardView === "timeline") {
    sel.replaceChildren(h("option", { value: "", textContent: "All goals" }), ...opts);
    if (tlRoot && !goalById(tlRoot)) tlRoot = "";
    sel.value = tlRoot;
  } else {
    // the Tree shows the Epic a drilled-in goal belongs to
    if (!goalById(spiderRoot)) setSpiderRoot(roots[0]?.id);
    let top = goalById(spiderRoot);
    for (const seen = new Set(); top?.parent && goalById(top.parent) && !seen.has(top.id); top = goalById(top.parent)) seen.add(top.id);
    sel.replaceChildren(...(opts.length ? opts : [h("option", { value: "", textContent: "No Epics yet" })]));
    sel.value = top?.id || "";
  }
}
$("goal-root").addEventListener("change", (e) => {
  if (boardView === "timeline") { tlRoot = e.target.value; store("goals-tl-root", tlRoot); }
  else setSpiderRoot(e.target.value);
  renderBoard();
});
// Timeline: which levels get a row (at least one stays on)
export function tlLevelPicker() {
  return h("div", { className: "tl-filter" }, h("span", { className: "cp-label", textContent: "Show" }),
    h("div", { className: "seg", ariaLabel: "Levels on the timeline" }, LEVELS.map((l) => {
      const b = h("button", { type: "button", textContent: l.plural });
      b.setAttribute("aria-pressed", String(tlLevels.has(l.name)));
      b.addEventListener("click", () => {
        if (tlLevels.has(l.name)) { if (tlLevels.size > 1) tlLevels.delete(l.name); } else tlLevels.add(l.name);
        store("goals-tl-levels", [...tlLevels].join(","));
        renderBoard();
      });
      return b;
    })));
}


// ---- + New: a stand-alone goal at any level (to build out under a goal, pick it and press Plan) ----
export function toggleNewMenu(open) {
  const menu = $("new-menu");
  open ??= menu.hidden;
  menu.hidden = !open;
  $("goal-add").setAttribute("aria-expanded", String(open));
  if (open) menu.querySelector("button")?.focus();
}
$("new-menu").replaceChildren(...LEVELS.map((l) => {
  const b = h("button", { type: "button", role: "menuitem" }, h("b", { textContent: `+ ${l.name}` }), h("span", { textContent: l.when }));
  b.addEventListener("click", () => { toggleNewMenu(false); openGoal(null, { level: l.name }); });
  return b;
}));
document.addEventListener("click", (e) => { if (!$("new-menu").hidden && !e.target.closest(".add-wrap")) toggleNewMenu(false); });
$("new-menu").addEventListener("keydown", (e) => {
  if (e.key === "Escape") { toggleNewMenu(false); $("goal-add").focus(); }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const items = [...$("new-menu").querySelectorAll("button")], i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
  }
});
