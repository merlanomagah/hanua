// Icons for the Journal's controls (Mel, 16 Oct 2026: "where it makes sense I really prefer to use icons"; Preferences,
// Settled). Line icons in the current text colour, so they follow ink / terracotta / white and dark mode. The word
// stays as the button's tip and label (title, aria-label).
const svg = (body, w = 2) => `<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.4),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 1.8),
  history: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4"/><path d="M12 8v4.5l3 2"/>', 1.8),
};
// a button drawn as an icon, its word kept for the tip and screen readers
export function iconButton(h, name, label, props = {}) {
  const b = h("button", { type: "button", title: label, ariaLabel: label, ...props });
  b.classList.add("ic-btn");
  b.innerHTML = ICONS[name];
  return b;
}
