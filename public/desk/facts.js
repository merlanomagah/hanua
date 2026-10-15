// How the days went (Mel, 15 Oct 2026; brief docs/plans/2026-10-planner-keys-and-close-insights.md): the last two
// weeks in a few numbers and at most three suggestions, from the day files (rules weekFacts / dayFacts in
// shared/desk.js, tested; /api/desk/facts). Shown in the two-week view and the weekly review's last step, never at
// work. Hanua notices so Mel needn't be introspective; nothing here is a score.
import { BLOCKERS, MOODS } from "../shared/desk.js";
import { h } from "../lib.js";

export async function loadFacts(days = 14) {
  try { const res = await fetch(`/api/desk/facts?days=${days}`); return res.ok ? await res.json() : null; } catch { return null; }
}
const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
export function factsEl(f, { title = "The last two weeks" } = {}) {
  if (!f || !f.days) return null;
  const c = f.closed;
  const closed = [c.evening && `${c.evening} in the evening`, c.morning && `${c.morning} the next morning`, c.no && `${c.no} not at all`].filter(Boolean).join(", ");
  const moods = MOODS.filter(([k]) => f.moods?.[k]).map(([k, face]) => `${face} ${f.moods[k]}`).join("  ");
  const lines = [
    `${plural(f.days, "day")} written on, ${f.planned} planned · ${f.done} of ${plural(f.tasks, "task")} done (${f.tickedOnDay} ticked on the day)`,
    closed ? `Closed: ${closed}` : null,
    moods ? `Days: ${moods}` : null,
    f.topBlocker ? `Got in the way most: ${BLOCKERS.find(([k]) => k === f.topBlocker)?.[1]}` : null,
  ].filter(Boolean);
  return h("section", { className: "wk-facts" },
    h("h4", { textContent: title }),
    h("ul", { className: "wk-fact-list" }, lines.map((t) => h("li", { textContent: t }))),
    f.suggestions?.length ? h("ul", { className: "wk-ideas" }, f.suggestions.map((s) => h("li", { title: s.items?.join(" · ") || "", textContent: `✦ ${s.text}` }))) : null);
}
