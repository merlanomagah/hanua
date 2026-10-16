// Waiting on Claude (Mel, 16 Oct 2026; brief docs/plans/2026-10-waiting.md), for every ✦ button: the moment it's
// pressed it shows a spinner, what's happening and the seconds ticking up; the place the answer will appear shimmers
// with how long it usually takes; another press sends nothing and says so; after a minute, "Taking longer than usual
// · Stop waiting" (which stops Hanua waiting; it never sends again). Rules in public/shared/wait.js.
// Buttons that are drawn again while the request is out (a window redrawn) are marked again with decorate(btn, key).
import { createWaits, isLong, secsText } from "./shared/wait.js";
import { h, toast } from "./lib.js";

const waits = createWaits();
const ctrls = new Map(); // key → AbortController

// fn(signal) does the request. Returns its result, or undefined when the press was ignored or the wait was stopped.
// short: what a small button says while it waits (the full label shows where the answer will appear)
export async function wait(key, label, fn, { button = null, short = null } = {}) {
  if (!waits.start(key, label)) { stillWorking(); return undefined; }
  const ctrl = new AbortController();
  ctrls.set(key, ctrl);
  if (button) decorate(button, key, short);
  paint();
  try { return await fn(ctrl.signal); }
  catch (err) {
    if (err?.name === "AbortError") { toast("Stopped waiting. Nothing was sent again."); return undefined; }
    throw err;
  } finally {
    waits.end(key); ctrls.delete(key);
    for (const el of document.querySelectorAll(`[data-wait="${CSS.escape(key)}"]`)) undecorate(el);
  }
}
export const isWaiting = (key) => waits.has(key);
const stillWorking = () => toast("Still working: it's only been sent once.");

// a button shows the wait (and refuses presses, saying why) while its request is out
export function decorate(btn, key, short = null) {
  if (!btn || !waits.has(key)) return btn;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.dataset.wait = key;
  btn.classList.add("is-working");
  btn.setAttribute("aria-busy", "true");
  btn.setAttribute("aria-disabled", "true");
  btn.replaceChildren(h("span", { className: "wt-spin", ariaHidden: "true" }), document.createTextNode(` ${short ?? waits.get(key).label} `), h("span", { className: "wt-secs", textContent: secsText(waits.secs(key)) }));
  if (!btn.dataset.guarded) {
    btn.dataset.guarded = "1";
    btn.addEventListener("click", (e) => { if (btn.dataset.wait && waits.has(btn.dataset.wait)) { e.preventDefault(); e.stopImmediatePropagation(); stillWorking(); } }, true);
  }
  return btn;
}
function undecorate(el) {
  if (el.classList.contains("wt-note")) { el.remove(); return; }
  el.classList.remove("is-working");
  el.removeAttribute("aria-busy"); el.removeAttribute("aria-disabled");
  if (el.dataset.label) el.textContent = el.dataset.label;
  delete el.dataset.wait; delete el.dataset.label;
}

// where the answer will appear: a soft shimmer, the seconds, how long it usually takes, and later Stop waiting
export function waitNote(key, usually = "Usually 20 to 40 s") {
  if (!waits.has(key)) return null;
  const el = h("div", { className: "wt-note", role: "status" },
    h("span", { className: "wt-spin", ariaHidden: "true" }),
    h("span", { className: "wt-what", textContent: `${waits.get(key).label} ` }),
    h("span", { className: "wt-secs", textContent: secsText(waits.secs(key)) }),
    h("span", { className: "wt-usually", textContent: ` · ${usually}` }),
    h("span", { className: "wt-long" }));
  el.dataset.wait = key;
  paintOne(el);
  return el;
}
function paintOne(el) {
  const key = el.dataset.wait;
  if (!waits.has(key)) return;
  const s = waits.secs(key);
  for (const n of el.querySelectorAll(".wt-secs")) n.textContent = secsText(s);
  if (el.classList.contains("wt-note") && isLong(s) && !el.querySelector(".wt-stop")) {
    const stop = h("button", { type: "button", className: "wt-stop", textContent: "Stop waiting" });
    stop.addEventListener("click", () => ctrls.get(key)?.abort());
    el.querySelector(".wt-long").replaceChildren(document.createTextNode(" · Taking longer than usual · "), stop);
  }
}
function paint() { for (const el of document.querySelectorAll("[data-wait]")) paintOne(el); }
setInterval(paint, 1000);

// the answer arrived: bring it into view, briefly lit
export function arrived(el) {
  if (!el) return;
  el.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  el.classList.add("wt-arrived");
  setTimeout(() => el.classList.remove("wt-arrived"), 1600);
}
