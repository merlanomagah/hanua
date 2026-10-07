// A time you type (Mel, 8 Oct 2026: Safari's own time box showed its placeholder and our "Time" over what she typed):
// a plain box that reads "930", "2pm" or "14:00" when you leave it (or press Enter) and shows it as "9:30 am".
// Something it can't read goes back to what was there, with a red flash. Rules: parseTime / timeText (shared/desk.js).
import { h } from "../lib.js";
import { parseTime, timeText } from "../shared/desk.js";

// value: "HH:MM" or ""; onSet("HH:MM" | ""): only when it changed; blank: may it be emptied (else it keeps its time);
// enterSubmits: Enter also does what Enter does in its form (the New event window saves), after the time is read
// lean: "auto" | "am" | "pm", which half of the day a bare "6" is (parseTime)
export function timeField(value, { label, onSet, blank = true, placeholder = "Time", className = "", enterSubmits = false, lean = "auto" } = {}) {
  let now = value || "";
  const box = h("input", { type: "text", className: `pl-time pl-ttext ${className}`.trim(), value: timeText(now), placeholder, ariaLabel: label,
    inputMode: "text", autocomplete: "off", spellcheck: false, maxLength: 9, title: "Type a time: 930, 2pm or 14:00" });
  const take = () => {
    const typed = box.value.trim();
    if (!typed) {
      if (!blank) { box.value = timeText(now); return; }
      if (now) { now = ""; onSet?.(""); }
      return;
    }
    const t = parseTime(typed, lean);
    if (!t) { box.value = timeText(now); box.classList.remove("bad"); void box.offsetWidth; box.classList.add("bad"); return; }
    box.value = timeText(t);
    if (t !== now) { now = t; onSet?.(t); }
  };
  box.addEventListener("blur", take);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { take(); if (!enterSubmits) { e.preventDefault(); box.select(); } } });
  box.addEventListener("focus", () => box.select());
  box.get = () => { take(); return now; }; // forms (Up next, New event) read it on Save
  box.set = (t) => { now = t || ""; box.value = timeText(now); box.classList.remove("bad"); }; // set from outside (the end moving with the start)
  return box;
}
