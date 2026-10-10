// Projects on a timeline (v2): a bar from today to each target date (one past its date runs back to it and says so),
// Blocked shaded; drawn in percentages from shared/jump.js timelineSpan, so nothing waits on measuring the page.
// Click a project for its next action (with edits on: change its status or next action).
import { h } from "../lib.js";
import { EDITS, data } from "./store.js";
import { editProject } from "./form.js";
import { openPop } from "./pop.js";

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const shortDate = (iso) => new Date(`${iso}T00:00`).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });

export function renderTimeline(box, { openLink, toToday }) {
  const p = data.projects;
  if (p.error) return box.replaceChildren(h("span", { className: "wg-label", textContent: "Projects" }), h("p", { className: "jw-note bad", role: "status", textContent: p.error }));
  const s = p.span;
  const open = (r, from) => {
    if (EDITS) return editProject(r.id);
    openPop(from, r.title, [{ label: r.next ? `Next: ${r.next}` : "No next action recorded", sub: [r.status, r.owner ? `owner ${r.owner}` : null, r.date ? `by ${shortDate(r.date)}` : "no target date"].filter(Boolean).join(" · "), link: openLink(r.url, r.title) }]);
  };
  const rows = p.items.map((r) => {
    const bar = s.bars[r.id];
    const name = h("button", { type: "button", className: "jt-name", title: r.next ? `Next: ${r.next}` : r.title }, h("span", { textContent: r.title }), h("small", { textContent: r.status }));
    name.addEventListener("click", () => open(r, name));
    const track = h("div", { className: "jt-track" },
      bar ? (() => { const b = h("button", { type: "button", className: `jt-bar${r.status === "Blocked" ? " blocked" : ""}${bar.overdue ? " overdue" : ""}`, style: `left:${pct(bar.start)};width:${pct(Math.max(0.012, bar.end - bar.start))}`,
        title: `${r.title}: ${bar.overdue ? "was due" : "due"} ${shortDate(r.date)}`, ariaLabel: `${r.title}, ${r.status}, ${bar.overdue ? "past its date" : "due"} ${shortDate(r.date)}` },
        h("span", { textContent: bar.overdue ? "past its date" : shortDate(r.date) }));
        b.addEventListener("click", () => open(r, b)); return b; })()
        : h("span", { className: "jt-none", textContent: "no target date" }));
    return h("div", { className: `jt-row${r.status === "Blocked" ? " blocked" : ""}` }, name, track, toToday(r));
  });
  box.replaceChildren(h("span", { className: "wg-label", textContent: `Projects · ${p.items.length}${p.blocked ? ` · ${p.blocked} blocked` : ""}` }),
    p.items.length ? h("div", { className: "jt" },
      h("div", { className: "jt-scale", ariaHidden: "true" }, h("span"), h("div", { className: "jt-track" },
        s.months.map((m) => h("i", { className: "jt-month", style: `left:${pct(m.at)}`, textContent: shortDate(m.day).replace(/^1 /, "") })),
        h("i", { className: "jt-today", style: `left:${pct(s.today)}`, textContent: "today" }))),
      h("div", { className: "jt-rows jw-scroll", style: `--today:${pct(s.today)}` }, rows))
      : h("p", { className: "jw-note", textContent: "No active or blocked projects in the tracker." }));
}
