// Post-its on the desk's wall (Mel, 6 Oct 2026, part E): today's focuses, one note each, so they're in sight all day
// (they took over from the Today's plan widget). They move like everything else on the desk (arrange.js) and start
// at the top right. Personal: put away at work. The reminder post-its were cut the same evening (Mel: not useful).
// Every focus reads in full and the three are one size (Mel, 6 Oct 2026): a 3×5-inch card's shape (12.7 × 7.6 cm),
// the text a little smaller when it's long, then all three a little taller together (fitFocus).
import { $, focus, h } from "../lib.js";
import { dayReady, desk } from "./state.js";
import { openPlan } from "./page.js";

const focusBox = $("focus-notes");

export function renderFocusNotes() {
  const shown = desk.focus.map((text, i) => ({ text, i })).filter((x) => x.text);
  focusBox.hidden = focus.on || !shown.length;
  focusBox.replaceChildren(...shown.map(({ text, i }) => {
    const note = h("div", { className: "post-it pi-focus", id: `focus-note-${i}`, role: "button", tabIndex: 0, title: "Open Plan my day", ariaLabel: `Focus ${i + 1}: ${text}. Open Plan my day` },
      h("span", { className: "pi-label", textContent: `Focus ${i + 1}` }), h("span", { className: "pi-text", textContent: text }));
    note.dataset.move = "note";
    note.style.setProperty("--tilt", `${[-1.6, 1.2, -0.6][i]}deg`);
    note.addEventListener("click", () => openPlan());
    note.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPlan(); } });
    return note;
  }));
  fitFocus();
}

// One size for all three, big enough for the longest: first the type steps down (to 13px), then the notes grow
// taller together (up to three times the card's height); never cut off
const MIN_FONT = 13;
export function fitFocus() {
  const notes = [...focusBox.querySelectorAll(".pi-focus")];
  if (!notes.length || !notes[0].offsetWidth) return; // not laid out (hidden): fitted when it next draws
  const base = Math.round(notes[0].offsetWidth * 0.6); // the card's own height (3 × 5 shape)
  const texts = notes.map((n) => n.querySelector(".pi-text"));
  const need = () => Math.max(...notes.map((n) => n.scrollHeight));
  for (const n of notes) { n.style.height = `${base}px`; }
  for (const t of texts) t.style.fontSize = "";
  let size = Math.round(parseFloat(getComputedStyle(texts[0]).fontSize));
  while (need() > base + 1 && size > MIN_FONT) {
    size -= 1;
    for (const t of texts) t.style.fontSize = `${size}px`;
  }
  const tall = Math.min(Math.max(base, need()), base * 3);
  for (const n of notes) n.style.height = `${tall}px`;
}
let fitTimer = 0;
addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitFocus, 120); });

document.addEventListener("hanua:plan", renderFocusNotes);
document.addEventListener("hanua:desk", (e) => { if (e.detail) fitFocus(); });
document.addEventListener("hanua:focus", renderFocusNotes);
dayReady.then(renderFocusNotes);
