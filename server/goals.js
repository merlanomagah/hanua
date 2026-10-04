// Goals <-> Notion rows. Kept apart from the routes so the mapping can be tested without a server or Notion.
import { toNotionProperties, clearedProperties } from "./notion.js";

// Form keys the board can write, and the config/areas.json "goals.fields" key each one lives under.
export const GOAL_FORM = ["title", "level", "status", "area", "due", "start", "why", "doneWhen", "description", "parent", "priority", "effort", "progress", "completed", "felt"];
const goalColumn = { title: "title", level: "level", status: "status", area: "area", due: "date", start: "start", why: "why", doneWhen: "doneWhen", description: "description", parent: "parent", priority: "priority", effort: "effort", progress: "amount", completed: "completed", felt: "felt" };

// A Notion row (as normalised by notion.js) -> a goal. Progress and children are worked out later (rollUp).
export function toGoal(r, f) {
  const v = r.fields || {};
  const first = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null);
  return {
    id: r.id, url: r.url, title: r.title, due: r.date, status: r.status,
    level: v[f.level] ?? null, area: v[f.area] ?? null, description: v[f.description] ?? "", why: v[f.why] ?? "", doneWhen: v[f.doneWhen] ?? "",
    parent: first(v[f.parent]), priority: v[f.priority] ?? null, effort: v[f.effort] ?? null, start: v[f.start] ?? null, completed: v[f.completed] ?? null, felt: v[f.felt] ?? null,
    progressSet: typeof r.amount === "number" ? Math.round(r.amount * 100) : null,
  };
}

// The board's form values -> Notion properties. Fields sent empty are cleared in Notion; fields not sent are left alone.
export function goalProperties(schema, values = {}, f) {
  const set = [], clear = [];
  for (const key of GOAL_FORM) {
    if (!(key in values)) continue;
    const column = f[goalColumn[key]];
    let value = values[key];
    if (key === "progress" && value !== "" && value != null) value = Math.min(100, Math.max(0, Number(value))) / 100;
    if (value === "" || value == null) clear.push(column);
    else set.push({ name: column, value: String(value).trim() });
  }
  return { ...clearedProperties(schema, clear.filter((c) => c !== f.title)), ...toNotionProperties(schema, set) };
}

// The Status and Area choices as set up in Notion, so the board's menus follow the database.
export function goalOptions(schema, f) {
  const opts = (key) => schema[f[key]]?.options || null;
  return { level: opts("level"), status: opts("status"), area: opts("area") };
}
