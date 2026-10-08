// The archive (moved out of page.js, F6, 9 Oct 2026): earlier days' pages, read-only, and when the room was last
// backed up.
import { deskShape, planDate } from "../shared/desk.js";
import { todayStr, ymd } from "../shared/dates.js";
import { h } from "../lib.js";
import { backup, deskDay } from "./state.js";
import { renderTodo } from "./page.js";
import { loadBackup } from "../planner.js";
import { view } from "./view.js";

// the archive: earlier days, read-only
export async function openArchive(at = null) {
  view.week = null;
  view.archive = { days: [], day: null, page: null };
  loadBackup();
  renderTodo();
  try { view.archive.days = (await (await fetch("/api/desk/days")).json()).filter((d) => d < deskDay); } catch { view.archive.days = []; }
  const day = at && view.archive.days.includes(at) ? at : view.archive.days[0];
  if (day) await showArchiveDay(day); else renderTodo();
}
async function showArchiveDay(day) {
  try { view.archive.page = deskShape((await (await fetch(`/api/desk/${day}`)).json()).day); view.archive.day = day; } catch { view.archive.page = null; }
  renderTodo();
}
export function archiveEl() {
  const pick = h("ul", { className: "ar-days" }, view.archive.days.map((d) => {
    const b = h("button", { type: "button", className: `ar-day${d === view.archive.day ? " on" : ""}`, textContent: planDate(d) });
    b.addEventListener("click", () => showArchiveDay(d));
    return h("li", {}, b);
  }));
  const p = view.archive.page;
  const read = (text, done, sub = false) => h("li", { className: `ar-line${done ? " done" : ""}${sub ? " sub" : ""}` }, h("span", { className: "ar-tick", textContent: done ? "✓" : "○" }), h("span", { textContent: text }));
  const page = !p ? h("p", { className: "pl-covered", textContent: view.archive.days.length ? "Choose a day." : "No earlier days yet: yesterday's page lands here tomorrow." })
    : h("div", { className: "ar-page" }, h("p", { className: "pl-date", textContent: planDate(view.archive.day) }),
      p.closed?.well || p.closed?.hard ? h("dl", { className: "cd-said ar-said" }, p.closed.well ? [h("dt", { textContent: "Went well" }), h("dd", { textContent: p.closed.well })] : null, p.closed.hard ? [h("dt", { textContent: "Got in the way" }), h("dd", { textContent: p.closed.hard })] : null) : null,
      h("h4", { textContent: "Focuses" }), h("ol", { className: "ar-list" }, p.focus.filter(Boolean).map((f) => h("li", { textContent: f }))),
      ...p.sections.filter((s) => s.lines.some((l) => l.text)).flatMap((s) => [h("h4", { textContent: s.name || "Untitled" }), h("ul", { className: "ar-list" }, s.lines.filter((l) => l.text).map((l) => read(l.text, l.done, Boolean(l.parent))))]));
  return h("div", { className: "pl-archive" }, h("div", {}, pick, backupLine()), page);
}

// under the archive's days: when the room's data was last copied to iCloud Drive
function backupLine() {
  if (!backup || backup.off) return null;
  const when = (iso) => { const d = new Date(iso);
    return `${ymd(d) === todayStr() ? "today" : d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}`; };
  const text = backup.good ? `Backed up ${when(backup.good)}` : "Not backed up yet";
  return h("p", { className: `ar-backup${backup.warning ? " bad" : ""}`, title: backup.where ? `Copied to ${backup.where}` : "", textContent: backup.warning ? `${text}. ${backup.warning}.` : text });
}

// meetings and events for the day: a time, roughly how long, what, and whether it's work. Planned round, never over.
