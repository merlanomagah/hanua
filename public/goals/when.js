// "When?": a small picker in front of a date box. Most goals don't need a date (their level says roughly when),
// so "No date" comes first; quick picks fill the date with the end of that period, capped at the parent's due.
// The date box stays the value that gets saved; it only shows for "Exact date…".
import { dayOf, todayStr } from "../shared/dates.js";
import { WHEN_PICKS, whenDue, whenPickOf } from "../shared/goals.js";
import { fmtDay, h } from "../lib.js";

const short = (iso) => fmtDay(iso, { weekday: "short", day: "numeric", month: "short" });

// Wires a select to a date input. ctx: { level, parentDue }. Call refreshWhen(select, ctx) when either changes.
export function whenPicker(date, ctx) {
  const sel = h("select", { className: "when-pick", ariaLabel: "When is it due?" });
  sel.addEventListener("change", () => {
    if (sel.value === "exact") { date.hidden = false; date.focus(); return; }
    date.value = sel.value ? whenDue(sel.value, todayStr(), sel.ctx.parentDue)?.due || "" : "";
    date.hidden = true;
    date.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // a typed date that matches a pick shows as that pick; clearing it goes back to "No date"
  date.addEventListener("change", () => { if (!date.value) refreshWhen(sel, sel.ctx); });
  sel.date = date;
  refreshWhen(sel, ctx);
  return sel;
}

export function refreshWhen(sel, { level = "Task", parentDue = "" } = {}) {
  sel.ctx = { level, parentDue: dayOf(parentDue) };
  const today = todayStr();
  // once the parent's date caps a pick, later picks would land on the same day: show it once
  const seen = new Set();
  const picks = (WHEN_PICKS[level] || []).flatMap(([k, label]) => {
    const r = whenDue(k, today, sel.ctx.parentDue);
    if (seen.has(r.due)) return [];
    seen.add(r.due);
    return [h("option", { value: k, textContent: r.capped ? `By its parent's date · ${short(r.due)}` : `${label} · ${short(r.due)}` })];
  });
  sel.replaceChildren(h("option", { value: "", textContent: "No date" }), ...picks, h("option", { value: "exact", textContent: "Exact date…" }));
  const pick = whenPickOf(level, sel.date.value, today, sel.ctx.parentDue);
  sel.value = pick;
  sel.date.hidden = pick !== "exact";
}

// The one-line explanation shown beside the picker.
export function whenHint(level) {
  return level === "Task"
    ? "Most Tasks don't need a date. Pick This week, or an exact day, when you want it on your desk's Today list."
    : level === "Epic"
      ? "An Epic's date is the end of the year you're aiming for."
      : `No date is fine: it fits inside its parent. Only date it if something real depends on it.`;
}
