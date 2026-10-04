// Plan the week (the menu board's ✦ button): like planning goals down the chain, but for meals. A tab per day,
// Breakfast / Lunch / Dinner rows: pick the protein first (how Mel and her partner choose), then write the meal,
// or Ask Claude for three ideas around that protein, kept to "Our tastes" (read from the Notion Eating well guide).
// The coach beside the rows updates as you pick. Nothing reaches the board until "Add to the board" (with Undo).
import { addDays, todayStr } from "./shared/dates.js";
import { DAYS, MEALS, PROTEINS, menuShape, menuTips } from "./shared/menu.js";
import { $, focus, fmtDay, h, toast } from "./lib.js";
import { menuIcon } from "./menu-icons.js";
import { HABIT_ICONS, applyMenu, boardWeek } from "./whiteboard.js";

let plan = null; // { week, menu, protein: { "mon.Dinner": "Steak" }, extra: Set of day keys whose dinner makes lunch }
let day = 0;
let tastes = null; // { tastes: [...], url, error?, sample? }

const key = (d, m) => `${DAYS[d]}.${m}`;
const proteinOf = (name) => PROTEINS.find((p) => p.name === name);
// what the coach reads: each meal with its protein in front, so picking Salmon counts as fish straight away
const forTips = () => {
  const m = menuShape({});
  DAYS.forEach((d, i) => MEALS.forEach((meal) => {
    const p = plan.protein[key(i, meal)];
    m[d][meal] = [p, plan.menu[d][meal]].filter(Boolean).join(" · ").slice(0, 120);
  }));
  return m;
};

export async function openMealPlan() {
  if (focus.on) return;
  const board = boardWeek();
  plan = { week: board.week, menu: board.menu, lastWeek: board.lastWeek, protein: {}, extra: new Set() };
  const today = todayStr();
  day = Math.max(0, DAYS.findIndex((_, i) => addDays(plan.week, i) === today));
  $("meal-note").textContent = `Week from ${fmtDay(plan.week, { weekday: "long", day: "numeric", month: "long" })}. Pick the protein first, then the meal, or ask Claude for ideas. Nothing goes on the board until you press Add.`;
  renderDays();
  renderRows();
  renderCoach();
  $("meal-dialog").showModal();
  if (!tastes || tastes.error) {
    try { tastes = await (await fetch("/api/menu/tastes")).json(); } catch { tastes = { tastes: [], error: "Couldn't reach Hanua's server for your tastes." }; }
    renderCoach();
  }
}

// ---- the day tabs: a dot on days that have something planned ----
function renderDays() {
  $("meal-days").replaceChildren(...DAYS.map((d, i) => {
    const date = addDays(plan.week, i);
    const filled = MEALS.some((m) => plan.menu[d][m] || plan.protein[key(i, m)]);
    const b = h("button", { type: "button", role: "tab", className: `meal-day${filled ? " filled" : ""}${date === todayStr() ? " today" : ""}`,
      ariaSelected: String(i === day), textContent: fmtDay(date, { weekday: "short" }) },
      h("small", { textContent: ` ${Number(date.slice(8))}` }));
    b.addEventListener("click", () => { day = i; renderDays(); renderRows(); });
    return b;
  }));
}

// ---- one day's three meals ----
function renderRows() {
  const d = DAYS[day], date = addDays(plan.week, day);
  $("meal-day-title").textContent = fmtDay(date, { weekday: "long", day: "numeric", month: "long" });
  $("meal-rows").replaceChildren(...MEALS.map((meal) => {
    const k = key(day, meal), last = plan.lastWeek[d][meal];
    const protein = h("select", { className: "meal-protein", ariaLabel: `${meal} protein` },
      h("option", { value: "", textContent: "Protein…" }),
      PROTEINS.map((p) => h("option", { value: p.name, textContent: p.name, selected: plan.protein[k] === p.name })));
    const icon = h("span", { className: "meal-ico" }, menuIcon(proteinOf(plan.protein[k])?.icon || "hat"));
    const text = h("input", { className: "meal-text", value: plan.menu[d][meal], maxLength: 120, autocomplete: "off",
      placeholder: last ? `Last week: ${last}` : `${meal}…`, ariaLabel: `${meal}, ${fmtDay(date, { weekday: "long" })}` });
    const ask = h("button", { type: "button", className: "g-act meal-ask", textContent: "Ask Claude" });
    const ideas = h("div", { className: "meal-ideas" });
    const extra = meal === "Dinner" && day < 6
      ? h("label", { className: "meal-extra" }, h("input", { type: "checkbox", checked: plan.extra.has(d) }), " Make extra for tomorrow's lunch")
      : null;
    protein.addEventListener("change", () => {
      plan.protein[k] = protein.value;
      icon.replaceChildren(menuIcon(proteinOf(protein.value)?.icon || "hat"));
      renderDays(); renderCoach();
    });
    text.addEventListener("input", () => { plan.menu[d][meal] = text.value; renderDays(); renderCoach(); });
    text.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); row.nextElementSibling?.querySelector(".meal-text")?.focus(); } });
    extra?.querySelector("input").addEventListener("change", (e) => { e.target.checked ? plan.extra.add(d) : plan.extra.delete(d); renderCoach(); });
    ask.addEventListener("click", () => askClaude(meal, protein.value, ideas, text));
    const row = h("li", { className: "meal-row" },
      h("span", { className: "meal-name", textContent: meal }), icon, protein, text, ask, extra, ideas);
    return row;
  }));
}

// three ideas around the protein, kept to Our tastes; pick one to fill the meal
async function askClaude(meal, protein, box, text) {
  box.replaceChildren(h("p", { className: "coach-small", textContent: `Asking Claude for ${protein ? `${protein.toLowerCase()} ` : ""}ideas…` }));
  try {
    const planned = DAYS.flatMap((d) => MEALS.map((m) => plan.menu[d][m])).filter(Boolean);
    const res = await fetch("/api/menu/ideas", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal, protein, day: fmtDay(addDays(plan.week, day), { weekday: "long" }), planned }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Claude couldn't come up with ideas just now.");
    box.replaceChildren(...data.ideas.map((idea) => {
      const b = h("button", { type: "button", className: "meal-idea" }, h("b", { textContent: idea.title }), h("span", { textContent: idea.note }));
      b.addEventListener("click", () => {
        text.value = idea.title;
        text.dispatchEvent(new Event("input"));
        box.replaceChildren();
        text.focus();
      });
      return b;
    }));
  } catch (err) {
    box.replaceChildren(h("p", { className: "coach-small", textContent: err.message }));
  }
}

// ---- the coach beside the rows: Our tastes, the week's balance so far, and ideas ----
function renderCoach() {
  const m = forTips();
  const all = DAYS.flatMap((d) => MEALS.map((meal) => m[d][meal])).filter(Boolean);
  const count = (re) => all.filter((t) => re.test(t)).length;
  const fish = count(/\b(fish|salmon|snapper|prawn|tuna|seafood|sardine|terakihi|tarakihi|hoki|gurnard|trout)/i);
  const red = count(/\b(steak|beef|lamb|pork|mince|sausage|bacon|ham\b|burger|salami|chorizo)/i);
  const plants = count(/\b(bean|lentil|chickpea|dahl|tofu|tempeh|hummus)/i);
  const t = menuTips(m, { minMeals: 1, max: 3 });
  const tasteBlock = !tastes ? h("p", { className: "coach-small", textContent: "Reading your tastes from Notion…" })
    : tastes.error ? h("p", { className: "coach-small warn", textContent: tastes.error })
    : tastes.tastes.length ? h("ul", { className: "meal-tastes" }, tastes.tastes.map((x) => h("li", { textContent: x })))
    : h("p", { className: "coach-small", textContent: "Nothing under “Our tastes” in the Eating well guide yet." });
  $("meal-coach").replaceChildren(
    h("span", { className: "eyebrow", textContent: tastes?.sample ? "Our tastes (sample)" : "Our tastes" }),
    tasteBlock,
    tastes?.url ? h("a", { className: "g-act", href: tastes.url, target: "_blank", rel: "noopener", textContent: "Edit in Notion ↗" }) : null,
    h("span", { className: "eyebrow", textContent: "This week so far" }),
    h("ul", { className: "meal-balance" },
      h("li", {}, menuIcon("fish"), `Fish: ${fish} ${fish >= 2 ? "✓" : "(aim for about 2)"}`),
      h("li", {}, menuIcon("steak"), `Red meat: ${red} ${red > 3 ? "(about 3 is plenty)" : ""}`),
      h("li", {}, menuIcon("leaf"), `Beans, lentils or tofu: ${plants} ${plants ? "✓" : "(try one)"}`)),
    t.ready && (t.ideas.length || t.note) ? h("span", { className: "eyebrow", textContent: "Ideas" }) : null,
    t.ready ? h("ul", { className: "meal-coach-ideas" }, [...t.ideas, t.note].filter(Boolean).map((x) => h("li", {}, menuIcon(HABIT_ICONS[x.id] || "leaf"), h("span", { textContent: x.text })))) : null,
  );
}

// ---- Add to the board: the meals (or just the protein, if no meal was written), plus any leftovers lunches ----
function planMenu() {
  const out = menuShape(plan.menu);
  DAYS.forEach((d, i) => MEALS.forEach((meal) => { if (!out[d][meal]) out[d][meal] = plan.protein[key(i, meal)] || ""; }));
  for (const d of plan.extra) {
    const i = DAYS.indexOf(d), next = DAYS[i + 1];
    if (next && out[d].Dinner && !out[next].Lunch) out[next].Lunch = `Leftovers: ${out[d].Dinner}`.slice(0, 120);
  }
  return out;
}

$("mb-plan").addEventListener("click", openMealPlan);
$("meal-next").addEventListener("click", () => { day = (day + 1) % 7; renderDays(); renderRows(); $("meal-rows").querySelector("select")?.focus(); });
$("meal-dialog").addEventListener("close", () => {
  if ($("meal-dialog").returnValue !== "save" || !plan) return;
  const next = planMenu();
  if (JSON.stringify(next) === JSON.stringify(menuShape(plan.menu)) && !plan.extra.size && !Object.values(plan.protein).some(Boolean)) return;
  if (boardWeek().week !== plan.week) return toast("The board moved to another week, so the plan wasn't added.", true);
  applyMenu(next);
});
