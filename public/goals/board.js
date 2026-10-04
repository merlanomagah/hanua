// ---------- goals pin board: swipe right to slide the wall aside (left is the kitchen) ----------
import { dayOf, daysBetween, todayStr, ymd } from "../shared/dates.js";
import { LEVELS, dateConflicts, isGoalDone, levelIndex, lineageIn, treeOrder, visibleGoals } from "../shared/goals.js";
import { GUIDE, WIP_LIMIT } from "../coach.js";
import { $, ago, fmtDay, focus, focusGoals, h, reducedMotion, state, store, toast } from "../lib.js";
import { refreshGoals, removeGoal, statusOptions, updateGoal } from "./store.js";
import { askFelt, openGoal } from "./form.js";
import { openPlan } from "./plan.js";
import { openQuick } from "./quick.js";
import { levelIcon } from "./icons.js";
import { reviewDue } from "./review.js";
import { renderTimeline, scrollTimelineToToday } from "./timeline.js";
import { renderBacklog } from "./backlog.js";
import { coinText, dollars, epicValue, renderTopShelf } from "../shelf.js";
import { renderCalendar } from "../app.js";
import { renderTodo } from "../planner.js";

// Status and Area options come from the Goals database in Notion (sent with /api/goals); these are the fallbacks.
export const GOAL_STATUS = ["New", "Active", "At risk", "Done"];
export const GOAL_AREAS = ["Work", "Health", "Learning", "People", "Money", "Personal"];
export const STATE_CLASS = { new: "new", active: "active", "at risk": "risk", done: "done" };
export const CARD_TILTS = ["-1.2deg", "0.9deg", "-0.5deg", "1.5deg", "-1.6deg", "0.6deg"];

export let onBoard = false;
export function showBoard(on) {
  if (on === onBoard) return;
  // the kitchen (on the wall's other side) steps out of the way first
  if (on) document.dispatchEvent(new Event("hanua:board"));
  onBoard = on;
  if (on) { noteView(boardView); renderBoard(); }
  $("wall").classList.toggle("on-board", on);
  if (!on) $("wall").style.minHeight = "";
  $("board-pane").inert = !on;
  $("wall-in").inert = on;
  // the wall sits right under the top shelf, so the top of the page shows it (or the board) in full
  if (window.scrollY > 40) window.scrollTo({ top: 0, behavior: reducedMotion || window.scrollY > 1200 ? "auto" : "smooth" });
  (on ? $("goal-add") : $("to-board")).focus({ preventScroll: true });
}
$("to-board").addEventListener("click", () => showBoard(true));
$("to-wall").addEventListener("click", () => showBoard(false));

// Swiping between the board, the wall and the kitchen lives in public/kitchen.js (one pane at a time).

// ---- board state ----
// Views: "backlog" (every goal in one indented list), "kanban" the Board, "timeline" the Timeline.
// Hierarchy columns and the Tree diagram were cut on 5 Oct 2026; a view saved as either opens the Backlog.
export const BOARD_VIEWS = ["backlog", "kanban", "timeline"];
export let boardView = BOARD_VIEWS.includes(store("goals-view")) ? store("goals-view") : "backlog";
export let boardLevel = LEVELS.some((l) => l.name === store("goals-level")) ? store("goals-level") : "Task";
export let focusGoal = null;
export const setFocusGoal = (id) => { focusGoal = id; };
// Goals just added glow for a moment and scroll into view in their column (rather than dimming everything else)
let fresh = new Set();
export function flashGoals(ids) {
  fresh = new Set(ids);
  setTimeout(() => { fresh = new Set(); document.querySelectorAll(".fresh").forEach((el) => el.classList.remove("fresh")); }, 2600);
}
export const isFresh = (id) => fresh.has(id);
function revealFresh() {
  const card = [...$("cork-cols").querySelectorAll(".fresh")][0];
  const list = card?.closest(".pin-list, .bl, .tl");
  if (!card || !list) return;
  const off = card.getBoundingClientRect().top - list.getBoundingClientRect().top;
  if (off < 0 || off > list.clientHeight - 60) list.scrollTop += off - 16;
}
export let tlRoot = store("goals-tl-root") || ""; // "" = every goal on the Timeline
export let tlLevels = new Set((store("goals-tl-levels") || LEVELS.map((l) => l.name).join(",")).split(",").filter((n) => LEVELS.some((l) => l.name === n)));
if (!tlLevels.size) tlLevels = new Set(LEVELS.map((l) => l.name));
export let showDone = store("goals-show-done") === "1";
export const TL_ZOOMS = { fit: "Fit", week: "Weeks", month: "Months", quarter: "Quarter" };
export let tlZoom = TL_ZOOMS[store("goals-tl-zoom")] ? store("goals-tl-zoom") : "fit";
export const goalById = (id) => state.goals.goals.find((g) => g.id === id);
// A goal the current view may show (all of them, unless Focus is on)
export const inView = (id) => focusGoals(state.goals.goals).some((g) => g.id === id);
// What the views show: finished goals stay two weeks, then hide unless Show done is on
export const shown = () => visibleGoals(focusGoals(state.goals.goals), { showDone, today: todayStr() });
export const isShown = (g) => showDone || !isGoalDone(g) || shown().includes(g);
// Dates that can't work inside the parent's, worked out once per render
let conflicts = new Map();
export function conflictNote(g) {
  return (conflicts.get(g.id) || []).map(({ kind, parent }) => kind === "late"
    ? `Due after its ${parent.level} (${fmtDay(parent.due, { day: "numeric", month: "short" })})`
    : `Starts before its ${parent.level} (${fmtDay(parent.start, { day: "numeric", month: "short" })})`).join(". ");
}

// Which views get opened, per week, on this Mac only: the evidence for keeping or cutting Hierarchy.
export function noteView(view) {
  try {
    const d = new Date(), week = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
    const use = JSON.parse(store("goals-view-use") || "{}");
    use[week] = { ...use[week], [view]: (use[week]?.[view] || 0) + 1 };
    for (const k of Object.keys(use).sort().slice(0, -8)) delete use[k]; // keep eight weeks
    store("goals-view-use", JSON.stringify(use));
  } catch { /* storage blocked: nothing to count */ }
}
export function viewUse(weekStart) {
  try { return JSON.parse(store("goals-view-use") || "{}")[weekStart] || {}; } catch { return {}; }
}

// A goal plus everything above and below it: the thread shown when you pick a card.
export const lineage = (id) => lineageIn(state.goals.goals, id);

export function renderBoard() {
  const { live, notionUrl, error, fetchedAt } = state.goals;
  const all = focusGoals(state.goals.goals), goals = shown();
  conflicts = dateConflicts(all);
  const open = all.filter((g) => !isGoalDone(g));
  const count = (st) => all.filter((g) => (g.status || "").toLowerCase() === st).length;
  const soon = open.filter((g) => g.due && daysBetween(todayStr(), g.due) >= 0 && daysBetween(todayStr(), g.due) <= 7).length;
  const hidden = all.length - goals.length;
  $("board-sub").textContent = error
    ? `Couldn't reach Notion: ${error}`
    : `${open.length} open · ${count("active")} active · ${count("at risk")} at risk · ${count("done")} done · ${soon} due this week${live ? (fetchedAt ? ` · updated ${ago(new Date(fetchedAt).toISOString())}` : "") : " · sample goals"}`;
  $("goals-show-done").setAttribute("aria-checked", String(showDone));
  $("done-hidden").textContent = showDone ? "showing all" : hidden ? `${hidden} hidden` : "none hidden";
  $("goals-notion").hidden = !notionUrl;
  if (notionUrl) $("goals-notion").href = notionUrl;
  $("goals-guide").hidden = !state.goals.guideUrl;
  if (state.goals.guideUrl) $("goals-guide").href = state.goals.guideUrl;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === boardView)));
  document.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.level === boardLevel)));
  $("level-seg").hidden = boardView !== "kanban";
  fillRootPicker();
  // the review sits in the toolbar only when it's due; it's always in the ⋯ menu
  // the review covers every goal, so it stays out of sight at work
  const due = reviewDue() && !focus.on;
  $("review-open").hidden = !due;
  $("review-open").classList.toggle("due", due);
  $("review-open").title = "Your weekly review is due";
  $("board-more").classList.toggle("due", due);
  $("review-menu").hidden = focus.on;
  $("review-when").textContent = reviewDue() ? "due now" : `last ${fmtDay(state.reviews.reviews[0]?.date, { day: "numeric", month: "short" })}`;
  $("goal-add").textContent = boardView === "kanban" ? `+ New ${boardLevel}` : "+ New ▾";
  $("goal-add").setAttribute("aria-haspopup", boardView === "kanban" ? "false" : "menu");
  $("cork").classList.toggle("kanban", boardView === "kanban");
  $("cork").classList.toggle("view-backlog", boardView === "backlog");
  $("cork").classList.toggle("view-timeline", boardView === "timeline");
  if (focusGoal && !goalById(focusGoal)) focusGoal = null;
  const thread = focusGoal ? lineage(focusGoal) : null;
  let n = 0;
  const cols = boardView === "backlog" ? [renderBacklog()]
    : boardView === "timeline" ? [renderTimeline()]
    : statusOptions(GOAL_STATUS).map((st) => {
        const list = goals.filter((g) => g.level === boardLevel && (g.status || "New") === st).sort(treeOrder(all));
        // Personal Kanban: cap what's in progress, so things get finished
        const over = st === "Active" && list.length > WIP_LIMIT;
        const col = h("section", { className: `pin-col state-${STATE_CLASS[st.toLowerCase()]}${over ? " over-limit" : ""}` },
          h("h3", { className: "pin-tag", title: st === "Active" ? `Work-in-progress limit: ${WIP_LIMIT}. Finish one before starting another.` : "" }, st,
            h("span", { className: "pin-count", textContent: st === "Active" ? `${list.length}/${WIP_LIMIT}` : list.length })),
          over ? h("p", { className: "wip-note", textContent: `Over your limit of ${WIP_LIMIT}. Finish or park one before starting more.` }) : null,
          h("div", { className: "pin-list" }, list.length ? list.map((g) => goalCard(g, n++, thread)) : h("p", { className: "pin-empty", textContent: "Drop a card here" })));
        dropZone(col, st);
        return col;
      });
  $("cork-cols").replaceChildren(...cols);
  if (boardView === "timeline") scrollTimelineToToday();
  renderTopShelf();
  renderCalendar();
  renderTodo();
  // the wall stretches to fit a long board (phones stack the columns)
  $("wall").style.minHeight = onBoard ? `${$("board-pane").offsetHeight}px` : "";
  revealFresh();
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
    className: `goal-card lvl-${lvl} ${st}${thread ? (thread.has(g.id) ? " lit" : " dim") : ""}${focusGoal === g.id ? " focus" : ""}${isFresh(g.id) ? " fresh" : ""}`,
    tabIndex: 0, ariaLabel: `${g.level || "Task"}: ${g.title}, ${g.status || "New"}`,
  },
    h("span", { className: "g-top" },
      h("span", { className: "g-type", title: g.level || "Task" }, levelIcon(g.level)),
      g.priority ? h("span", { className: `g-pri p${g.priority}`, textContent: `P${g.priority}`, title: `Priority ${g.priority}` }) : null,
      g.area ? h("span", { className: "g-area", textContent: g.area }) : null),
    h("span", { className: "g-title", textContent: g.title }),
    boardView === "kanban" && parent ? h("span", { className: "g-parent", textContent: `↑ ${parent.title}` }) : null,
    focusGoal === g.id && g.why ? h("span", { className: "g-why", textContent: g.why }) : null,
    h("span", { className: "g-bar", title: kids ? `${g.childDone} of ${kids} done` : "" }, Object.assign(h("i"), { style: `width:${g.progress ?? 0}%` })),
    h("span", { className: "g-meta" },
      (() => { const b = h("button", { type: "button", className: "g-state", title: "Change state or due date", ariaLabel: `${g.status || "New"}: change state or due date` }, h("i"), g.status || "New"); b.dataset.act = "quick"; return b; })(),
      h("span", { className: late ? "late" : "", textContent: [
        kids ? `${g.childDone}/${kids}` : `${g.progress ?? 0}%`,
        g.effortTotal ? `${g.effortTotal} pts` : null,
        g.due ? `${late ? "was due" : "due"} ${fmtDay(g.due, { day: "numeric", month: "short" })}` : null,
      ].filter(Boolean).join(" · ") }),
      conflictNote(g) ? h("span", { className: "g-warn", title: conflictNote(g), ariaLabel: conflictNote(g), textContent: "⚠" }) : null),
    g.level === "Epic" && !focus.on ? (() => { const v = epicValue(g); return h("span", { className: "g-value", textContent: `${dollars(v.earned)} of ${dollars(v.target)}` }); })() : null,
    // actions: always on the picked card; on the others they float in on hover (always shown on touch screens)
    h("span", { className: `g-actions${focusGoal === g.id ? "" : " float"}` },
      actButton("edit", "Edit"),
      childLevel ? actButton("plan", `Plan ${childLevel.plural}`) : null,
      g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null),
    st === "done" ? h("span", { className: "g-stamp", textContent: "Done" }) : null,
    actButton("delete", "×"));
  el.querySelector('[data-act="delete"]').className = "g-del";
  el.querySelector('[data-act="delete"]').title = "Delete";
  el.querySelector('[data-act="delete"]').ariaLabel = `Delete ${g.title}`;
  el.dataset.id = g.id;
  // pinned-up tilt in Hierarchy; Board cards hang straight so a working list scans faster
  el.style.setProperty("--r", boardView === "kanban" ? "0deg" : CARD_TILTS[i % CARD_TILTS.length]);
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "edit") return openGoal(g);
    if (act === "delete") return confirmDelete(g);
    if (act === "plan") return openPlan(g);
    if (act === "quick") return openQuick(g, e.target.closest("[data-act]"));
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
      const res = await removeGoal(g);
      if (focusGoal === g.id) focusGoal = null;
      toast(res.live ? "Moved to Notion's trash" : "Removed (sample goals)");
      renderBoard();
    } catch (err) { toast(err.message, true); }
  };
  $("confirm-dialog").showModal();
}
$("confirm-no").addEventListener("click", () => { confirmAction = null; $("confirm-dialog").close(); });
$("confirm-yes").addEventListener("click", () => { const run = confirmAction; confirmAction = null; $("confirm-dialog").close(); run?.(); });


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
  const values = completed === undefined ? { status } : { status, completed };
  try {
    const saving = updateGoal(g, values);
    renderBoard();
    const res = await saving;
    renderBoard();
    if (status === "Done" && !undoing) { askFelt(goalById(g.id) || g); window.dispatchEvent(new Event("hanua:done")); }
    const active = state.goals.goals.filter((x) => x.level === g.level && x.status === "Active").length;
    const wip = status === "Active" && active > WIP_LIMIT ? ` That's ${active} active, over your limit of ${WIP_LIMIT}.` : "";
    const earned = status === "Done" && !focus.on ? coinText(g) : ""; // coins are personal money: not at work
    if (!undoing) toast(`“${g.title}” moved to ${status}${res.live ? "" : " (sample, not saved to Notion)"}.${earned}${wip}`, Boolean(wip), { label: "Undo", run: () => moveGoal(goalById(g.id) || g, before, true) });
  } catch (err) {
    renderBoard();
    toast(err.message, true);
  }
}

document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  boardView = b.dataset.view;
  store("goals-view", boardView);
  noteView(boardView);
  renderBoard();
}));
// tabs: arrow keys move along and switch (the usual tab pattern)
document.querySelectorAll('[role="tablist"]').forEach((list) => list.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const tabs = [...list.querySelectorAll('[role="tab"]')], i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  next.click();
  next.focus();
}));
document.querySelectorAll("[data-level]").forEach((b) => b.prepend(levelIcon(b.dataset.level), " "));
document.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
  boardLevel = b.dataset.level;
  store("goals-level", boardLevel);
  renderBoard();
}));
$("cork").addEventListener("click", (e) => {
  if (focusGoal && boardView === "kanban" && !e.target.closest(".goal-card")) { focusGoal = null; renderBoard(); }
});

// ---- picking the goal for the Timeline ----
export const kidsOf = (id) => focusGoals(state.goals.goals).filter((c) => c.parent === id).sort(treeOrder(state.goals.goals));
// Top-level goals worth looking at: Epics, and anything stand-alone that has goals under it
export function rootChoices() {
  const goals = focusGoals(state.goals.goals);
  return goals.filter((g) => (!g.parent || !goalById(g.parent)) && (g.level === "Epic" || g.children?.length)).sort(treeOrder(goals));
}
export function fillRootPicker() {
  const sel = $("goal-root");
  sel.hidden = boardView !== "timeline";
  if (sel.hidden) return;
  sel.replaceChildren(h("option", { value: "", textContent: "All goals" }), ...rootChoices().map((g) => h("option", { value: g.id, textContent: `${g.level === "Epic" ? "" : `${g.level}: `}${g.title}` })));
  if (tlRoot && !inView(tlRoot)) tlRoot = "";
  sel.value = tlRoot;
}
$("goal-root").addEventListener("change", (e) => {
  tlRoot = e.target.value;
  store("goals-tl-root", tlRoot);
  renderBoard();
});
// Timeline: which levels get a row (at least one stays on), and how much time fits on screen
export function tlLevelPicker() {
  return h("div", { className: "tl-filter" },
    h("span", { className: "cp-label", textContent: "Zoom" }),
    h("div", { className: "seg", ariaLabel: "Timeline zoom" }, Object.entries(TL_ZOOMS).map(([k, label]) => {
      const b = h("button", { type: "button", textContent: label });
      b.setAttribute("aria-pressed", String(tlZoom === k));
      b.addEventListener("click", () => { tlZoom = k; store("goals-tl-zoom", k); renderBoard(); });
      return b;
    })),
    h("span", { className: "cp-label", textContent: "Show" }),
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
// The toolbar's two small menus (+ New and ⋯) open, close and move with the keyboard the same way.
const MENUS = { "new-menu": "goal-add", "more-menu": "board-more" };
function toggleMenu(id, open) {
  const menu = $(id);
  open ??= menu.hidden;
  for (const other of Object.keys(MENUS)) if (other !== id && open) { $(other).hidden = true; $(MENUS[other]).setAttribute("aria-expanded", "false"); }
  menu.hidden = !open;
  $(MENUS[id]).setAttribute("aria-expanded", String(open));
  // opens leftwards from its button; where that would leave the screen (phones), it opens rightwards instead
  menu.style.left = menu.style.right = "";
  if (open && menu.getBoundingClientRect().left < 8) { menu.style.left = "0"; menu.style.right = "auto"; }
  if (open) menu.querySelector("button, a:not([hidden])")?.focus();
}
export const toggleNewMenu = (open) => toggleMenu("new-menu", open);
$("new-menu").replaceChildren(...LEVELS.map((l) => {
  const b = h("button", { type: "button", role: "menuitem" }, h("b", {}, levelIcon(l.name), ` ${l.name}`), h("span", { textContent: l.when }));
  b.addEventListener("click", () => { toggleNewMenu(false); openGoal(null, { level: l.name }); });
  return b;
}));
document.addEventListener("click", (e) => {
  for (const id of Object.keys(MENUS)) if (!$(id).hidden && !e.target.closest(`#${id}, #${MENUS[id]}`)) toggleMenu(id, false);
});
for (const [id, btn] of Object.entries(MENUS)) {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); toggleMenu(id, false); $(btn).focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...$(id).querySelectorAll("button, a:not([hidden])")], i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    }
  });
}
$("board-more").addEventListener("click", () => toggleMenu("more-menu"));
$("more-menu").addEventListener("click", (e) => { if (e.target.closest("a")) toggleMenu("more-menu", false); });
$("goals-show-done").addEventListener("click", () => {
  showDone = !showDone;
  store("goals-show-done", showDone ? "1" : "0");
  renderBoard();
});
$("review-menu").addEventListener("click", () => { toggleMenu("more-menu", false); $("review-open").click(); });
// Refresh: everything again straight from Notion (for edits made in Notion itself)
$("goals-refresh").addEventListener("click", async () => {
  toggleMenu("more-menu", false);
  try {
    await refreshGoals();
    renderBoard();
    toast(state.goals.live ? "Up to date with Notion ✓" : "Sample goals reloaded");
  } catch (err) { toast(err.message, true); }
});
