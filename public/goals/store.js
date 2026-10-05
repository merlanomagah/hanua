// The one way the page reads and writes goals. A change shows straight away; the server sends back the row
// Notion saved and that replaces it, then progress rolls up again here. Nothing re-reads the whole database.
// Sample goals (no Notion key) go through the same path: the server says "not live" and the change stays on the page.
import { rollUp } from "../shared/goals.js";
import { api, state } from "../lib.js";

const goals = () => state.goals.goals;
const settle = () => rollUp(goals());
const TEXT = new Set(["title", "why", "doneWhen", "description"]);
const asNumber = (v) => (v === "" || v == null ? null : Number(v));

// Form values (strings) -> the fields a goal has on the page.
function asGoal(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === "progress") out.progressSet = asNumber(v);
    else if (k === "priority" || k === "effort") out[k] = asNumber(v);
    else out[k] = TEXT.has(k) ? v ?? "" : v === "" || v === undefined ? null : v;
  }
  return out;
}
let localId = 0;
const localGoal = (values) => ({ id: `local-${Date.now()}-${localId++}`, url: null, level: "Task", status: "New", parent: null, area: null,
  why: "", doneWhen: "", description: "", priority: null, effort: null, start: null, due: null, completed: null, felt: null, progressSet: null, ...asGoal(values) });

// Changes a goal. It shows at once (the caller can render straight after calling), and is put back if Notion refuses.
export async function updateGoal(g, values) {
  const change = asGoal(values);
  const before = Object.fromEntries(Object.keys(change).map((k) => [k, g[k]]));
  Object.assign(g, change);
  settle();
  try {
    const res = await api(`/api/goals/${g.id}`, { values });
    if (res.goal) { Object.assign(g, res.goal); settle(); }
    return res;
  } catch (err) {
    Object.assign(g, before);
    settle();
    throw err;
  }
}

export async function createGoal(values) {
  const res = await api("/api/goals", { values });
  const g = res.goal || localGoal(values);
  goals().push(g);
  settle();
  return { goal: g, live: res.live };
}

// Several at once (Plan). Returns what was added and what Notion refused, row by row.
export async function createGoals(list) {
  const res = await api("/api/goals/batch", { items: list });
  const created = [], failed = [];
  list.forEach((values, i) => {
    const r = res.results?.[i];
    if (!r?.ok) return failed.push({ values, error: r?.error || "Not saved" });
    const g = r.goal || localGoal(values);
    goals().push(g);
    created.push(g);
  });
  settle();
  return { created, failed, live: res.live };
}

// Moves a goal to Notion's trash. Its children stay, unlinked.
export async function removeGoal(g) {
  const res = await api(`/api/goals/${g.id}/delete`, {});
  state.goals.goals = goals().filter((x) => x.id !== g.id);
  for (const x of goals()) if (x.parent === g.id) x.parent = null;
  settle();
  return res;
}

// Everything again, straight from Notion (the Refresh button, and edits made in Notion itself).
export async function refreshGoals(fresh = true) {
  state.goals = await api(`/api/goals${fresh ? "?fresh=1" : ""}`);
  return state.goals;
}

// The Status and Area choices: from the Notion database when it's connected, otherwise the defaults.
export const statusOptions = (fallback) => state.goals.options?.status?.length ? state.goals.options.status : fallback;
export const alsoInOptions = (fallback) => state.goals.options?.alsoIn?.length ? state.goals.options.alsoIn : fallback;
export const areaOptions = (fallback) => state.goals.options?.area?.length ? state.goals.options.area : fallback;
