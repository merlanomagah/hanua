// The day picker (Mel, 8 Oct 2026; brief docs/plans/2026-10-add-to-another-day.md): a small two-week calendar, this
// week and next (Monday first, past days greyed, today marked), plus "A date…" for anything later. Used by To-do.txt's
// When, a line's → in Plan my day and the bulk bar's Move to…. Arrow keys move between days, Enter picks, Esc closes.
import { h } from "../lib.js";
import { todayStr, parseDay } from "../shared/dates.js";
import { pickerDays, stepDay } from "../shared/desk.js";

let open = null; // { el, close }

// anchor: the control it opens from (focus goes back there); onPick(day); current: the day already chosen (marked);
// not: a day that can't be picked (the page's own day, when sending away from it)
export function openDayPicker(anchor, { onPick, current = null, not = null, title = "Which day?" } = {}) {
  closeDayPicker();
  const today = todayStr();
  const days = pickerDays(today);
  const pick = (day) => { closeDayPicker(); onPick(day); };
  const btns = days.map(({ day, past, today: isToday }) => {
    const d = parseDay(day);
    const b = h("button", { type: "button", className: `dp-day${isToday ? " today" : ""}${day === current ? " on" : ""}`, disabled: past || day === not,
      textContent: String(d.getDate()), ariaLabel: `${d.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}${isToday ? ", today" : ""}` });
    b.dataset.day = day;
    b.addEventListener("click", () => pick(day));
    return b;
  });
  const later = h("input", { type: "date", className: "dp-later", ariaLabel: "A later day", min: stepDay(today, 14) });
  later.addEventListener("change", () => { if (later.value) pick(later.value); });
  const names = ["M", "T", "W", "T", "F", "S", "S"].map((n) => h("span", { className: "dp-wd", textContent: n, ariaHidden: "true" }));
  const month = parseDay(days[0].day).toLocaleDateString("en-NZ", { month: "long" }), month2 = parseDay(days[13].day).toLocaleDateString("en-NZ", { month: "long" });
  const el = h("div", { className: "dp", role: "dialog", ariaLabel: title },
    h("div", { className: "dp-head" }, h("span", { className: "dp-title", textContent: title }), h("span", { className: "dp-month", textContent: month === month2 ? month : `${month} – ${month2}` })),
    h("div", { className: "dp-grid" }, ...names, ...btns),
    h("label", { className: "dp-row" }, h("span", { textContent: "Later:" }), later));
  (anchor.closest("dialog") || document.body).append(el); // inside Plan my day's window when it's from there (above it)
  // under the control, kept on screen
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, ht = el.offsetHeight;
  const left = Math.max(8, Math.min(innerWidth - w - 8, r.left));
  const top = r.bottom + ht + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - ht - 6);
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDayPicker(true); return; }
    const i = btns.indexOf(document.activeElement);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    for (let j = i + step; j >= 0 && j < btns.length; j += step) if (!btns[j].disabled) { btns[j].focus(); break; }
  });
  const away = (e) => { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closeDayPicker(); };
  setTimeout(() => document.addEventListener("pointerdown", away, true));
  open = { el, close: (back) => { document.removeEventListener("pointerdown", away, true); el.remove(); if (back && anchor.isConnected) anchor.focus({ preventScroll: true }); } };
  (btns.find((b) => b.dataset.day === current && !b.disabled) || btns.find((b) => !b.disabled))?.focus();
}
export function closeDayPicker(back = false) { const o = open; open = null; o?.close(back); }
