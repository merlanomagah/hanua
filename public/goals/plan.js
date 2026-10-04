// ---- Plan: build out the level below a goal, several at once, each linked to it ----
import { dayOf } from "../shared/dates.js";
import { LEVELS, donePoints, isGoalDone, levelIndex } from "../shared/goals.js";
import { SIZES } from "../coach.js";
import { $, api, h, state, toast } from "../lib.js";
import { createGoals } from "./store.js";
import { flashGoals, kidsOf, renderBoard, setFocusGoal } from "./board.js";
import { sized } from "./form.js";
import { whenHint, whenPicker } from "./when.js";
export let planParent = null;
export const planLevel = () => LEVELS[levelIndex(planParent?.level) + 1];

export function planRow(hint, preset = {}) {
  const lvl = planLevel();
  const title = h("input", { name: "t", value: preset.title || "", placeholder: hint ? `For “${hint}”` : `${lvl.name} title`, autocomplete: "off", ariaLabel: `${lvl.name} title` });
  const due = h("input", { type: "date", name: "d", ariaLabel: "Due date" });
  if (planParent.due) due.max = dayOf(planParent.due);
  // "No date" unless something real depends on it; quick picks stop at the parent's due date
  const when = h("span", { className: "plan-when" }, whenPicker(due, { level: lvl.name, parentDue: planParent.due }), due);
  const size = sized(lvl.name) ? h("select", { name: "s", ariaLabel: "Size in points" }, h("option", { value: "", textContent: "—" }), SIZES.map((x) => h("option", { value: x.pts, textContent: x.pts, title: x.feel }))) : null;
  const del = h("button", { type: "button", className: "plan-del", ariaLabel: "Remove this row", textContent: "×" });
  const row = h("li", { className: "plan-row" }, title, when, size, del,
    preset.why || preset.doneWhen ? h("span", { className: "plan-extra", textContent: "Why and done-when from Claude included ✓" }) : null);
  row.dataset.why = preset.why || "";
  row.dataset.done = preset.doneWhen || "";
  title.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // Enter adds the next row rather than saving
    const next = row.nextElementSibling || $("plan-rows").appendChild(planRow());
    next.querySelector("input").focus();
    updatePlanCount();
  });
  del.addEventListener("click", () => { row.remove(); if (!$("plan-rows").children.length) $("plan-rows").append(planRow()); updatePlanCount(); });
  return row;
}
export function planValues() {
  return [...$("plan-rows").children].map((r) => ({
    title: r.querySelector('[name="t"]').value.trim(), due: r.querySelector('[name="d"]').value,
    effort: r.querySelector('[name="s"]')?.value || "", why: r.dataset.why, doneWhen: r.dataset.done,
  })).filter((r) => r.title);
}
export function updatePlanCount() {
  const n = planValues().length, lvl = planLevel();
  $("plan-save").textContent = n ? `Add ${n} ${n === 1 ? lvl.name : lvl.plural}${state.goals.live ? " to Notion" : ""}` : "Add";
  $("plan-save").disabled = !n;
}
$("plan-rows").addEventListener("input", updatePlanCount);
$("plan-more").addEventListener("click", () => { const r = planRow(); $("plan-rows").append(r); r.querySelector("input").focus(); updatePlanCount(); });

export function openPlan(parent) {
  planParent = parent;
  const lvl = planLevel();
  if (!lvl) return;
  const kids = kidsOf(parent.id);
  const points = donePoints(parent);
  $("plan-heading").textContent = kids.length ? `More ${lvl.plural}` : `Build out the ${lvl.plural}`;
  $("plan-note").textContent = `${lvl.plural} for “${parent.title}”: each about ${lvl.when.toLowerCase()}'s work. ${state.goals.live ? "Nothing is added to Notion until you press Add." : "Sample goals: they're added on this page only, not in Notion."}`;
  $("plan-size-col").hidden = !sized(lvl.name);
  $("plan-form").classList.toggle("unsized", !sized(lvl.name));
  $("plan-parent").replaceChildren(
    h("span", { className: "eyebrow", textContent: `From the ${parent.level}` }),
    h("b", { className: "cp-title", textContent: parent.title }),
    parent.why ? h("p", { className: "cp-why", textContent: parent.why }) : h("p", { className: "cp-missing", textContent: `This ${parent.level} has no why yet.` }),
    points.length
      ? h("div", {}, h("span", { className: "cp-label", textContent: "Done when" }), h("ul", { className: "cp-points" }, points.map((p) => h("li", { textContent: p }))))
      : h("p", { className: "cp-missing", textContent: `No “done when” on the ${parent.level} yet. Adding one makes it easier to see which ${lvl.plural} you need.` }),
    h("div", {}, h("span", { className: "cp-label", textContent: `${lvl.plural} so far (${kids.length})` }),
      kids.length ? h("ul", { className: "cp-kids" }, kids.map((k) => h("li", { className: isGoalDone(k) ? "done" : "", textContent: k.title }))) : h("p", { className: "cp-missing", textContent: "None yet: these will be the first." })),
    h("p", { className: "cp-ask", textContent: `If every ${lvl.name} were done, would “${parent.title}” be done?` }));
  // one row per "done when" point to start from (at least three), or two more when some exist already
  const hints = kids.length ? [null, null] : points.length ? points.slice(0, 8) : [null, null, null];
  while (hints.length < 3 && !kids.length) hints.push(null);
  $("plan-rows").replaceChildren(...hints.map((p) => planRow(p)));
  $("plan-gaps").replaceChildren();
  $("plan-ideas").hidden = !state.goals.coach;
  $("plan-ideas").disabled = false;
  $("plan-after").textContent = `${whenHint(lvl.name)} Each ${lvl.name} can get its own${lvl.name === "Task" ? "" : " why and"} done-when afterwards: click its name in the Backlog, where the coach helps.`;
  updatePlanCount();
  $("plan-dialog").showModal();
  $("plan-rows").querySelector("input").focus();
}

$("plan-ideas").addEventListener("click", async () => {
  const p = planParent, lvl = planLevel();
  const btn = $("plan-ideas");
  btn.disabled = true;
  $("plan-gaps").replaceChildren(h("p", { className: "coach-reply loading", textContent: "Claude is looking for gaps…" }));
  try {
    const r = await api("/api/goals/ideas", {
      parent: { level: p.level, title: p.title, why: p.why, doneWhen: p.doneWhen, notes: p.description },
      children: [...kidsOf(p.id).map((k) => k.title), ...planValues().map((v) => v.title)], level: lvl.name,
    });
    // ideas fill the empty rows first, then add new ones
    for (const idea of r.ideas) {
      const empty = [...$("plan-rows").children].find((row) => !row.querySelector('[name="t"]').value.trim());
      const row = planRow(null, idea);
      if (empty) empty.replaceWith(row); else $("plan-rows").append(row);
    }
    $("plan-gaps").replaceChildren(h("p", { className: "cp-gaps", textContent: r.gaps }), h("p", { className: "coach-small", textContent: "Ideas only. Change or remove any of them; nothing is added until you press Add." }));
    updatePlanCount();
  } catch (err) {
    $("plan-gaps").replaceChildren(h("p", { className: "coach-reply error", textContent: err.message }));
  } finally {
    btn.disabled = false;
  }
});

$("plan-dialog").addEventListener("close", async () => {
  if ($("plan-dialog").returnValue !== "save") return;
  const p = planParent, lvl = planLevel();
  const rows = planValues();
  if (!rows.length) return;
  const base = { level: lvl.name, parent: p.id, status: "New", area: p.area || "" };
  try {
    const { created, failed, live } = await createGoals(rows.map((r) => ({ ...base, title: r.title, due: r.due, effort: r.effort, why: lvl.name === "Task" ? "" : r.why, doneWhen: r.doneWhen })));
    // let go of the picked parent, so nothing is dimmed: the new goals glow instead
    setFocusGoal(null);
    flashGoals(created.map((g) => g.id));
    const n = created.length;
    if (failed.length) toast(`${n} of ${rows.length} added. Not added: ${failed.map((f) => `“${f.values.title}” (${f.error})`).join(", ")}`, true);
    else {
      // keep going down the chain: offer to plan the next level for the first new goal
      const next = LEVELS[levelIndex(lvl.name) + 1];
      toast(`${n} ${n === 1 ? lvl.name : lvl.plural} added under “${p.title}”${live ? " ✓" : " (sample, not saved to Notion)"}`, false,
        next && created[0] ? { label: `Plan ${next.plural} for “${created[0].title}” →`, run: () => openPlan(created[0]) } : null);
    }
  } catch (err) {
    toast(err.message, true);
  }
  renderBoard();
});
