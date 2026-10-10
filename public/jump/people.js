// Who Mel is waiting on (v2): a bubble per person, bigger for more things, a thicker ring for a longer wait (the
// longest of theirs); click one for their items (each opening in Jump OS; with edits on, "Change" for who it waits on).
import { h } from "../lib.js";
import { EDITS, data } from "./store.js";
import { editWaiting } from "./form.js";
import { openPop } from "./pop.js";

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export function renderPeople(box, { openLink }) {
  const w = data.waiting || [];
  const bubbles = w.map((p) => {
    const n = p.items.length, ring = Math.min(4, Math.floor((p.oldest ?? 0) / 7)); // a notch a week, up to a month
    const b = h("button", { type: "button", className: `jp-bubble ring-${ring}`, style: `--n:${Math.min(n, 5)}`,
      title: `${p.who}: ${n} thing${n === 1 ? "" : "s"}, the oldest ${p.oldest ?? "?"} days`, ariaLabel: `${p.who}: ${n} waiting, the oldest ${p.oldest ?? "unknown"} days` },
      h("span", { className: "jp-face", ariaHidden: "true", textContent: initials(p.who) }),
      h("span", { className: "jp-name", textContent: p.who }),
      h("span", { className: "jp-meta", textContent: `${p.oldest ?? "–"}d${n > 1 ? ` · ${n}` : ""}` }));
    b.addEventListener("click", () => openPop(b, `Waiting on ${p.who}`, p.items.map((i) => ({
      label: i.title, sub: `${i.area === "questions" ? "Question" : "Escalation"} · ${i.age ?? "–"} days`,
      ...(EDITS ? { run: () => editWaiting(i.area, i.id) } : { link: openLink(i.url, i.title) }),
    }))));
    return b;
  });
  box.replaceChildren(h("span", { className: "wg-label", textContent: "Waiting on" }),
    w.length ? h("div", { className: "jp-bubbles jw-scroll" }, bubbles) : h("p", { className: "jw-note", textContent: "No one named as holding things up." }),
    w.length ? h("p", { className: "jw-key", textContent: "Bigger: more things · thicker ring: a longer wait" }) : null);
}
