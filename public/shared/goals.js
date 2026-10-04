// The goals logic the page and the server share: levels, roll-up, ordering, dates and coins.
// Plain functions over plain goal objects, so the server, the page and the tests all use the same rules.
import { addDays, dayOf } from "./dates.js";

// The levels work like an Azure DevOps backlog: each goal belongs to one a level up.
export const LEVELS = [
  { name: "Epic", when: "This year", plural: "Epics" },
  { name: "Feature", when: "This quarter", plural: "Features" },
  { name: "PBI", when: "This month", plural: "PBIs" },
  { name: "Task", when: "This week", plural: "Tasks" },
];
export const levelIndex = (name) => LEVELS.findIndex((l) => l.name === name);
export const isGoalDone = (g) => /^done/i.test(g?.status || "");

// Progress and effort roll up the tree: a parent's progress is the average of its children's.
// Sets children, childDone, progress and effortTotal on every goal (never stored in Notion).
export function rollUp(goals) {
  const kids = new Map();
  for (const g of goals) if (g.parent) kids.set(g.parent, [...(kids.get(g.parent) || []), g]);
  const seen = new Set();
  function walk(g) {
    if (seen.has(g.id)) return g; // guards against a loop of parents
    seen.add(g.id);
    const children = (kids.get(g.id) || []).map(walk);
    g.children = children.map((c) => c.id);
    g.childDone = children.filter(isGoalDone).length;
    g.progress = isGoalDone(g) ? 100
      : children.length ? Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length)
      : g.progressSet ?? 0;
    const childEffort = children.reduce((s, c) => s + (c.effortTotal || 0), 0);
    g.effortTotal = children.length && childEffort ? childEffort : g.effort ?? null;
    return g;
  }
  goals.forEach(walk);
  return goals;
}

// A sort that puts children in the same order as their parents, like a backlog tree.
export function treeOrder(goals) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const order = new Map();
  const byPriority = (a, b) => (a.priority ?? 9) - (b.priority ?? 9) || (a.due || "9").localeCompare(b.due || "9") || a.title.localeCompare(b.title);
  let n = 0;
  const visit = (g) => {
    if (order.has(g.id)) return;
    order.set(g.id, n++);
    goals.filter((c) => c.parent === g.id).sort(byPriority).forEach(visit);
  };
  goals.filter((g) => !g.parent || !byId.has(g.parent)).sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || byPriority(a, b)).forEach(visit);
  return (a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9);
}

// A goal plus everything above and below it.
export function lineageIn(goals, id) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const ids = new Set([id]);
  for (let g = byId.get(id); g?.parent && !ids.has(g.parent); g = byId.get(g.parent)) ids.add(g.parent);
  const down = (gid) => goals.filter((c) => c.parent === gid).forEach((c) => { if (!ids.has(c.id)) { ids.add(c.id); down(c.id); } });
  down(id);
  return ids;
}

// The lines of a goal's "done when", without their bullets.
export const donePoints = (g) => (g?.doneWhen || "").split("\n").map((l) => l.replace(/^[ \t]*[-•*][ \t]*/, "").trim()).filter(Boolean);

// A goal with only a due date gets an estimated start this many days before (and the reverse).
export const TL_SPAN = { Epic: 180, Feature: 60, PBI: 21, Task: 5 };
export function goalSpan(g) {
  let start = dayOf(g.start), end = dayOf(g.due), guessStart = false, guessEnd = false;
  const len = TL_SPAN[g.level] || TL_SPAN.Task;
  if (!start && end) { start = addDays(end, -len); guessStart = true; }
  if (start && !end) { end = addDays(start, len); guessEnd = true; }
  if (end < start) end = start;
  return { start, end, guessStart, guessEnd };
}

// Dates that can't work: a goal due after its parent, or starting before it. Only real dates count.
// Returns a Map of goal id -> [{ kind: "late" | "early", parent }].
export function dateConflicts(goals) {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const out = new Map();
  for (const g of goals) {
    const p = byId.get(g.parent);
    if (!p || isGoalDone(g)) continue;
    const found = [];
    if (g.due && p.due && dayOf(g.due) > dayOf(p.due)) found.push({ kind: "late", parent: p });
    if (g.start && p.start && dayOf(g.start) < dayOf(p.start)) found.push({ kind: "early", parent: p });
    if (found.length) out.set(g.id, found);
  }
  return out;
}

// Coins: by level, never by effort points (that would corrupt sizing). A PBI's Tasks together earn at most
// the PBI's own value, so splitting work into more Tasks doesn't earn more; the earliest finished are paid
// first, then the rest in due-date order. Stand-alone Tasks, and Tasks under anything else, earn their level's value.
export function coinValue(g, goals, perLevel = {}) {
  const base = perLevel[g.level] || 0;
  if (g.level !== "Task" || !perLevel.PBI) return base;
  const parent = goals.find((p) => p.id === g.parent);
  if (parent?.level !== "PBI") return base;
  const tasks = goals.filter((t) => t.parent === parent.id && t.level === "Task").sort((a, b) =>
    Number(isGoalDone(b)) - Number(isGoalDone(a)) || (a.completed || "9").localeCompare(b.completed || "9")
    || (a.due || "9").localeCompare(b.due || "9") || String(a.id).localeCompare(String(b.id)));
  let left = perLevel.PBI;
  for (const t of tasks) {
    const pay = Math.min(base, Math.max(0, left));
    if (t.id === g.id) return pay;
    left -= pay;
  }
  return base;
}
