// The pieces both Settings windows are built from (the desk's and Hanua's): a group with its heading, an optional
// "Back to Hanua's defaults", and a "Both Macs" / "This Mac only" tag; and a labelled row. No state here.
import { h } from "../lib.js";

// a where() tag given first goes in the heading, beside the title
export const group = (title, reset, ...rows) => {
  const r = reset ? h("button", { type: "button", className: "set-reset", textContent: "Back to Hanua's defaults" }) : null;
  r?.addEventListener("click", reset);
  const tag = rows[0]?.classList?.contains("set-where") ? rows.shift() : null;
  return h("section", { className: "set-group" }, h("div", { className: "set-head" }, h("h3", { textContent: title }), tag, r), ...rows);
};
export const row = (label, ...field) => h("label", { className: "set-row" }, h("span", { className: "set-label", textContent: label }), ...field);
// where a group's choices live: the room folder both Macs share, or this Mac (its browser, or its own files)
export const where = (both) => h("span", { className: `set-where${both ? "" : " mac"}`, textContent: both ? "Both Macs" : "This Mac only" });
