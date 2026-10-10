// The escalations board (v2): a column per status, cards oldest first, how long each has been open as a bar on the
// card (full at two weeks). With edits on (release B), a card is dragged to another column or moved with its status
// button (the keyboard's and the phone's way); dropping on Closed opens the small window that asks for the Finding.
import { h } from "../lib.js";
import { EDITS, change, data } from "./store.js";
import { addEscalation, closeEscalation, editWaiting } from "./form.js";
import { openPop } from "./pop.js";

const daysText = (n) => (n == null ? "–" : n === 0 ? "today" : `${n}d`);
const person = (r) => (r.waitingOn ? r.waitingOn.split(/[,:;(]| - /)[0].trim() : null);

export function renderBoard(box, { toToday, openLink }) {
  const e = data.escalations;
  if (e.error) return box.replaceChildren(h("span", { className: "wg-label", textContent: "Escalations" }), h("p", { className: "jw-note bad", role: "status", textContent: e.error }));
  const closedStatus = e.columns.at(-1).status;
  const move = (r, to) => (to === closedStatus ? closeEscalation(r.id) : change("escalations", r.id, { status: to }, `${r.title}: ${to}`));
  const card = (r, col) => {
    const el = h("article", { className: `jc${col.closed ? " done" : ""}`, tabIndex: -1, ariaLabel: `${r.title}, ${r.status}, ${daysText(r.age)} open` },
      h("div", { className: "jc-top" },
        h("span", { className: `jw-tier t-${(r.tier || "other").toLowerCase()}`, textContent: r.tier || "–", title: r.tier ? `Tier: ${r.tier}` : "No tier recorded" }),
        col.closed ? h("span", { className: "jc-tick", textContent: "✓", title: `Closed ${r.closed || ""}` }) : null,
        EDITS && !col.closed ? (() => { const b = h("button", { type: "button", className: "jc-move", textContent: "Move ▸", title: "Move it on", ariaLabel: `Move “${r.title}” on` });
          b.addEventListener("click", () => openPop(b, "Move to", e.columns.filter((c) => c.status !== r.status && !c.other).map((c) => ({ label: c.short === c.status ? c.status : `${c.short} · ${c.status}`, run: () => move(r, c.status) }))));
          return b; })() : null,
        openLink(r.url, r.title)),
      h("span", { className: "jc-title", textContent: r.title, title: r.title }),
      col.closed ? null : h("span", { className: "jc-age", style: `--fill:${r.fill}`, title: r.age == null ? "No raised date" : `Open ${r.age} day${r.age === 1 ? "" : "s"}` }, h("i"), h("b", { textContent: daysText(r.age) })),
      h("div", { className: "jc-foot" },
        person(r) ? (EDITS && !col.closed ? (() => { const b = h("button", { type: "button", className: "jc-wait", textContent: `⏳ ${person(r)}`, title: `Waiting on: ${r.waitingOn} (change)` }); b.addEventListener("click", () => editWaiting("escalations", r.id)); return b; })()
          : h("span", { className: "jc-wait", textContent: `⏳ ${person(r)}`, title: `Waiting on: ${r.waitingOn}` })) : null,
        col.closed ? null : toToday(r)));
    el.dataset.id = r.id;
    if (EDITS && !col.closed) {
      el.draggable = true;
      el.addEventListener("dragstart", (ev) => { ev.dataTransfer.setData("text/plain", r.id); ev.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("dragging"));
    }
    return el;
  };
  const cols = e.columns.map((col) => {
    const list = h("div", { className: "jb-list jw-scroll" }, col.items.length ? col.items.map((r) => card(r, col)) : h("p", { className: "jb-empty", textContent: col.closed ? "None closed this week" : "—" }));
    const sec = h("section", { className: `jb-col${col.closed ? " closed" : ""}`, ariaLabel: `${col.status}: ${col.items.length}` },
      h("h4", { className: "jb-head", title: col.status }, h("span", { textContent: col.closed ? `${col.short} this week` : col.short }), h("b", { textContent: col.items.length })), list);
    if (EDITS && !col.other) {
      sec.addEventListener("dragover", (ev) => { ev.preventDefault(); sec.classList.add("over"); });
      sec.addEventListener("dragleave", (ev) => { if (!sec.contains(ev.relatedTarget)) sec.classList.remove("over"); });
      sec.addEventListener("drop", (ev) => {
        ev.preventDefault(); sec.classList.remove("over");
        const r = e.columns.flatMap((c) => c.items).find((x) => x.id === ev.dataTransfer.getData("text/plain"));
        if (r && r.status !== col.status) move(r, col.status);
      });
    }
    return sec;
  });
  const addBtn = h("button", { type: "button", className: "b-btn jb-add", textContent: "+ Escalation", title: "Add an escalation to Jump OS" });
  addBtn.addEventListener("click", addEscalation);
  box.replaceChildren(
    h("div", { className: "jb-headrow" }, h("span", { className: "wg-label", textContent: `Escalations · ${e.open} open` }), addBtn),
    e.open || e.closedThisWeek ? h("div", { className: "jb-cols jb-scroll" }, cols)
      : h("p", { className: "jw-note", textContent: "No escalations recorded in Jump OS yet. + Escalation puts the next one there as it comes in." }));
}
