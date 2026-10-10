// A small menu or card that opens beside a button on the Jump Dashboard (v2): Move to…, a person's items, the questions.
// One at a time; Esc, a click elsewhere or picking something closes it, and focus goes back to the button.
import { h } from "../lib.js";

let open = null; // { el, from }
export const popOpen = () => Boolean(open);
export function closePop() {
  if (!open) return false;
  const { el, from } = open;
  open = null;
  el.remove();
  from?.focus?.({ preventScroll: true });
  return true;
}
// items: [{ label, run, sub?, link? }] or a ready element
export function openPop(from, title, items) {
  closePop();
  const pane = from.closest("#jump-pane") || document.body;
  const body = Array.isArray(items) ? h("ul", { className: "jp-menu", role: "menu" }, items.map((it) => h("li", { role: "none" },
    it.run ? (() => { const b = h("button", { type: "button", role: "menuitem", className: "jp-item" }, h("span", { textContent: it.label }), it.sub ? h("small", { textContent: it.sub }) : null);
      b.addEventListener("click", () => { closePop(); it.run(); }); return b; })()
      : h("div", { className: "jp-item static" }, h("span", { textContent: it.label }), it.sub ? h("small", { textContent: it.sub }) : null, it.link || null)))) : items;
  const el = h("div", { className: "jw-pop", role: "dialog", ariaLabel: title }, h("span", { className: "wg-label", textContent: title }), body);
  pane.append(el);
  // beside the button, kept inside the pane
  const p = pane.getBoundingClientRect(), b = from.getBoundingClientRect();
  const left = Math.min(Math.max(8, b.left - p.left), p.width - el.offsetWidth - 8);
  const below = b.bottom - p.top + 6, above = b.top - p.top - el.offsetHeight - 6;
  el.style.left = `${left}px`;
  el.style.top = `${below + el.offsetHeight > p.height - 8 && above > 8 ? above : below}px`;
  open = { el, from };
  el.querySelector("button, a")?.focus({ preventScroll: true });
  el.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const all = [...el.querySelectorAll("button, a")], i = all.indexOf(document.activeElement);
    if (!all.length) return;
    ev.preventDefault();
    all[(i + (ev.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus();
  });
}
document.addEventListener("pointerdown", (ev) => { if (open && !open.el.contains(ev.target) && !open.from.contains(ev.target)) closePop(); }, true);
