// ---- Backlog: every goal in one list, each indented under the goal it belongs to (like an ADO backlog) ----
// ▸ opens and closes a goal; + / − open or close a whole level at a time. Hover a row and press + to add
// the level below right there: type, Enter adds it (and opens the next row), Tab moves the new row a level
// down under the one above, Shift+Tab a level up, Esc stops. Nothing is saved until Enter.
import { dayOf, todayStr } from "../shared/dates.js";
import { LEVELS, levelIndex, treeOrder } from "../shared/goals.js";
import { $, fmtDay, focus, h, state, store, toast } from "../lib.js";
import { createGoal, removeGoal } from "./store.js";
import { STATE_CLASS, confirmDelete, conflictNote, flashGoals, goalById, isFresh, renderBoard, shown } from "./board.js";
import { openGoal } from "./form.js";
import { openPlan } from "./plan.js";
import { openQuick } from "./quick.js";
import { levelIcon } from "./icons.js";

// Which goals are closed, on this Mac only (a view preference, not data)
let closed = new Set((store("goals-closed") || "").split(",").filter(Boolean));
const saveClosed = () => store("goals-closed", [...closed].join(","));

// The row being typed: { parent, level, text }. null when nobody's adding.
let adding = null;
let saving = false;

const childLevel = (level) => LEVELS[levelIndex(level) + 1];
const short = (iso) => fmtDay(iso, { day: "numeric", month: "short" });

export function renderBacklog() {
  const list = shown();
  const ids = new Set(list.map((g) => g.id));
  const order = treeOrder(state.goals.goals);
  const kids = new Map();
  for (const g of list) {
    const p = ids.has(g.parent) ? g.parent : "";
    kids.set(p, [...(kids.get(p) || []), g]);
  }
  for (const k of kids.values()) k.sort(order);
  // the chain above the row being added stays lit, so the Epic is always in sight
  const trail = new Set();
  for (let p = goalById(adding?.parent), seen = new Set(); p && !seen.has(p.id); p = goalById(p.parent)) { seen.add(p.id); trail.add(p.id); }

  const rows = (parent, depth) => {
    const out = [];
    for (const g of kids.get(parent) || []) {
      const mine = kids.get(g.id) || [];
      out.push(row(g, depth, mine.length, trail.has(g.id)));
      if ((mine.length || adding?.parent === g.id) && !closed.has(g.id)) out.push(...rows(g.id, depth + 1));
    }
    if (adding && (adding.parent || "") === parent) out.push(addRow(depth));
    return out;
  };
  // each top-level goal is its own group, so its row can stay pinned at the top while you scroll through it
  const groups = (kids.get("") || []).map((g) => {
    const mine = kids.get(g.id) || [];
    return h("div", { className: "bl-group" }, row(g, 0, mine.length, trail.has(g.id)),
      (mine.length || adding?.parent === g.id) && !closed.has(g.id) ? rows(g.id, 1) : null);
  });
  if (adding && !adding.parent) groups.push(h("div", { className: "bl-group" }, addRow(0)));

  const box = h("div", { className: "bl-wrap" },
    h("div", { className: "bl-tools" },
      h("div", { className: "seg", ariaLabel: "Open or close a level" },
        tool("+", "Open one more level", () => stepLevels(1, list, kids)),
        tool("−", "Close one level", () => stepLevels(-1, list, kids))),
      h("span", { className: "bl-tip", textContent: "Hover a goal and press + to add under it · Enter adds · Tab goes a level down" }),
      tool("+ Epic", "Add an Epic at the bottom of the list", () => startAdding(null, "Epic"), "b-btn ghost bl-new")),
    h("div", { className: "bl", role: "treegrid", ariaLabel: "Goals backlog" },
      h("div", { className: "bl-head", role: "row" },
        h("span", { role: "columnheader", textContent: "Title" }),
        h("span", { role: "columnheader", textContent: "State" }),
        h("span", { role: "columnheader", className: "bl-size", textContent: "Size" }),
        h("span", { role: "columnheader", textContent: "When" })),
      groups.length ? groups : h("p", { className: "bl-empty", textContent: "No goals yet. Start with an Epic: a big goal for the year." })));
  return box;
}

function tool(label, title, run, className = "") {
  const b = h("button", { type: "button", className, textContent: label, title, ariaLabel: title });
  b.addEventListener("click", run);
  return b;
}

// + opens every goal at the shallowest closed depth; − closes every open goal at the deepest open depth
function stepLevels(dir, list, kids) {
  const depthOf = (g) => { let n = 0; for (let p = goalById(g.parent), seen = new Set(); p && list.includes(p) && !seen.has(p.id); p = goalById(p.parent)) { seen.add(p.id); n++; } return n; };
  const parents = list.filter((g) => kids.get(g.id)?.length).map((g) => ({ g, d: depthOf(g) }));
  const visible = (g) => { for (let p = goalById(g.parent); p && list.includes(p); p = goalById(p.parent)) if (closed.has(p.id)) return false; return true; };
  if (dir > 0) {
    const shut = parents.filter(({ g }) => closed.has(g.id) && visible(g));
    const d = Math.min(...shut.map((x) => x.d));
    shut.filter((x) => x.d === d).forEach(({ g }) => closed.delete(g.id));
  } else {
    const open = parents.filter(({ g }) => !closed.has(g.id) && visible(g));
    const d = Math.max(...open.map((x) => x.d));
    open.filter((x) => x.d === d).forEach(({ g }) => closed.add(g.id));
  }
  saveClosed();
  renderBoard();
}

function row(g, depth, kidCount, lit) {
  const lvl = (g.level || "Task").toLowerCase();
  const st = STATE_CLASS[(g.status || "new").toLowerCase()] || "new";
  const late = g.due && st !== "done" && dayOf(g.due) < todayStr();
  const below = childLevel(g.level);
  // a Task's + adds another Task beside it; anything else adds the level below
  const addTo = below ? { parent: g.id, level: below.name } : { parent: g.parent && goalById(g.parent) ? g.parent : null, level: g.level || "Task" };
  const warn = conflictNote(g);
  const isOpen = !closed.has(g.id);
  const el = h("div", {
    className: `bl-row lvl-${lvl} ${st}${lit ? " trail" : ""}${isFresh(g.id) ? " fresh" : ""}${depth === 0 ? " top" : ""}`,
    role: "row", tabIndex: -1, style: `--depth:${depth}`,
  },
    h("span", { className: "bl-title", role: "gridcell" },
      tool("+", `Add a ${addTo.level} ${addTo.parent ? `under “${goalById(addTo.parent)?.title}”` : ""}`.trim(), () => startAdding(addTo.parent, addTo.level), "bl-add"),
      kidCount ? (() => {
        const b = tool(isOpen ? "▾" : "▸", `${isOpen ? "Close" : "Open"} ${g.title}`, () => { isOpen ? closed.add(g.id) : closed.delete(g.id); saveClosed(); renderBoard(); }, "bl-twist");
        b.setAttribute("aria-expanded", String(isOpen));
        return b;
      })() : h("span", { className: "bl-twist none" }),
      h("span", { className: "bl-type", title: g.level || "Task" }, levelIcon(g.level)),
      (() => { const b = tool(g.title, `Open “${g.title}”`, () => openGoal(g), "bl-name"); b.textContent = g.title; return b; })(),
      kidCount ? h("span", { className: "bl-count", textContent: `${g.childDone}/${kidCount}` }) : null),
    h("span", { role: "gridcell" }, (() => {
      const b = h("button", { type: "button", className: "g-state", title: "Change state or due date", ariaLabel: `${g.status || "New"}: change state or due date` }, h("i"), g.status || "New");
      b.addEventListener("click", () => openQuick(g, b));
      return b;
    })()),
    h("span", { role: "gridcell", className: "bl-size", textContent: g.effortTotal ? `${g.effortTotal}` : (g.level === "Task" || g.level === "PBI") && !kidCount ? "·" : "", title: g.effortTotal ? `${g.effortTotal} points` : "Not sized yet" }),
    h("span", { role: "gridcell", className: `bl-when${late ? " late" : ""}`, title: g.due ? `Due ${fmtDay(g.due)}` : "No date: fits inside its parent" },
      g.due ? `${late ? "was " : ""}${short(g.due)}` : "—",
      warn ? h("span", { className: "g-warn", title: warn, ariaLabel: warn, textContent: " ⚠" }) : null),
    h("span", { role: "gridcell", className: "bl-acts" },
      below ? tool(`Plan ✦`, `Plan several ${below.plural} for “${g.title}”, with ideas from Claude`, () => openPlan(g), "g-act") : null,
      g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "↗", title: "Open in Notion", ariaLabel: `Open “${g.title}” in Notion` }) : null,
      tool("×", `Delete “${g.title}”`, () => confirmDelete(g), "g-act bl-del")));
  el.dataset.id = g.id;
  // ⌘↓ opens the goal and goes to its first child; ⌘↑ goes to its parent (like Finder; 10 Oct 2026).
  // Rows can't take focus themselves, so this hears the keys from the buttons inside them.
  el.addEventListener("keydown", (e) => {
    if (!e.metaKey || e.altKey || e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.target.closest("input, textarea, select")) return;
    e.preventDefault();
    const nameOf = (id) => document.querySelector(`.bl-row[data-id="${CSS.escape(id)}"] .bl-name`);
    if (e.key === "ArrowUp") {
      const p = goalById(g.parent);
      return p && nameOf(p.id) ? nameOf(p.id).focus() : toast("It's at the top of its chain");
    }
    if (!kidCount) return toast("Nothing planned under it yet");
    if (closed.has(g.id)) { closed.delete(g.id); saveClosed(); renderBoard(); }
    const first = [...document.querySelectorAll(".bl-row")].find((r) => goalById(r.dataset.id)?.parent === g.id);
    first?.querySelector(".bl-name")?.focus();
  });
  return el;
}

function addRow(depth) {
  const p = goalById(adding.parent);
  const input = h("input", {
    className: "bl-input", value: adding.text, autocomplete: "off",
    placeholder: p ? `New ${adding.level} for “${p.title}”` : `New ${adding.level}`,
    ariaLabel: `New ${adding.level}${p ? ` under ${p.title}` : ""}. Enter adds it, Tab goes a level down, Shift Tab a level up, Escape stops`,
  });
  input.addEventListener("input", () => { adding.text = input.value; });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stopAdding(); }
    else if (e.key === "Enter") { e.preventDefault(); input.value.trim() ? saveAdd() : stopAdding(); }
    else if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? addUp() : addDown(); }
  });
  input.addEventListener("blur", () => setTimeout(() => {
    if (adding && !adding.text.trim() && !saving && !document.activeElement?.closest(".bl-adding")) stopAdding();
  }, 150));
  return h("div", { className: `bl-row bl-adding lvl-${adding.level.toLowerCase()}`, role: "row", style: `--depth:${depth}` },
    h("span", { className: "bl-title", role: "gridcell" }, h("span", { className: "bl-add-gap" }), h("span", { className: "bl-twist none" }),
      h("span", { className: "bl-type", title: adding.level }, levelIcon(adding.level)), input),
    h("span", { className: "bl-keys", role: "gridcell", textContent: `Enter adds${childLevel(adding.level) ? " · Tab ↘" : ""}${p ? " · ⇧Tab ↖" : ""} · Esc` }));
}

export function startAdding(parent, level) {
  if (parent) { closed.delete(parent); saveClosed(); }
  adding = { parent: parent || null, level, text: adding?.text || "" };
  renderBoard();
  focusAdd();
}
function stopAdding() {
  adding = null;
  renderBoard();
}
function focusAdd() {
  const input = $("cork-cols").querySelector(".bl-input");
  if (!input) return;
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
  const list = input.closest(".bl"), r = input.getBoundingClientRect(), lr = list.getBoundingClientRect();
  if (r.bottom > lr.bottom - 10 || r.top < lr.top + 60) list.scrollTop += r.top - lr.top - lr.height / 2;
}

// Tab: the new row goes under the goal just above it at its level (the last one in this list), a level down
function addDown() {
  const below = childLevel(adding.level);
  if (!below) return;
  const sibs = shown().filter((g) => (g.parent || null) === adding.parent && g.level === adding.level).sort(treeOrder(state.goals.goals));
  const above = sibs[sibs.length - 1];
  if (!above) return toast(`Add a ${adding.level} first, then Tab to go under it.`);
  startAdding(above.id, below.name);
}
// Shift+Tab: back up a level, beside the goal it was under
function addUp() {
  const p = goalById(adding.parent);
  if (!p) return;
  startAdding(p.parent && goalById(p.parent) ? p.parent : null, p.level);
}

async function saveAdd() {
  const p = goalById(adding.parent);
  const values = { title: adding.text.trim(), level: adding.level, parent: adding.parent || "", status: "New",
    // a goal added at work is a work goal, so it stays on screen
    area: p?.area || (focus.on ? "Work" : "") };
  saving = true;
  adding.text = "";
  try {
    const { goal, live } = await createGoal(values);
    flashGoals([goal.id]);
    renderBoard();
    focusAdd();
    toast(`${values.level} added${live ? " to Notion ✓" : " (sample, not saved to Notion)"}`, false,
      { label: "Undo", run: async () => { await removeGoal(goal); renderBoard(); toast(live ? "Moved to Notion's trash" : "Removed"); } });
  } catch (err) {
    adding.text = values.title;
    renderBoard();
    focusAdd();
    toast(err.message, true);
  } finally {
    saving = false;
  }
}
