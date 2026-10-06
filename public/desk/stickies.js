// Sticky notes on the desk's wall: typed here, kept on this Mac until taken down (× in the corner, with Undo)
import { stickiesUp, stickyShape, STICKY_COLOURS, STICKY_MAX, STICKY_TEXT } from "../shared/desk.js";
import { todayStr } from "../shared/dates.js";
import { $, focus, h, toast } from "../lib.js";
import { newId } from "./state.js";
import { saidUpdated, typingIn } from "../sync.js";

// ---- sticky notes on the wall: typed here, kept on this Mac until taken down (× in the corner, with Undo) ----
let stickies = [];
let stickySave = 0;
// Two Macs share one list (6 Oct 2026): the server merges each save with what's there, note by note, the later edit
// winning (`edited`), so neither Mac's notes are lost. Nothing saves until the list has really been read.
let ready = false;
export async function loadStickies(quiet = false) {
  try {
    const res = await fetch("/api/stickies");
    if (!res.ok) { if (!quiet) toast("Sticky notes are still coming from iCloud: they'll appear in a moment", true); setTimeout(() => loadStickies(true), 5000); return; }
    const next = stickyShape(await res.json());
    const changed = JSON.stringify(next) !== JSON.stringify(stickies);
    stickies = next; ready = true;
    if (changed || !quiet) renderStickies();
    if (changed && quiet) saidUpdated(toast);
  } catch { /* the server's away: none shown, and none saved */ }
}
const touch = (n) => { n.edited = new Date().toISOString(); };
function saveStickies() {
  clearTimeout(stickySave);
  if (!ready) { toast("Sticky notes can't be saved until they've arrived from iCloud", true); return; }
  stickySave = setTimeout(() => {
    stickySave = 0;
    fetch("/api/stickies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stickies) })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
        // the merged list: take in the other Mac's notes, but leave the one being typed in alone
        const merged = stickyShape(await r.json());
        if (JSON.stringify(merged) === JSON.stringify(stickies) || stickySave) return;
        const typing = typingIn($("stickies")) ? document.activeElement.closest(".desk-sticky")?.id.replace(/^sticky-/, "") : null;
        stickies = merged.map((n) => (n.id === typing ? stickies.find((x) => x.id === typing) || n : n));
        if (!typing) renderStickies();
      })
      .catch((err) => toast(`Sticky notes couldn't be saved: ${err.message}`, true));
  }, 400);
}
// the other Mac changed the notes: fetch them again, unless one is being typed in (then when Mel leaves it)
document.addEventListener("hanua:room", (e) => {
  const { kind } = e.detail || {};
  if (kind !== "all" && kind !== "stickies") return;
  if (stickySave) return; // this page's save is on its way (it comes back merged)
  if (typingIn($("stickies"))) { $("stickies").addEventListener("focusout", () => setTimeout(() => loadStickies(true), 50), { once: true }); return; }
  loadStickies(true);
});
export function renderStickies(focusId) {
  const wall = $("stickies");
  const up = stickiesUp(stickies);
  wall.hidden = focus.on; // personal: put away at work
  wall.replaceChildren(...up.map((n, i) => {
    const text = h("textarea", { className: "st-text", value: n.text, ariaLabel: "Sticky note", maxLength: STICKY_TEXT, placeholder: "Write something…", spellcheck: true });
    text.addEventListener("input", () => { const s = stickies.find((x) => x.id === n.id); if (s) { s.text = text.value; touch(s); saveStickies(); } });
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
  n.down = todayStr(); touch(n);
  saveStickies(); renderStickies();
  toast("Note taken down", false, { label: "Undo", run: () => { const s = stickies.find((x) => x.id === id); if (!s) return; s.down = null; touch(s); saveStickies(); renderStickies(); } });
}
$("add-sticky").addEventListener("click", () => {
  if (stickiesUp(stickies).length >= STICKY_MAX) return;
  const id = newId();
  stickies.push({ id, text: "", colour: STICKY_COLOURS[stickies.length % STICKY_COLOURS.length], added: todayStr(), down: null, edited: new Date().toISOString() });
  saveStickies(); renderStickies(id);
});
