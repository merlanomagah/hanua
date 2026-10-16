// Talking into a Journal question (Mel, 16 Oct 2026; brief docs/plans/2026-10-journal-talk.md). A 🎤 Talk button on
// each question tile: it listens with the browser's own speech-to-text (Safari uses Apple's, like Mac Dictation;
// nothing goes to Claude or Notion) and keeps listening until Mel presses Done: a browser stops after a pause, so it
// is started again quietly. Words still being worked out show faintly under the box; settled ones are added to the
// box after what's there (public/shared/talk.js), each stretch one ⌘Z. It stops on Done, Next / Back, closing the
// window, Esc, the page going out of sight, or Hanua going to sleep. No button where the browser can't do it.
import { spokenText } from "../shared/talk.js";
import { focus, h, toast } from "../lib.js";
import { ICONS } from "./icons.js";
import { asleep } from "../lock.js";

const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canTalk = () => Boolean(Speech);
let active = null; // { rec, box, button, line, stopped }

export function stopTalk() {
  if (!active) return false;
  const a = active;
  active = null;
  a.stopped = true;
  try { a.rec.stop(); } catch { /* already stopped */ }
  a.button.classList.remove("on");
  a.button.setAttribute("aria-pressed", "false");
  a.button.title = "Talk: your words go into the box until you press it again"; a.button.ariaLabel = "Talk into this answer";
  a.line.textContent = "";
  a.line.hidden = true;
  return true;
}
export const talking = () => Boolean(active);

// a settled stretch goes into the box as if typed (so ⌘Z takes it back, and the page hears it like typing)
function add(box, said) {
  const text = spokenText(box.value, said);
  if (!text) return;
  box.focus({ preventScroll: true });
  box.setSelectionRange(box.value.length, box.value.length);
  if (!document.execCommand?.("insertText", false, text)) {
    box.value += text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function start(box, button, line) {
  stopTalk();
  const rec = new Speech();
  rec.lang = navigator.language || "en-NZ";
  rec.interimResults = true;
  rec.continuous = true;
  const a = { rec, box, button, line, stopped: false, fails: 0 };
  const gone = () => !box.isConnected || !box.offsetParent; // its tile was redrawn, or the window put away (at work)
  rec.onresult = (e) => {
    if (gone()) { stopTalk(); return; }
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) add(box, r[0].transcript);
      else interim += r[0].transcript;
    }
    a.fails = 0;
    line.textContent = interim.trim() ? `Listening… ${interim.trim()}` : "Listening…";
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      toast("Hanua needs the microphone: allow it in Safari's settings for this site (Safari → Settings → Websites → Microphone).", true);
      a.stopped = true;
      stopTalk();
    }
  };
  // a pause ends the browser's listening: start again until Mel says she's done (not if it keeps failing at once)
  rec.onend = () => {
    if (a.stopped || active !== a) return;
    if (asleep || document.hidden || gone() || ++a.fails > 5) { stopTalk(); return; }
    try { rec.start(); } catch { stopTalk(); }
  };
  active = a;
  button.classList.add("on");
  button.setAttribute("aria-pressed", "true");
  button.title = "Done talking"; button.ariaLabel = "Done talking";
  line.hidden = false;
  line.textContent = "Listening…";
  try { rec.start(); } catch { stopTalk(); }
}

// The button and its "Listening…" line for one answer box (none where the browser can't listen)
export function talkFor(box) {
  if (!Speech) return { button: null, line: null };
  box.dataset.talk = "own"; // it has its own Talk button: the floating mic leaves it alone
  const line = h("p", { className: "tk-line", ariaLive: "polite" });
  line.hidden = true;
  const button = h("button", { type: "button", className: "set-reset tk-btn", title: "Talk it through: your words go into the box until you press Done", ariaLabel: "Talk into this answer" },
    h("span", { className: "tk-dot", ariaHidden: "true" }));
  button.insertAdjacentHTML("beforeend", ICONS.mic); // an icon, the word as its tip (Preferences, 16 Oct 2026)
  button.classList.add("ic-btn");
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => (active?.button === button ? stopTalk() : start(box, button, line)));
  return { button, line };
}

document.addEventListener("visibilitychange", () => { if (document.hidden) stopTalk(); });
// Esc stops listening first (the window closes on the next Esc)
addEventListener("keydown", (e) => { if (e.key === "Escape" && active) { e.preventDefault(); e.stopImmediatePropagation(); stopTalk(); } }, true);
setInterval(() => { if (active && asleep) stopTalk(); }, 1000);

// ---- every other text field (Mel, 16 Oct 2026: "every field has the opportunity to use speech to text") ----
// Click into a text box anywhere in Hanua and a small mic shows at its top right corner; it listens the same way,
// until it's pressed again. Not on a field with its own Talk button, a password, a number or a typed time; never at
// work (speech goes to Apple's service) or where the browser can't listen.
const FIELD = 'textarea, input:not([type]), input[type="text"], input[type="search"]';
let float = null, floatLine = null, floatFor = null;
const eligible = (el) => el?.matches?.(FIELD) && !el.readOnly && !el.disabled && el.dataset.talk !== "own" && el.dataset.talk !== "off"
  && !el.closest('[data-talk="off"], #lock, .lock') && el.inputMode !== "numeric" && !el.classList.contains("pl-ttext");
function placeFloat() {
  if (!float || !floatFor) return;
  const r = floatFor.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) { float.hidden = true; return; }
  float.hidden = false;
  const tall = r.height > 44;
  float.style.left = `${Math.round(r.right - (tall ? 34 : 30))}px`;
  float.style.top = `${Math.round(tall ? r.top + 6 : r.top + (r.height - 24) / 2)}px`;
  floatLine.style.left = `${Math.round(r.left)}px`;
  floatLine.style.top = `${Math.round(r.bottom + 6)}px`;
  floatLine.style.maxWidth = `${Math.round(Math.max(200, r.width))}px`;
}
function ensureFloat() {
  if (float) return;
  float = h("button", { type: "button", className: "tk-float", title: "Talk: your words go into this box until you press it again", ariaLabel: "Talk into this box" });
  float.insertAdjacentHTML("beforeend", ICONS.mic);
  float.hidden = true;
  floatLine = h("p", { className: "tk-line tk-float-line", ariaLive: "polite" });
  floatLine.hidden = true;
  // pressing it mustn't take the focus from the box it talks into
  float.addEventListener("pointerdown", (e) => e.preventDefault());
  float.addEventListener("click", () => { if (active?.button === float) stopTalk(); else if (floatFor) start(floatFor, float, floatLine); });
  document.body.append(float, floatLine);
}
if (Speech) {
  document.addEventListener("focusin", (e) => {
    if (focus.on || !eligible(e.target)) return;
    ensureFloat();
    if (active?.button === float && floatFor !== e.target) stopTalk();
    floatFor = e.target;
    placeFloat();
  });
  document.addEventListener("focusout", () => setTimeout(() => {
    if (!float || active?.button === float) return;
    if (!eligible(document.activeElement)) { float.hidden = true; floatFor = null; }
  }, 0));
  addEventListener("scroll", placeFloat, true);
  addEventListener("resize", placeFloat);
  document.addEventListener("input", (e) => { if (e.target === floatFor) placeFloat(); });
  document.addEventListener("hanua:focus", () => { if (focus.on && float) { if (active?.button === float) stopTalk(); float.hidden = true; floatFor = null; } });
}
