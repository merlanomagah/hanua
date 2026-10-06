import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { darkFor, appearanceOf } from "../public/shared/appearance.js";

test("appearance: dark follows Mel's choice, the Mac, or the lights", () => {
  assert.equal(darkFor("mac", { mac: true }), true);
  assert.equal(darkFor("mac", { mac: false, lightsOff: true }), false);
  assert.equal(darkFor("lights", { mac: true, lightsOff: false }), false);
  assert.equal(darkFor("lights", { lightsOff: true }), true);
  assert.equal(darkFor("dark"), true);
  assert.equal(darkFor("light", { mac: true, lightsOff: true }), false);
  assert.equal(appearanceOf("nonsense"), "mac"); // the default: follow the Mac
  assert.equal(darkFor(null, { mac: true }), true);
});

// ---- the dark colours, read from styles.css ----
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const DARK = "---------- dark (";
function darkTokens() {
  const from = css.indexOf("html.dark :is(", css.indexOf(DARK));
  const body = css.slice(css.indexOf("{", from) + 1, css.indexOf("}", from));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("appearance: every dark text colour can be read on every dark surface", () => {
  const t = darkTokens();
  const surfaces = ["cream", "page", "dk-win", "dk-raised"];
  const need = { ink: 4.5, "ink-2": 4.5, "ink-3": 4.5, "ink-4": 4.5, muted: 4.5, faint: 3, terra: 4.5, green: 4.5 }; // faint: hints and labels only
  for (const s of surfaces) assert.ok(t[s], `--${s} is defined for dark`);
  for (const [ink, min] of Object.entries(need)) {
    assert.ok(t[ink], `--${ink} is defined for dark`);
    for (const s of surfaces) {
      const c = contrast(t[ink], t[s]);
      assert.ok(c >= min, `--${ink} on --${s} is ${c.toFixed(2)}:1, needs ${min}:1`);
    }
  }
});

// Hard-coded colours outside :root are what keep a window cream in dark mode. They may go down, never up: a new
// colour belongs in :root (and, if it's a Mac thing, gets its dark twin in the dark section).
const RAW_LIMIT = 622; // 6 Oct 2026
test("appearance: no new hard-coded colours outside :root", () => {
  const rootEnd = css.indexOf("}", css.indexOf(":root"));
  const body = css.slice(rootEnd, css.indexOf(DARK)).replace(/\/\*[\s\S]*?\*\//g, "");
  const n = (body.match(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/g) || []).length;
  assert.ok(n <= RAW_LIMIT, `${n} hard-coded colours outside :root (the limit is ${RAW_LIMIT}): use a token`);
  if (n < RAW_LIMIT) console.log(`(hard-coded colours down to ${n}: lower RAW_LIMIT in test/appearance.test.js)`);
});
