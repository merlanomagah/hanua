// A small menu that opens from a desk file (16 Oct 2026: the Journal's entry types), in the desk's own menu style
// (.wg-menu). The first item is focused, so double-click then Enter does the usual thing; ↑ ↓ move, Esc or a click
// elsewhere closes it, and focus goes back to the file. items: [{ label, sub?, run }]
import { h } from "../lib.js";

let open = null; // { el, from }
export function closeFileMenu() {
  if (!open) return false;
  const { el, from } = open;
  open = null;
  el.remove();
  from?.focus?.({ preventScroll: true });
  return true;
}
export function openFileMenu(from, title, items) {
  closeFileMenu();
  const host = from.closest(".txt-win, .desk") || document.body; // inside a window: above it
  const el = h("div", { className: "wg-menu file-menu", role: "menu", ariaLabel: title },
    items.map((it) => {
      const b = h("button", { type: "button", role: "menuitem" }, h("span", { className: "fm-label", textContent: it.label }), it.sub ? h("small", { className: "fm-sub", textContent: it.sub }) : null);
      b.addEventListener("click", () => { closeFileMenu(); it.run(); });
      return b;
    }));
  host.append(el);
  // beside the file, kept on the desk (a phone: under it)
  const hb = host.getBoundingClientRect(), fb = from.getBoundingClientRect();
  const left = Math.max(8, Math.min(fb.right - hb.left + 6, host.clientWidth - el.offsetWidth - 8));
  const top = Math.max(8, Math.min(fb.top - hb.top, host.clientHeight - el.offsetHeight - 8));
  el.style.left = `${fb.right - hb.left + 6 + el.offsetWidth > host.clientWidth - 8 ? Math.max(8, fb.left - hb.left - el.offsetWidth - 6) : left}px`;
  el.style.top = `${top}px`;
  open = { el, from };
  el.querySelector("button")?.focus({ preventScroll: true });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFileMenu(); return; }
    if (e.key === "Tab") { closeFileMenu(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = [...el.querySelectorAll("button")], i = all.indexOf(document.activeElement);
    e.preventDefault();
    all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus();
  });
}
document.addEventListener("pointerdown", (e) => { if (open && !open.el.contains(e.target) && !open.from.contains(e.target)) closeFileMenu(); }, true);
