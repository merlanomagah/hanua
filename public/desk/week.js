// The two weeks (moved out of page.js, F6, 9 Oct 2026): this week and next as cards with each day's first tasks; a
// click opens a day's page (earlier days open in the archive). goDay opens any day's page in the window.
import { daySummary, planDate, weekDays } from "../shared/desk.js";
import { parseDay, todayStr } from "../shared/dates.js";
import { $, h, toast } from "../lib.js";
import { ensureApple } from "../app.js";
import { desk as todayDesk, page as desk, pageDay, showDay } from "./state.js";
import { clearPicks, renderTodo, resetSweep } from "./page.js";
import { openArchive } from "./archive.js";
import { view } from "./view.js";

// ---- the week (Mel, 6 Oct 2026: double-click Plan my day, see the week, click the day to plan) ----
// Mon–Sun with what each day holds; ‹ › for other weeks; past days open in the Archive (read-only), today and days
// ahead open their page. Days further ahead that already have something written are listed underneath.
export async function openWeek(shift = 0) {
  view.archive = null;
  const days = [...weekDays(todayStr(), shift), ...weekDays(todayStr(), shift + 1)]; // two weeks: this and next (8 Oct 2026)
  view.week = { shift, days, sums: view.week?.shift === shift ? view.week.sums : {}, further: view.week?.further || [] };
  renderTodo();
  const mine = view.week;
  try {
    const sums = await (await fetch(`/api/desk/summary?days=${days.join(",")}`)).json();
    // further ahead: any day after this week (and after today) with something on it, the next eight
    const all = await (await fetch("/api/desk/days")).json();
    const later = all.filter((d) => d > days[13] && d > todayStr()).sort().slice(0, 20);
    const more = later.length ? await (await fetch(`/api/desk/summary?days=${later.join(",")}`)).json() : {};
    if (view.week !== mine) return;
    view.week.sums = sums;
    view.week.further = later.filter((d) => more[d]?.written).slice(0, 8).map((d) => ({ day: d, sum: more[d] }));
  } catch { if (view.week === mine) view.week.failed = true; }
  if (view.week === mine) renderTodo();
}
export function weekEl() {
  const today = todayStr();
  // the days open here are drawn from what's on the page now, not the last save
  const sumOf = (d) => (d === today ? daySummary(todayDesk, d) : d === pageDay ? daySummary(desk, d) : view.week.sums[d]);
  const sumText = (x, past) => {
    if (!x) return [view.week.failed ? "Couldn't read" : past ? "" : "…"];
    if (!x.written) return [past ? "Nothing written" : "Nothing yet"];
    const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
    return [x.focus ? plural(x.focus, "focus", "focuses") : null,
      x.tasks || x.done ? `${plural(x.tasks + x.done, "task")}${x.done ? ` · ${x.done} done` : ""}` : null,
      x.meetings ? plural(x.meetings, "meeting") : null].filter(Boolean);
  };
  const card = (d) => {
    const past = d < today, x = sumOf(d);
    const b = h("button", { type: "button", className: `wk-day${d === today ? " today" : ""}${past ? " past" : ""}${x?.written ? " written" : ""}${x?.locked ? " locked" : ""}`,
      ariaLabel: `${planDate(d)}${d === today ? ", today" : ""}: ${sumText(x, past).join(", ")}${past ? " (opens in the Archive)" : ""}` },
      h("span", { className: "wk-name", textContent: parseDay(d).toLocaleDateString("en-NZ", { weekday: "short" }) }),
      h("span", { className: "wk-date", textContent: parseDay(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) }),
      d === today ? h("span", { className: "wk-tag", textContent: "Today" }) : null,
      h("span", { className: "wk-sum" }, sumText(x, past).map((t) => h("span", { textContent: t }))),
      !past && x?.titles?.length ? h("ul", { className: "wk-titles" }, x.titles.map((t) => h("li", { textContent: t }))) : null,
      x?.closed ? h("span", { className: "wk-lock wk-closed", textContent: "Closed ✓" }) : x?.locked ? h("span", { className: "wk-lock", textContent: "Locked in" }) : !past && !x?.written ? h("span", { className: "wk-go", textContent: "Plan this day →" }) : null);
    b.addEventListener("click", () => (past ? openArchive(d) : goDay(d)));
    return b;
  };
  const nav = (label, step, aria) => { const b = h("button", { type: "button", className: "ip-nav wk-nav", textContent: label, ariaLabel: aria }); b.addEventListener("click", () => openWeek(view.week.shift + step)); return b; };
  const first = parseDay(view.week.days[0]), last = parseDay(view.week.days[13]);
  const span = `${first.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`;
  const thisWeek = view.week.shift ? (() => { const b = h("button", { type: "button", className: "pw-btn", textContent: "This week" }); b.addEventListener("click", () => openWeek(0)); return b; })() : null;
  const further = view.week.further.length ? h("div", { className: "wk-further" }, h("h4", { textContent: "Also planned ahead" }),
    h("ul", {}, view.week.further.map(({ day: d, sum }) => { const b = h("button", { type: "button", className: "wk-chip", textContent: `${planDate(d)} · ${sumText(sum).join(", ")}` }); b.addEventListener("click", () => goDay(d)); return h("li", {}, b); }))) : null;
  return h("div", { className: "pl-week" },
    h("header", { className: "wk-head" }, nav("‹", -1, "Week before"), h("div", { className: "wk-title" }, h("h2", { textContent: view.week.shift === 0 ? "This week and next" : view.week.shift === -1 ? "Last week and this" : "Two weeks" }), h("span", { textContent: span })), nav("›", 1, "Week after"), thisWeek),
    h("div", { className: "wk-grid" }, view.week.days.map(card)),
    h("p", { className: "wk-hint", textContent: "Click a day to plan it. Earlier days open in the Archive. To put a task on a day without opening it: → on a line, or When in To-do.txt." }),
    further);
}
// Open a day's page (today, or a day ahead) in the window
export async function goDay(day) {
  view.archive = null; view.week = null; clearPicks(); resetSweep();
  const ok = await showDay(day);
  if (!ok && day > todayStr()) toast(`Couldn't open ${planDate(day)} just now: try again in a moment.`, true);
  if (day > todayStr()) ensureApple(day); // that day's calendar, for Save & plan
  renderTodo();
  $("todo").querySelector(".pl-focus .pl-input")?.focus({ preventScroll: true });
}

