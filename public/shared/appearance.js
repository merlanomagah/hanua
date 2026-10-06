// Dark mode (brief docs/plans/2026-10-dark-mode.md, Mel 6 Oct 2026): Mac things (the desk's windows, widgets, dock,
// Settings) go dark; real objects (bricks, oak, books, stickies, the whiteboard) keep their colours and only dim with
// the lights. Mel picks when, per Mac: following macOS (the default: her Mac is set to Dark), following the lights
// (dark while they're off: 9 pm–4 am, or a pull of a cord), or always light / always dark. No page imports.
export const APPEARANCES = { mac: "Follow my Mac", lights: "Follow the lights", light: "Always light", dark: "Always dark" };
export const DEFAULT_APPEARANCE = "mac";
export const appearanceOf = (v) => (Object.hasOwn(APPEARANCES, v) ? v : DEFAULT_APPEARANCE);
export function darkFor(choice, { mac = false, lightsOff = false } = {}) {
  switch (appearanceOf(choice)) {
    case "dark": return true;
    case "light": return false;
    case "lights": return Boolean(lightsOff);
    default: return Boolean(mac);
  }
}
