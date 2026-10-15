// Talking into a Journal question (Mel, 16 Oct 2026; brief docs/plans/2026-10-journal-talk.md). A 🎤 Talk button on
// each question tile: it listens with the browser's own speech-to-text (Safari uses Apple's, like Mac Dictation;
// nothing goes to Claude or Notion) and keeps listening until Mel presses Done: a browser stops after a pause, so it
// is started again quietly. Words still being worked out show faintly under the box; settled ones are added to the
// box after what's there (public/shared/talk.js), each stretch one ⌘Z. It stops on Done, Next / Back, closing the
// window, Esc, the page going out of sight, or Hanua going to sleep. No button where the browser can't do it.
import { spokenText } from "../shared/talk.js";
import { h, toast } from "../lib.js";
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
  a.button.querySelector(".tk-label").textContent = "Talk";
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
  button.querySelector(".tk-label").textContent = "Done";
  line.hidden = false;
  line.textContent = "Listening…";
  try { rec.start(); } catch { stopTalk(); }
}

// The button and its "Listening…" line for one answer box (none where the browser can't listen)
export function talkFor(box) {
  if (!Speech) return { button: null, line: null };
  const line = h("p", { className: "tk-line", ariaLive: "polite" });
  line.hidden = true;
  const button = h("button", { type: "button", className: "set-reset tk-btn", title: "Talk it through: your words go into the box until you press Done", ariaLabel: "Talk into this answer" },
    h("span", { className: "tk-dot", ariaHidden: "true" }), h("span", { className: "tk-label", textContent: "Talk" }));
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => (active?.button === button ? stopTalk() : start(box, button, line)));
  return { button, line };
}

document.addEventListener("visibilitychange", () => { if (document.hidden) stopTalk(); });
// Esc stops listening first (the window closes on the next Esc)
addEventListener("keydown", (e) => { if (e.key === "Escape" && active) { e.preventDefault(); e.stopImmediatePropagation(); stopTalk(); } }, true);
setInterval(() => { if (active && asleep) stopTalk(); }, 1000);
