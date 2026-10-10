// The Jump Dashboard's data and its one way of writing (v2, 10 Oct 2026; brief docs/plans/2026-10-jump-dashboard-v2.md).
// Every change to Jump OS goes through here: it shows at once, goes to the server (which checks it with checkWrite and
// sends it to Notion), and offers Undo; if it's refused, the page goes back to what Notion has and says why.
// Hanua keeps nothing: what's here is the last read of Jump OS, in this page only.
import { applyTo } from "../shared/jump.js";
import { toast } from "../lib.js";

// Release B (moving cards on, closing, edits, answering) waits a day behind release A (the look, + Escalation):
// Mel's choice, 10 Oct 2026. Turning this on is the whole of release B on the page.
export const EDITS = true;

export let data = null;
let loading = null, pending = 0, redraw = () => {};
export const onChange = (fn) => { redraw = fn; };
const say = (live) => (live ? "" : " (sample: not saved to Notion)");

export async function load(fresh = false) {
  if (pending) return; // a change is still saving: the next read would show the old value
  if (loading) return loading;
  loading = (async () => {
    try {
      const res = await fetch(`/api/jump${fresh ? "?fresh=1" : ""}`);
      if (!res.ok) throw new Error(`Hanua couldn't read Jump OS (${res.status})`);
      data = await res.json();
    } catch (err) {
      data = { error: err.message };
    }
    redraw();
  })().finally(() => { loading = null; });
  return loading;
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Jump OS didn't take it (${res.status})`);
  return json;
}

// the row as the page has it, wherever it's shown
export function rowIn(area, id) {
  if (!data || data.error) return null;
  if (area === "escalations") return data.escalations?.columns?.flatMap((c) => c.items).find((r) => r.id === id) || null;
  return data[area]?.items?.find((r) => r.id === id) || null;
}
// a change shown at once (an escalation moves to its new column)
function showLocally(area, id, values) {
  const row = rowIn(area, id);
  if (!row) return;
  const next = applyTo(row, values);
  if (area === "escalations") {
    for (const c of data.escalations.columns) c.items = c.items.filter((r) => r.id !== id);
    const col = data.escalations.columns.find((c) => c.status === next.status) || data.escalations.columns.find((c) => c.other);
    col?.items.push(next);
  } else data[area].items = data[area].items.map((r) => (r.id === id ? next : r));
  redraw();
}

// change: { key: value } on one row; label: what the toast says it did. undo: true for an Undo itself
export async function change(area, id, values, label, { undo = false } = {}) {
  pending++;
  if (!undo) showLocally(area, id, values);
  try {
    const res = await post(`/api/jump/${area}/${encodeURIComponent(id)}`, { change: values, undo });
    pending--;
    await load();
    if (!undo) toast(`${label}${say(res.live)}`, false, { label: "Undo", run: () => change(area, id, res.undo, "", { undo: true }).then((ok) => ok && toast(`Put back${say(res.live)}`)) });
    return true;
  } catch (err) {
    pending--;
    await load();
    toast(err.message, true);
    return false;
  }
}

// a new escalation; Undo takes it back to Notion's trash (restorable there for 30 days)
export async function add(values) {
  pending++;
  try {
    const res = await post("/api/jump/escalations", { change: values });
    pending--;
    await load();
    toast(`Added to Jump OS: ${res.row.title}${say(res.live)}`, false, { label: "Undo", run: async () => {
      try {
        const t = await post(`/api/jump/escalations/${encodeURIComponent(res.row.id)}/trash`, {});
        await load();
        toast(t.live ? "Moved to Notion's trash (restorable there for 30 days)" : "Taken back (sample)");
      } catch (err) { toast(err.message, true); }
    } });
    return true;
  } catch (err) {
    pending--;
    toast(err.message, true);
    return false;
  }
}
