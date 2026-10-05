// Post-its on the desk's wall (Mel, 6 Oct 2026, part E): today's focuses, one note each, so they're in sight all day
// (they took over from the Today's plan widget), and reminders due today or overdue from Apple Reminders (read
// fresh each time the desk shows; ticking one completes it there, with Undo). Both move like everything else on the
// desk (arrange.js) and start at the top right. Personal: put away at work.
import { $, focus, h, toast } from "../lib.js";
import { desk, dayReady } from "./state.js";
import { openPlan } from "./page.js";

const focusBox = $("focus-notes"), remBox = $("rem-notes");

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
}

// ---- reminders due today or overdue ----
let reminders = [];
const post = async (url, body) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j;
};
const noteId = (id) => `rem-${String(id).replace(/[^\w-]/g, "").slice(-34)}`;
function whenText(due) {
  const today = new Date(), d = new Date(due.length > 10 ? due : `${due}T00:00`);
  const sameDay = d.toDateString() === today.toDateString();
  const time = due.length > 10 ? d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" }) : "";
  if (sameDay) return time ? `Today · ${time}` : "Today";
  return `Overdue · ${d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })}`;
}
export async function loadReminderNotes() {
  if (focus.on) { remBox.hidden = true; return; }
  try { reminders = (await (await fetch("/api/reminders/due")).json()).items || []; } catch { reminders = []; }
  renderReminderNotes();
}
function renderReminderNotes() {
  remBox.hidden = focus.on || !reminders.length;
  remBox.replaceChildren(...reminders.map((r, i) => {
    const tick = h("button", { type: "button", className: "pn-tick", ariaLabel: `Done: ${r.title}`, title: "Done (ticks it in Reminders)" });
    tick.addEventListener("click", async (e) => {
      e.stopPropagation();
      reminders = reminders.filter((x) => x !== r); renderReminderNotes();
      try {
        await post(`/api/reminders/${encodeURIComponent(r.id)}/done`, { done: true });
        toast(`Done: ${r.title}`, false, { label: "Undo", run: async () => { await post(`/api/reminders/${encodeURIComponent(r.id)}/done`, { done: false }).catch(() => {}); loadReminderNotes(); } });
      } catch (err) { toast(err.message, true); loadReminderNotes(); }
    });
    const overdue = !whenText(r.due).startsWith("Today");
    const note = h("div", { className: `post-it pi-rem${overdue ? " overdue" : ""}`, id: noteId(r.id), ariaLabel: `Reminder: ${r.title}, ${whenText(r.due)}` },
      h("span", { className: "pi-label", textContent: whenText(r.due) }), h("span", { className: "pi-text", textContent: r.title }), tick);
    note.dataset.move = "note";
    note.style.setProperty("--tilt", `${[1.4, -1.1, 0.7, -1.8][i % 4]}deg`);
    return note;
  }));
}

document.addEventListener("hanua:plan", renderFocusNotes);
document.addEventListener("hanua:reminders", loadReminderNotes);
document.addEventListener("hanua:desk", (e) => { if (e.detail) loadReminderNotes(); });
document.addEventListener("hanua:focus", () => { renderFocusNotes(); loadReminderNotes(); });
setInterval(() => { if (!document.hidden) loadReminderNotes(); }, 5 * 60_000);
dayReady.then(renderFocusNotes);
loadReminderNotes();
