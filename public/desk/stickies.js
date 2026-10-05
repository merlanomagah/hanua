// Sticky notes on the desk's wall: typed here, kept on this Mac until taken down (× in the corner, with Undo)
import { stickiesUp, stickyShape, STICKY_COLOURS, STICKY_MAX, STICKY_TEXT } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { newId } from "./state.js";

// ---- sticky notes on the wall: typed here, kept on this Mac until taken down (× in the corner, with Undo) ----
let stickies = [];
let stickySave = 0;
export async function loadStickies() {
  try { stickies = stickyShape(await (await fetch("/api/stickies")).json()); } catch { stickies = []; }
  renderStickies();
}
function saveStickies() {
  clearTimeout(stickySave);
  stickySave = setTimeout(() => fetch("/api/stickies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stickies) })
    .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); })
    .catch((err) => toast(`Sticky notes couldn't be saved: ${err.message}`, true)), 400);
}
export function renderStickies(focusId) {
  const wall = $("stickies");
  const up = stickiesUp(stickies);
  wall.hidden = focus.on; // personal: put away at work
  wall.replaceChildren(...up.map((n, i) => {
    const text = h("textarea", { className: "st-text", value: n.text, ariaLabel: "Sticky note", maxLength: STICKY_TEXT, placeholder: "Write something…", spellcheck: true });
    text.addEventListener("input", () => { const s = stickies.find((x) => x.id === n.id); if (s) { s.text = text.value; saveStickies(); } });
    const x = h("button", { type: "button", className: "st-x", ariaLabel: "Take this note down", title: "Take it down", textContent: "×" });
    x.addEventListener("click", () => takeDown(n.id));
    const note = h("div", { className: `desk-sticky st-${n.colour}`, id: `sticky-${n.id}`, style: `--tilt:${[-2.5, 1.8, -1, 2.6, -1.8, 1.2][i % 6]}deg` }, x, text);
    note.dataset.move = "note"; // moves on the desk's grid (arrange.js); drag it by its edge, not its text
    if (n.id === focusId) requestAnimationFrame(() => text.focus());
    return note;
  }));
  $("add-sticky").disabled = up.length >= STICKY_MAX;
  $("add-sticky").title = up.length >= STICKY_MAX ? "The wall's full: take one down first" : "Add a sticky note to the wall";
}
function takeDown(id) {
  const n = stickies.find((x) => x.id === id);
  if (!n) return;
  n.down = todayStr();
  saveStickies(); renderStickies();
  toast("Note taken down", false, { label: "Undo", run: () => { n.down = null; saveStickies(); renderStickies(); } });
}
$("add-sticky").addEventListener("click", () => {
  if (stickiesUp(stickies).length >= STICKY_MAX) return;
  const id = newId();
  stickies.push({ id, text: "", colour: STICKY_COLOURS[stickies.length % STICKY_COLOURS.length], added: todayStr(), down: null });
  saveStickies(); renderStickies(id);
});
