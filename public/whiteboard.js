// The menu whiteboard on the wall, under the TV: a week of meals, typed into the boxes in marker ink.
// The days and dates fill in by themselves; each week is saved on this Mac as you type, and past weeks are kept
// (‹ and ›). Eating well ✦ opens gentle tips matched against what's typed (rules: public/shared/menu.js).
// At work it's covered: the menu is personal.
// A probe (5 Oct 2026; drawing swapped for typing 6 Oct after Mel found it finicky): if no week gets filled in
// by about 26 Oct, it goes on the cut list.
import { addDays, parseDay, todayStr, weekStart } from "./shared/dates.js";
import { DAYS, MEALS, PLATE, menuShape, menuTips } from "./shared/menu.js";
import { $, focus, fmtDay, h, toast } from "./lib.js";

let week = weekStart();
let menu = menuShape({});
let loaded = "", saveTimer = 0, dirty = false;
let drawnWeeks = new Set(), guideUrl = null;
let tipsOpen = false;
try { tipsOpen = localStorage.getItem("menu-tips") === "1"; } catch { /* no storage: tips start closed */ }

export async function loadWhiteboard() {
  // weeks drawn by hand before the menu was typed: still viewable, read-only
  try { drawnWeeks = new Set((await (await fetch("/api/board")).json()).weeks || []); } catch { /* none */ }
  renderWhiteboard();
}

// the days down the side, today's row marked, and the week's name
export function renderWhiteboard() {
  const covered = focus.on;
  $("mb-cover").hidden = !covered;
  $("menu-board").classList.toggle("covered", covered);
  if (covered) { flush(); loaded = ""; menu = menuShape({}); }
  const today = todayStr();
  $("mb-week").textContent = week === weekStart() ? `This week · from ${fmtDay(week, { day: "numeric", month: "short" })}`
    : `Week of ${fmtDay(week, { day: "numeric", month: "short", year: parseDay(week).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}`;
  $("mb-this").hidden = week === weekStart();
  const drawn = $("mb-drawn");
  drawn.hidden = covered || !drawnWeeks.has(week);
  drawn.href = `/api/board/${week}`;
  // keep typing where it is when the board redraws (the minute tick re-renders it)
  const active = document.activeElement?.closest?.("#mb-grid") ? document.activeElement.dataset.cell : null;
  $("mb-grid").replaceChildren(h("span", { className: "mb-corner" }),
    ...MEALS.map((m) => h("span", { className: "mb-meal", textContent: m })),
    ...DAYS.flatMap((key, i) => {
      const d = addDays(week, i), isToday = d === today;
      return [
        h("span", { className: `mb-day${isToday ? " today" : ""}` }, h("b", { textContent: fmtDay(d, { weekday: "short" }) }), ` ${parseDay(d).getDate()}`),
        ...MEALS.map((m) => {
          const input = h("input", { type: "text", className: `mb-cell${isToday ? " today" : ""}`, value: menu[key][m], title: menu[key][m], maxLength: 120, disabled: covered, autocomplete: "off", spellcheck: true,
            ariaLabel: `${m}, ${fmtDay(d, { weekday: "long", day: "numeric", month: "long" })}` });
          input.dataset.cell = `${key}.${m}`;
          input.addEventListener("input", () => { menu[key][m] = input.title = input.value; scheduleSave(); renderTips(); });
          input.addEventListener("keydown", (e) => moveFocus(e, i, MEALS.indexOf(m)));
          return input;
        }),
      ];
    }));
  if (active) document.querySelector(`#mb-grid [data-cell="${active}"]`)?.focus();
  renderTips();
  if (!covered && loaded !== week) loadWeek(week);
}

// Enter goes down a day (like a spreadsheet), arrows up/down move between days
function moveFocus(e, day, meal) {
  const step = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
  if (!step || e.isComposing) return;
  const next = document.querySelector(`#mb-grid [data-cell="${DAYS[day + step]}.${MEALS[meal]}"]`);
  if (!next) return;
  e.preventDefault();
  next.focus();
  next.select();
}

async function loadWeek(w) {
  loaded = w;
  try {
    const res = await fetch(`/api/menu/${w}`);
    if (!res.ok || loaded !== w) return;
    const data = await res.json();
    guideUrl = data.guideUrl || null;
    if (loaded === w && !dirty) { menu = menuShape(data); renderWhiteboard(); }
  } catch { /* the server's away: the boxes stay empty */ }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}
async function save() {
  clearTimeout(saveTimer);
  if (!dirty || focus.on || loaded !== week) return;
  dirty = false;
  try {
    const res = await fetch(`/api/menu/${week}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(menu), keepalive: true });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "The menu couldn't be saved");
  } catch (err) { dirty = true; toast(err.message, true); }
}
const flush = () => { if (dirty) save(); };
// don't lose the last few letters when the page closes
window.addEventListener("pagehide", flush);

$("mb-clear").addEventListener("click", () => {
  if (focus.on) return;
  const before = menuShape(menu);
  if (!Object.values(before).some((d) => Object.values(d).some(Boolean))) return toast("The board's already clean.");
  menu = menuShape({});
  scheduleSave();
  renderWhiteboard();
  toast("Board wiped.", false, { label: "Undo", run: () => { menu = before; scheduleSave(); renderWhiteboard(); } });
});

// ---- eating well: the plate, what's already there, and a couple of ideas ----
function renderTips() {
  const box = $("mb-tips"), btn = $("mb-tips-btn");
  const show = tipsOpen && !focus.on;
  box.hidden = !show;
  btn.setAttribute("aria-expanded", String(show));
  if (!show) return;
  const t = menuTips(menu);
  const guide = guideUrl ? h("a", { href: guideUrl, target: "_blank", rel: "noopener", className: "mb-guide", textContent: "Why these? The Eating well guide ↗" }) : null;
  box.replaceChildren(
    h("div", { className: "mb-plate" },
      h("h3", { textContent: "A good plate" }),
      h("ul", {}, PLATE.map((p) => h("li", {}, h("b", { textContent: p.part }), ` ${p.what}`)))),
    h("div", { className: "mb-ideas" },
      t.ready ? [
        t.wins.length ? h("h3", { textContent: "Already in your week" }) : null,
        t.wins.length ? h("ul", { className: "wins" }, t.wins.map((w) => h("li", { textContent: w.text }))) : null,
        t.ideas.length || t.note ? h("h3", { textContent: "Ideas" }) : null,
        h("ul", { className: "ideas" }, [...t.ideas, t.note].filter(Boolean).map((x) => h("li", { textContent: x.text }))),
      ] : h("p", { className: "quiet", textContent: "Type a few meals and ideas for the week will show here." }),
      guide));
}
$("mb-tips-btn").addEventListener("click", () => {
  tipsOpen = !tipsOpen;
  try { localStorage.setItem("menu-tips", tipsOpen ? "1" : "0"); } catch { /* fine */ }
  renderTips();
});

// ---- other weeks: last week's menu stays, next week can be planned ahead ----
async function goWeek(w) {
  if (dirty) await save();
  week = w;
  menu = menuShape({});
  renderWhiteboard();
}
$("mb-prev").addEventListener("click", () => goWeek(addDays(week, -7)));
$("mb-next").addEventListener("click", () => goWeek(addDays(week, 7)));
$("mb-this").addEventListener("click", () => goWeek(weekStart()));

// a new week starts a clean board by itself (checked each minute while Hanua is open)
let shownWeek = weekStart();
setInterval(() => {
  const now = weekStart();
  if (now !== shownWeek) { const was = shownWeek; shownWeek = now; if (week === was) goWeek(now); else renderWhiteboard(); }
  else if (!document.activeElement?.closest?.("#mb-grid")) renderWhiteboard(); // today's row moves at midnight
}, 60_000);
