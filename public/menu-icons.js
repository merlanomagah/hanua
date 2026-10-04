// Little line drawings for the menu board: a chef's hat by the title, and one per habit, tip and protein.
// Drawn in the current text colour (ink or terracotta), like the goals' level symbols (goals/icons.js).
const PATHS = {
  hat: '<path d="M6 17h12v3H6z"/><path d="M7 17v-4a4 4 0 0 1-1-7.6A4.5 4.5 0 0 1 12 3a4.5 4.5 0 0 1 6 2.4A4 4 0 0 1 17 13v4"/><path d="M10 13v4M14 13v4"/>',
  fish: '<path d="M3 12c3-5 9-6 13-2l4-3v10l-4-3c-4 4-10 3-13-2z"/><circle cx="8" cy="11" r=".9" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19 13 11"/>',
  grain: '<path d="M12 21V8"/><path d="M12 8c-2-1-3-3-3-5 2 0 3 2 3 5zM12 8c2-1 3-3 3-5-2 0-3 2-3 5z"/><path d="M12 13c-2-1-4-2-4-5 2 0 4 2 4 5zM12 13c2-1 4-2 4-5-2 0-4 2-4 5zM12 18c-2-1-4-2-4-5 2 0 4 2 4 5zM12 18c2-1 4-2 4-5-2 0-4 2-4 5z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1.5-1.5 1.5-3M12 7c0-1.5 1.5-1.5 1.5-3M16 7c0-1.5 1.5-1.5 1.5-3"/>',
  steak: '<path d="M5 9c2-5 12-6 15-1 2 4-2 9-7 10-6 1-10-4-8-9z"/><circle cx="14" cy="11" r="2.2"/>',
  chicken: '<path d="M14 4a6 6 0 0 1 4 10l-4 1-3 3"/><path d="M14 4a6 6 0 0 0-4 10l1 1"/><path d="M11 18l-3 3M8 21l-2-2 2-2"/>',
  egg: '<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>',
  drop: '<path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z"/>',
};

export function menuIcon(name, label = "") {
  const span = document.createElement("span");
  span.className = `mb-ico mb-ico-${name}`;
  if (label) { span.setAttribute("role", "img"); span.setAttribute("aria-label", label); } else span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || PATHS.bowl}</svg>`;
  return span;
}
