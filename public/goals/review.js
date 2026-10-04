// ---------- weekly review: the Scrum retrospective scaled to one person ----------
import { dayOf, daysBetween, todayStr, ymd } from "../shared/dates.js";
import { LEVELS, isGoalDone } from "../shared/goals.js";
import { WIP_LIMIT } from "../coach.js";
import { $, api, fmtDay, h, longDate, state, toast } from "../lib.js";
import { createGoal } from "./store.js";
import { onBoard, renderBoard } from "./board.js";
import { leafGoals, sized } from "./form.js";
import { renderNotes } from "../app.js";

export const ENERGY = ["Low", "Okay", "Good", "Great"];
export const lastReview = () => state.reviews.reviews[0] || null;
// due a week after the last one (or straight away if there's never been one)
export function reviewDue() {
  const last = lastReview();
  return !last?.date || daysBetween(last.date, todayStr()) >= 7;
}
export const mondayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
export const sundayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((7 - d.getDay()) % 7));

export let rv = null;

// Pace (velocity) and calibration, from finished goals without children (so nothing counts twice).
export const pointsOf = (list) => list.reduce((n, g) => n + (Number(g.effort) || 0), 0);
export function pace() {
  const today = todayStr();
  const done = leafGoals().filter((g) => isGoalDone(g) && g.completed && Number(g.effort));
  const recent = done.filter((g) => daysBetween(g.completed, today) <= 28);
  const oldest = recent.reduce((m, g) => Math.max(m, daysBetween(g.completed, today)), 0);
  if (oldest < 14) return null; // a couple of weeks before an average means anything
  return Math.round((pointsOf(recent) / Math.max(2, Math.ceil(oldest / 7))) * 10) / 10;
}
export function calibration() {
  const felt = leafGoals().filter((g) => g.felt).sort((a, b) => (b.completed || "").localeCompare(a.completed || "")).slice(0, 20);
  if (felt.length < 3) return null;
  const n = (k) => felt.filter((g) => g.felt === k).length;
  const bigger = n("Bigger"), smaller = n("Smaller"), right = n("About right");
  if (bigger - smaller >= 2 && bigger >= right) return `${bigger} of your last ${felt.length} sized goals felt bigger than you guessed. Try sizing up a step.`;
  if (smaller - bigger >= 2 && smaller >= right) return `${smaller} of your last ${felt.length} felt smaller than you guessed. You can size a little lower.`;
  if (right >= felt.length / 2) return `${right} of your last ${felt.length} felt about right. Your sense of size is settling in.`;
  return `Mixed so far (${right} about right, ${bigger} bigger, ${smaller} smaller). Keep noting how they feel: the pattern shows after a few weeks.`;
}
export const RV_STEPS = [
  { key: "wins", name: "Wins", title: "What got done?", prompt: "Anything else worth celebrating? Small wins count." },
  { key: "stuck", name: "Stuck", title: "What's stuck or at risk?", prompt: "What's stuck, why, and what would unstick it?" },
  { key: "wip", name: "WIP", title: "Is the limit holding?", prompt: "What will you finish, or park, so less is in progress?" },
  { key: "weekGoal", name: "Plan", title: "Plan this week", prompt: "If I only finish these, the week was worth it because…" },
  { key: "tryNext", name: "Try", title: "One small change", prompt: "One thing to do differently next week." },
];

export function openReview() {
  const last = lastReview();
  rv = { step: 0, since: last?.date ? dayOf(last.date) : ymd(new Date(Date.now() - 7 * 86_400_000)), energy: "", wins: "", stuck: "", wip: "", weekGoal: "", tryNext: "" };
  $("review-week").textContent = `Week of ${longDate(mondayOf(new Date()), false)}`;
  $("rv-last").hidden = !last?.tryNext;
  if (last?.tryNext) $("rv-last").textContent = `Last time you said you'd try: “${last.tryNext}”. Did it help?`;
  $("rv-notion").hidden = !state.reviews.notionUrl;
  if (state.reviews.notionUrl) $("rv-notion").href = state.reviews.notionUrl;
  renderReview();
  $("review-dialog").showModal();
}

export const goalLine = (g, tag) => h("li", { className: `rv-goal lvl-${(g.level || "task").toLowerCase()}` },
  h("span", { className: "rv-type", textContent: g.level || "Task" }), h("span", { className: "rv-t", textContent: g.title }), tag ? h("span", { className: "rv-tag", textContent: tag }) : null);

export function renderReview() {
  const step = RV_STEPS[rv.step];
  const goals = state.goals.goals;
  const today = todayStr();
  const open = goals.filter((g) => !isGoalDone(g));
  const doneSince = goals.filter((g) => isGoalDone(g) && g.completed && dayOf(g.completed) >= rv.since);
  $("rv-steps").replaceChildren(...RV_STEPS.map((s, i) => h("li", { className: i === rv.step ? "on" : i < rv.step ? "past" : "" }, h("span", { textContent: i + 1 }), s.name)));
  let top = [];
  if (step.key === "wins") {
    const pick = h("div", { className: "seg energy", role: "radiogroup", ariaLabel: "Energy this week" }, ENERGY.map((e) => {
      const b = h("button", { type: "button", textContent: e, ariaPressed: String(rv.energy === e) });
      b.setAttribute("aria-selected", String(rv.energy === e));
      b.addEventListener("click", () => { rv.energy = rv.energy === e ? "" : e; renderReview(); });
      return b;
    }));
    const pts = pointsOf(doneSince.filter((g) => !(g.children?.length)));
    const cal = calibration();
    top = [
      doneSince.length
        ? h("ul", { className: "rv-list" }, doneSince.map((g) => goalLine(g, [g.effort && !(g.children?.length) ? `${g.effort} pts` : null, fmtDay(g.completed, { weekday: "short" })].filter(Boolean).join(" · "))))
        : h("p", { className: "rv-empty", textContent: `Nothing marked Done since ${fmtDay(rv.since, { weekday: "long", day: "numeric", month: "short" })}. That's okay: note what moved, even a little.` }),
      pts ? h("p", { className: "rv-pace", textContent: `That's ${pts} point${pts > 1 ? "s" : ""} finished.${pace() ? ` Your usual is about ${pace()} a week.` : ""}` }) : null,
      cal ? h("p", { className: "rv-hint", textContent: cal }) : null,
      h("div", { className: "rv-row" }, h("span", { className: "rv-label", textContent: "Energy this week" }), pick),
    ].filter(Boolean);
  } else if (step.key === "stuck") {
    const risk = open.filter((g) => /at risk/i.test(g.status || ""));
    const late = open.filter((g) => g.due && dayOf(g.due) < today && !risk.includes(g));
    top = [risk.length || late.length
      ? h("ul", { className: "rv-list" }, risk.map((g) => goalLine(g, "At risk")), late.map((g) => goalLine(g, `${daysBetween(g.due, today)} days late`)))
      : h("p", { className: "rv-empty", textContent: "Nothing at risk or overdue. Nice." })];
  } else if (step.key === "wip") {
    top = [h("div", { className: "rv-wip" }, LEVELS.map((l) => {
      const n = goals.filter((g) => g.level === l.name && g.status === "Active").length;
      return h("div", { className: `rv-wip-row${n > WIP_LIMIT ? " over" : ""}` },
        h("span", { textContent: l.plural }),
        h("span", { className: "rv-meter" }, Object.assign(h("i"), { style: `width:${Math.min(100, (n / WIP_LIMIT) * 100)}%` })),
        h("span", { textContent: `${n} active / ${WIP_LIMIT}` }));
    })), h("p", { className: "rv-hint", textContent: "Half-done work costs twice: it takes headspace and goes stale. Finish before you start." })];
  } else if (step.key === "weekGoal") {
    const tasks = open.filter((g) => g.level === "Task").sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
    const pbis = open.filter((g) => g.level === "PBI");
    const title = h("input", { type: "text", placeholder: "Add a task for this week, e.g. “Email the agent”", autocomplete: "off" });
    const parent = h("select", {}, h("option", { value: "", textContent: "Which PBI is it for?" }), pbis.map((p) => h("option", { value: p.id, textContent: p.title })));
    const add = h("button", { type: "button", className: "g-act", textContent: "Add task" });
    add.addEventListener("click", async () => {
      if (!title.value.trim()) return title.focus();
      add.disabled = true;
      const values = { title: title.value.trim(), level: "Task", parent: parent.value, status: "New", due: ymd(sundayOf(new Date())) };
      try {
        const res = await createGoal(values);
        toast(res.live ? "Task added to Notion ✓" : "Task added here only (sample goals)");
        if (onBoard) renderBoard();
        renderReview();
      } catch (err) { toast(err.message, true); add.disabled = false; }
    });
    // planned this week vs your usual pace: the check that stops overcommitting
    const weekEnd = ymd(new Date(Date.now() + 7 * 86_400_000));
    const planned = tasks.filter((g) => !(g.children?.length) && (g.status === "Active" || (g.due && dayOf(g.due) <= weekEnd)));
    const plannedPts = pointsOf(planned), unsized = planned.filter((g) => !Number(g.effort)).length, usual = pace();
    const heavy = usual && plannedPts > usual * 1.25;
    top = [
      tasks.length ? h("ul", { className: "rv-list" }, tasks.map((g) => goalLine(g, [g.effort ? `${g.effort} pts` : null, g.due ? fmtDay(g.due, { weekday: "short", day: "numeric" }) : g.status].filter(Boolean).join(" · ")))) : h("p", { className: "rv-empty", textContent: "No open tasks yet. Pick a few from this month's PBIs." }),
      h("p", { className: `rv-pace${heavy ? " heavy" : ""}`, textContent: [
        `Planned for the next 7 days: ${plannedPts} point${plannedPts === 1 ? "" : "s"}${unsized ? ` (${unsized} not sized yet)` : ""}.`,
        usual ? ` Your usual is about ${usual} a week.` : " Your usual pace will show after a couple of weeks of sized, finished tasks.",
        heavy ? " That's more than usual: consider moving something out." : "",
      ].join("") }),
      h("div", { className: "rv-add" }, title, parent, add),
    ];
  } else {
    const active = goals.filter((g) => g.status === "Active").length;
    top = [h("p", { className: "rv-summary", textContent: `${doneSince.length} done · ${active} active · ${open.filter((g) => /at risk/i.test(g.status || "")).length} at risk${rv.energy ? ` · energy ${rv.energy.toLowerCase()}` : ""}` })];
  }
  const area = h("textarea", { rows: 3, placeholder: "A line or two is plenty", value: rv[step.key] });
  area.addEventListener("input", () => { rv[step.key] = area.value; });
  $("rv-body").replaceChildren(h("h4", { className: "rv-title", textContent: step.title }), ...top, h("label", { className: "rv-label" }, step.prompt, area));
  $("rv-back").hidden = rv.step === 0;
  $("rv-next").textContent = rv.step === RV_STEPS.length - 1 ? (state.reviews.live ? "Save review to Notion" : "Save review") : "Next";
}

$("rv-back").addEventListener("click", () => { rv.step--; renderReview(); });
$("rv-next").addEventListener("click", async () => {
  if (rv.step < RV_STEPS.length - 1) { rv.step++; return renderReview(); }
  const goals = state.goals.goals;
  const doneSince = goals.filter((g) => isGoalDone(g) && g.completed && dayOf(g.completed) >= rv.since);
  const clip = (t) => (t.length > 1900 ? `${t.slice(0, 1900)}…` : t);
  const values = {
    title: `Week of ${mondayOf(new Date()).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`,
    date: todayStr(),
    wins: clip([doneSince.map((g) => `- ${g.level}: ${g.title}`).join("\n"), rv.wins.trim()].filter(Boolean).join("\n\n")),
    stuck: clip(rv.stuck.trim()), wip: clip(rv.wip.trim()), weekGoal: clip(rv.weekGoal.trim()), tryNext: clip(rv.tryNext.trim()),
    done: doneSince.length, active: goals.filter((g) => g.status === "Active").length,
    atRisk: goals.filter((g) => !isGoalDone(g) && /at risk/i.test(g.status || "")).length, energy: rv.energy,
    points: pointsOf(doneSince.filter((g) => !(g.children?.length))),
  };
  $("rv-next").disabled = true;
  try {
    const res = await api("/api/reviews", { values });
    if (res.live) state.reviews = await api("/api/reviews");
    else state.reviews.reviews.unshift({ id: `local-${Date.now()}`, week: values.title, date: values.date, tryNext: values.tryNext, weekGoal: values.weekGoal });
    $("review-dialog").close();
    toast(res.live ? "Review saved to Notion ✓ See you next week." : "Review saved here only (sample data)");
    renderNotes();
    if (onBoard) renderBoard();
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("rv-next").disabled = false;
  }
});
$("review-open").addEventListener("click", openReview);
