// ---- the goal form: review, edit, or add (Notion only changes on Save) ----
import { dayOf, todayStr } from "../shared/dates.js";
import { LEVELS, donePoints, isGoalDone, levelIndex } from "../shared/goals.js";
import { GUIDE, SIZES, SIZE_QUESTIONS, coachChecks, suggestSize } from "../coach.js";
import { $, api, fmtDay, focus, focusGoals, h, state, toast } from "../lib.js";
import { areaOptions, createGoal, statusOptions, updateGoal } from "./store.js";
import { GOAL_AREAS, GOAL_STATUS, boardLevel, boardView, flashGoals, goalById, renderBoard, toggleNewMenu } from "./board.js";
import { coinText } from "../shelf.js";
import { refreshWhen, whenHint, whenPicker } from "./when.js";
export let editingGoal = null;
export function fillSelect(sel, options, value, blank = "—") {
  sel.replaceChildren(h("option", { value: "", textContent: blank }), ...options.map((o) => typeof o === "string" ? h("option", { value: o, textContent: o }) : h("option", { value: o.value, textContent: o.label })));
  if (value && ![...sel.options].some((o) => o.value === String(value))) sel.append(h("option", { value, textContent: String(value) }));
  sel.value = value ?? "";
}
export function fillParents(level, value) {
  const up = LEVELS[levelIndex(level) - 1];
  const f = $("goal-form").elements;
  f.parent.disabled = !up;
  const options = up ? focusGoals(state.goals.goals).filter((g) => g.level === up.name && g.id !== editingGoal?.id).map((g) => ({ value: g.id, label: g.title })) : [];
  fillSelect(f.parent, options, value, up ? `No ${up.name} yet` : "Epics are the top level");
}
export function openGoal(g, preset = {}) {
  editingGoal = g || null;
  const v = { ...g, ...preset };
  const f = $("goal-form").elements;
  const level = v.level || "Epic";
  $("goal-heading").textContent = g ? `${level}: review` : `New ${level}`;
  $("goal-note").textContent = state.goals.live ? "Nothing changes in Notion until you press Save." : "Sample goals: saving changes them here only, not in Notion.";
  f.title.value = v.title || "";
  fillSelect(f.level, LEVELS.map((l) => ({ value: l.name, label: `${l.name} · ${l.when}` })), level);
  fillParents(level, v.parent || "");
  fillSelect(f.status, statusOptions(GOAL_STATUS), v.status || "New");
  fillSelect(f.priority, [1, 2, 3, 4].map((p) => ({ value: String(p), label: `P${p}${p === 1 ? " · highest" : p === 4 ? " · lowest" : ""}` })), v.priority ? String(v.priority) : "");
  // a goal added at work is a work goal, so it stays on screen
  fillSelect(f.area, areaOptions(GOAL_AREAS), v.area || (!g && focus.on ? "Work" : ""));
  f.effort.value = v.effort ?? "";
  f.start.value = dayOf(v.start || "");
  f.due.value = dayOf(v.due || "");
  syncWhen();
  f.description.value = v.description || "";
  f.why.value = v.why || "";
  f.doneWhen.value = v.doneWhen || "";
  ideasFor = null;
  $("coach-parent").dataset.for = "";
  sz = { work: null, unknown: 0, waiting: 0 };
  // a goal with children has its progress worked out from them
  const kids = g?.children?.length || 0;
  $("progress-field").hidden = kids > 0;
  $("progress-rolled").hidden = !kids;
  if (kids) $("progress-rolled").textContent = `Progress ${g.progress}%, worked out from ${g.childDone} of ${kids} ${LEVELS[levelIndex(g.level) + 1]?.plural || "children"} done.`;
  f.progress.value = g?.progressSet ?? 0;
  f.progressOut.value = `${f.progress.value}%`;
  $("goal-open").hidden = !g?.url;
  if (g?.url) $("goal-open").href = g.url;
  $("coach-reply").hidden = true;
  $("coach-ask").hidden = !state.goals.coach;
  $("coach-guide").hidden = !state.goals.guideUrl;
  if (state.goals.guideUrl) $("coach-guide").href = state.goals.guideUrl;
  updateCoach();
  $("goal-dialog").showModal();
}
$("goal-form").elements.level.addEventListener("change", (e) => { fillParents(e.target.value, ""); syncWhen(); });
$("goal-form").elements.parent.addEventListener("change", () => syncWhen());

// "When?" in front of the due date: its picks follow the level, and stop at the parent's due date
const whenSel = whenPicker($("goal-form").elements.due, {});
$("when-row").prepend(whenSel);
function syncWhen() {
  const f = $("goal-form").elements;
  refreshWhen(whenSel, { level: f.level.value, parentDue: goalById(f.parent.disabled ? "" : f.parent.value)?.due });
  $("when-hint").textContent = whenHint(f.level.value);
}

// ---- the coach beside the form ----
export function formValues() {
  const f = $("goal-form").elements;
  return { id: editingGoal?.id, title: f.title.value, level: f.level.value, parent: f.parent.disabled ? "" : f.parent.value, status: f.status.value,
    priority: f.priority.value, effort: f.effort.value, area: f.area.value, start: f.start.value, due: f.due.value,
    why: f.why.value, doneWhen: f.doneWhen.value, description: f.description.value };
}
export function updateCoach() {
  const v = formValues();
  const guide = GUIDE[v.level] || GUIDE.Task;
  const parentLevel = LEVELS[levelIndex(v.level) - 1]?.name;
  const siblings = state.goals.goals.filter((g) => g.level === v.level && !isGoalDone(g) && g.id !== v.id && (v.level === "Epic" || (v.parent && g.parent === v.parent)));
  // level-specific labels and examples on the form
  const f = $("goal-form").elements;
  $("why-field").hidden = v.level === "Task";
  f.why.placeholder = guide.why;
  $("done-label").textContent = guide.doneLabel;
  f.doneWhen.placeholder = guide.done;
  renderCoachParent(v);
  renderSizePick(v);
  renderSizer(v);
  $("coach-level").textContent = `${v.level} · ${guide.when}`;
  $("coach-what").textContent = guide.what;
  $("coach-eg").textContent = `e.g. ${guide.example}`;
  const childCount = editingGoal?.children?.length || 0;
  const parent = goalById(v.parent);
  const short = (d) => fmtDay(d, { day: "numeric", month: "short" });
  const checks = coachChecks(v, { parentLevel, childCount, openSiblings: v.level === "Epic" || v.parent ? siblings.length : 0, today: todayStr(),
    parentDue: dayOf(parent?.due) || null, parentDueLabel: short(parent?.due), parentStart: dayOf(parent?.start) || null, parentStartLabel: short(parent?.start) });
  $("coach-checks").replaceChildren(...(checks.length ? checks : [{ ok: false, text: "Start with a title" }]).map((c) =>
    h("li", { className: c.ok ? "ok" : c.ok === null ? "ask" : "nudge" }, h("span", { className: "mark", ariaHidden: "true", textContent: c.ok ? "✓" : c.ok === null ? "?" : "·" }), c.text)));
}
$("goal-form").addEventListener("input", updateCoach);
$("goal-form").addEventListener("change", updateCoach);

$("coach-template").addEventListener("click", () => {
  const f = $("goal-form").elements;
  const t = (GUIDE[f.level.value] || GUIDE.Task).scaffold;
  if (f.level.value !== "Task" && !f.why.value.trim()) f.why.value = "So that ";
  f.doneWhen.value = f.doneWhen.value.trim() ? `${f.doneWhen.value.trimEnd()}\n${t}` : t;
  (f.level.value !== "Task" && f.why.value === "So that " ? f.why : f.doneWhen).focus();
  updateCoach();
});

// ---- effort points: a size picker, three questions, and your own finished goals as the reference ----
export const sized = (level) => level === "Task" || level === "PBI";
export const leafGoals = () => state.goals.goals.filter((g) => !(g.children?.length));
export let sz = { work: null, unknown: 0, waiting: 0 };

export function renderSizePick(v) {
  const f = $("goal-form").elements;
  const pick = $("size-pick");
  const kids = editingGoal?.children?.length || 0;
  const direct = sized(v.level) && !kids;
  pick.hidden = !direct;
  $("size-total").hidden = direct;
  if (!direct) {
    const total = editingGoal?.effortTotal;
    $("size-total").textContent = total
      ? `${total} points, added up from what's underneath. Epics and Features aren't sized directly.`
      : `Worked out from its ${LEVELS[levelIndex(v.level) + 1]?.plural || "children"} once you size those. Bigger goals are too uncertain to size well, so they add up from the pieces.`;
    $("size-feel").textContent = "";
    return;
  }
  const current = Number(f.effort.value) || null;
  $("size-feel").textContent = current ? `· ${SIZES.find((x) => x.pts === current)?.feel || ""}` : "";
  pick.replaceChildren(...SIZES.map((x) => {
    const b = h("button", { type: "button", className: `size-btn${current === x.pts ? " on" : ""}${x.pts === 13 ? " warn" : ""}`, textContent: x.pts, title: x.feel });
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(current === x.pts));
    b.addEventListener("click", () => { f.effort.value = current === x.pts ? "" : x.pts; updateCoach(); });
    return b;
  }));
}

export function renderSizer(v) {
  const box = $("sizer");
  box.hidden = !sized(v.level) || (editingGoal?.children?.length || 0) > 0;
  if (box.hidden) return;
  const f = $("goal-form").elements;
  $("sizer-qs").replaceChildren(...Object.entries(SIZE_QUESTIONS).map(([key, q]) =>
    h("div", { className: "sizer-q" }, h("span", { textContent: q.label }),
      h("div", { className: "seg mini" }, q.options.map((o, i) => {
        const b = h("button", { type: "button", textContent: o });
        b.setAttribute("aria-selected", String(sz[key] === i && (key !== "work" || sz.work !== null)));
        b.addEventListener("click", () => { sz[key] = i; updateCoach(); });
        return b;
      })))));
  const s = suggestSize(sz);
  const out = $("sizer-out");
  if (s) {
    const use = h("button", { type: "button", className: "g-act", textContent: `Use ${s.pts}` });
    use.addEventListener("click", () => { f.effort.value = s.pts; updateCoach(); });
    out.replaceChildren(...[h("b", { textContent: `Suggested: ${s.pts}` }), ` (${s.why})`, s.pts === 13 ? h("span", { className: "late", textContent: ". Too big: split it." }) : null, " ", s.pts < 13 ? use : null].filter((x) => x != null));
  } else out.textContent = "Answer the first question for a suggestion.";
  // the reference point: what you've actually finished at this size, and how it felt
  const size = Number(f.effort.value) || s?.pts;
  const mine = size ? leafGoals().filter((g) => isGoalDone(g) && Number(g.effort) === size).sort((a, b) => (b.completed || "").localeCompare(a.completed || "")) : [];
  const felt = mine.filter((g) => g.felt);
  const bigger = felt.filter((g) => g.felt === "Bigger").length, smaller = felt.filter((g) => g.felt === "Smaller").length;
  const starter = SIZES.find((x) => x.pts === size);
  $("sizer-refs").replaceChildren(...(size ? [
    h("span", { className: "cp-label", textContent: mine.length ? `Your ${size}s so far` : `A ${size} looks like` }),
    mine.length
      ? h("ul", { className: "cp-points" }, mine.slice(0, 3).map((g) => h("li", {}, g.title, g.felt && g.felt !== "About right" ? h("em", { textContent: ` (felt ${g.felt.toLowerCase()})` }) : null)))
      : h("p", { className: "cp-hint", textContent: starter?.eg ? `${starter.feel}: ${starter.eg}` : starter?.feel || "" }),
    felt.length >= 3 && bigger > felt.length / 2 ? h("p", { className: "sizer-cal", textContent: `${bigger} of your ${felt.length} finished ${size}s felt bigger. You may be sizing low: try the next size up.` }) : null,
    felt.length >= 3 && smaller > felt.length / 2 ? h("p", { className: "sizer-cal", textContent: `${smaller} of your ${felt.length} finished ${size}s felt smaller. You may be sizing high.` }) : null,
  ] : []).filter(Boolean));
}

// After a sized Task or PBI is done: how big did it really feel? That answer is the reference point.
export let feltGoal = null;
export function askFelt(g) {
  if (!g || !sized(g.level) || !g.effort || g.children?.length) return;
  feltGoal = g;
  $("felt-title").textContent = `How big did “${g.title}” really feel?`;
  $("felt-note").textContent = `You sized it at ${g.effort} point${g.effort > 1 ? "s" : ""} (${SIZES.find((x) => x.pts === Number(g.effort))?.feel.toLowerCase() || "your guess"}). Your answer teaches your future guesses.`;
  $("felt-dialog").showModal();
}
document.querySelectorAll("[data-felt]").forEach((b) => b.addEventListener("click", async () => {
  const g = feltGoal;
  const felt = b.dataset.felt;
  $("felt-dialog").close();
  if (!g) return;
  try {
    await updateGoal(g, { felt });
    toast(felt === "About right" ? "Nice estimate ✓" : `Noted: felt ${felt.toLowerCase()}. Next time you'll know.`);
  } catch (err) { toast(err.message, true); }
}));
$("felt-skip").addEventListener("click", () => $("felt-dialog").close());

// "From the Epic": the parent's why and done-when beside the form, plus the children it already has,
// so each child is planned against what the parent needs. Ideas from Claude fill gaps.
export let ideasFor = null;
export function renderCoachParent(v) {
  const box = $("coach-parent");
  const parent = goalById(v.parent);
  if (!parent) { box.hidden = true; ideasFor = null; return; }
  box.hidden = false;
  const kids = state.goals.goals.filter((g) => g.parent === parent.id && g.id !== v.id);
  const pg = GUIDE[parent.level] || GUIDE.Task;
  const points = donePoints(parent);
  if (ideasFor === parent.id && box.dataset.for === parent.id) return; // keep ideas showing while typing
  box.dataset.for = parent.id;
  const ideasBtn = state.goals.coach ? h("button", { type: "button", className: "g-act", textContent: `Ideas for missing ${v.level}s` }) : null;
  const ideas = h("div", { className: "coach-ideas" });
  ideasBtn?.addEventListener("click", () => loadIdeas(parent, kids, v.level, ideas, ideasBtn));
  box.replaceChildren(
    h("span", { className: "eyebrow", textContent: `From the ${parent.level}` }),
    h("b", { className: "cp-title", textContent: parent.title }),
    parent.why ? h("p", { className: "cp-why", textContent: parent.why }) : h("p", { className: "cp-missing", textContent: `This ${parent.level} has no why yet.` }),
    points.length
      ? h("div", {}, h("span", { className: "cp-label", textContent: "Done when" }), h("ul", { className: "cp-points" }, points.map((p) => h("li", { textContent: p }))), pg.childHint ? h("p", { className: "cp-hint", textContent: pg.childHint }) : null)
      : h("p", { className: "cp-missing", textContent: `No “done when” on the ${parent.level} yet. Adding one makes it easier to see which ${v.level}s you need.` }),
    h("div", {}, h("span", { className: "cp-label", textContent: `${v.level}s so far (${kids.length})` }),
      kids.length ? h("ul", { className: "cp-kids" }, kids.map((k) => h("li", { className: isGoalDone(k) ? "done" : "", textContent: k.title }))) : h("p", { className: "cp-missing", textContent: "None yet: this is the first." })),
    h("p", { className: "cp-ask", textContent: `If every ${v.level} were done, would “${parent.title}” be done?` }),
    ...[ideasBtn, ideas].filter(Boolean));
}

export async function loadIdeas(parent, kids, level, box, btn) {
  btn.disabled = true;
  ideasFor = parent.id;
  box.replaceChildren(h("p", { className: "coach-reply loading", textContent: "Claude is looking for gaps…" }));
  try {
    const r = await api("/api/goals/ideas", {
      parent: { level: parent.level, title: parent.title, why: parent.why, doneWhen: parent.doneWhen, notes: parent.description },
      children: kids.map((k) => k.title), level,
    });
    const f = $("goal-form").elements;
    box.replaceChildren(
      h("p", { className: "cp-gaps", textContent: r.gaps }),
      ...r.ideas.map((idea) => {
        const use = h("button", { type: "button", className: "g-act", textContent: "Use" });
        use.addEventListener("click", () => {
          f.title.value = idea.title;
          if (level !== "Task") f.why.value = idea.why;
          f.doneWhen.value = idea.doneWhen;
          updateCoach();
          use.textContent = "Using ✓";
        });
        return h("div", { className: "cp-idea" }, h("b", { textContent: idea.title }), idea.covers ? h("span", { textContent: `for: ${idea.covers}` }) : null, use);
      }),
      h("p", { className: "coach-small", textContent: "Ideas only. Pick one to fill in the form; nothing saves until you press Save." }));
  } catch (err) {
    box.replaceChildren(h("p", { className: "coach-reply error", textContent: err.message }));
    ideasFor = null;
  } finally {
    btn.disabled = false;
  }
}

$("coach-ask").addEventListener("click", async () => {
  const v = formValues();
  const box = $("coach-reply");
  if (!v.title.trim()) return toast("Give the goal a title first.", true);
  const parent = goalById(v.parent);
  box.hidden = false;
  box.className = "coach-reply loading";
  box.textContent = "Claude is reading your goal…";
  $("coach-ask").disabled = true;
  try {
    const r = await api("/api/goals/coach", { goal: v, parent: parent ? { level: parent.level, title: parent.title, why: parent.why, doneWhen: parent.doneWhen } : null });
    const use = (label, fn) => { const b = h("button", { type: "button", className: "g-act", textContent: label }); b.addEventListener("click", () => { fn(); updateCoach(); b.textContent = "Used ✓"; b.disabled = true; }); return b; };
    const f = $("goal-form").elements;
    box.className = "coach-reply";
    box.replaceChildren(
      h("b", { textContent: r.verdict === "good" ? "Looks good" : "A few tweaks" }),
      h("ul", {}, r.feedback.map((t) => h("li", { textContent: t }))),
      r.title && r.title.trim() !== v.title.trim() ? h("div", { className: "coach-suggest" }, h("span", { textContent: `Title: “${r.title}”` }), use("Use title", () => { f.title.value = r.title; })) : null,
      r.why && r.why.trim() !== v.why.trim() && v.level !== "Task" ? h("div", { className: "coach-suggest" },
        h("pre", { textContent: r.why }), use("Use why", () => { f.why.value = r.why; })) : null,
      r.doneWhen && r.doneWhen.trim() !== v.doneWhen.trim() ? h("div", { className: "coach-suggest" },
        h("pre", { textContent: r.doneWhen }), use("Use done when", () => { f.doneWhen.value = r.doneWhen; })) : null,
      h("p", { className: "coach-small", textContent: "Suggestions only. Nothing is saved until you press Save." }));
  } catch (err) {
    box.className = "coach-reply error";
    box.textContent = err.message;
  } finally {
    $("coach-ask").disabled = false;
  }
});
$("goal-form").elements.progress.addEventListener("input", (e) => { $("goal-form").elements.progressOut.value = `${e.target.value}%`; });
$("goal-add").addEventListener("click", () => (boardView === "kanban" ? openGoal(null, { level: boardLevel }) : toggleNewMenu()));
$("goal-dialog").addEventListener("close", async () => {
  if ($("goal-dialog").returnValue !== "save") return;
  const f = $("goal-form").elements;
  const values = {
    title: f.title.value.trim(), level: f.level.value, parent: f.parent.disabled ? "" : f.parent.value, status: f.status.value,
    priority: f.priority.value, effort: f.effort.value, area: f.area.value, start: f.start.value, due: f.due.value, description: f.description.value.trim(),
    why: f.level.value === "Task" ? "" : f.why.value.trim().replace(/^so that\s*$/i, ""), doneWhen: f.doneWhen.value.trim(),
  };
  const g = editingGoal;
  if (!(g?.children?.length)) values.progress = f.progress.value;
  const wasDone = /^done/i.test(g?.status || "");
  if (values.status === "Done" && !wasDone) values.completed = todayStr();
  else if (wasDone && values.status !== "Done") values.completed = "";
  if (!values.title) return toast("Give the goal a name.", true);
  try {
    const res = g ? await updateGoal(g, values) : await createGoal(values);
    flashGoals([g ? g.id : res.goal.id]);
    toast(!res.live ? "Saved here only (sample goals, so Notion isn't changed)" : g ? "Saved to Notion ✓" : `${values.level} added to Notion ✓`);
    renderBoard();
    if (g && values.status === "Done" && !wasDone) { askFelt(goalById(g.id)); toast(`Done ✓${focus.on ? "" : coinText(g)}`); }
  } catch (err) {
    toast(err.message, true);
  }
});
