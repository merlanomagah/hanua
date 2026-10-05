// The focus timer widget: 25 minutes on, 5 off (a soft chime, mutable); the rail shows the countdown while it runs
import { $, h, toast } from "../lib.js";
import { showDesk } from "../planner.js";

// ---- the focus timer: 25 minutes on, 5 off (a soft chime at the end, mutable); the rail shows it while it runs ----
// lengths from Settings (Focus timer group); 25 / 5 until they're read
let FOCUS_MS = 25 * 60_000, BREAK_MS = 5 * 60_000;
document.addEventListener("hanua:settings", (e) => {
  const t = e.detail?.timer;
  if (!t) return;
  const was = fullOf(timer.mode);
  FOCUS_MS = t.focus * 60_000; BREAK_MS = t.rest * 60_000;
  if (!timer.endsAt && timer.left === was) { timer.left = fullOf(timer.mode); keepTimer(); } // not started: the new length
  $("w-timer").dataset.shape = ""; renderTimer();
});
let timer = { mode: "focus", left: FOCUS_MS, endsAt: 0, muted: false };
try { timer = { ...timer, ...JSON.parse(localStorage.getItem("focus-timer") || "{}") }; } catch { /* a fresh timer */ }
const keepTimer = () => { try { localStorage.setItem("focus-timer", JSON.stringify(timer)); } catch { /* fine */ } };
const fullOf = (mode) => (mode === "focus" ? FOCUS_MS : BREAK_MS);
const leftNow = () => (timer.endsAt ? Math.max(0, timer.endsAt - Date.now()) : timer.left);
const mmss = (ms) => { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
function chime() {
  if (timer.muted) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.22]].forEach(([f, at]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.9);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + 1);
    });
  } catch { /* no sound available */ }
}
function timerAct(what) {
  if (what === "go") { if (timer.endsAt) { timer.left = leftNow(); timer.endsAt = 0; } else timer.endsAt = Date.now() + timer.left; }
  if (what === "reset") { timer.endsAt = 0; timer.left = fullOf(timer.mode); }
  if (what === "switch") { timer.mode = timer.mode === "focus" ? "break" : "focus"; timer.endsAt = 0; timer.left = fullOf(timer.mode); }
  if (what === "mute") timer.muted = !timer.muted;
  keepTimer(); renderTimer();
}
// Mostly the timer (Mel, 6 Oct 2026): the ring and the time; click the middle to start or pause (▶ / ❚❚ on hover),
// ↺ in the top corner resets, the bell in the bottom corner mutes (struck through) and unmutes, and the label at the
// top left switches between Focus and Break
const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none"/><path d="M4.5 3.5v4h4" fill="none"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a5 5 0 0 0-5 5v4l-1.8 3h13.6L17 13V9a5 5 0 0 0-5-5z" fill="none"/><path d="M10 19a2 2 0 0 0 4 0" fill="none"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a5 5 0 0 0-5 5v4l-1.8 3h13.6L17 13V9a5 5 0 0 0-5-5z" fill="none"/><path d="M10 19a2 2 0 0 0 4 0" fill="none"/><path d="M4 4l16 16" fill="none"/></svg>',
};
function renderTimer() {
  const left = leftNow(), running = Boolean(timer.endsAt);
  if (running && left <= 0) { // finished: chime, and the other half is ready to start
    const was = timer.mode;
    timer.mode = was === "focus" ? "break" : "focus"; timer.endsAt = 0; timer.left = fullOf(timer.mode); keepTimer();
    chime();
    toast(was === "focus" ? "Focus done. Take five." : "Break's over. Ready when you are.", false, { label: was === "focus" ? "Start break" : "Start focus", run: () => timerAct("go") });
    return renderTimer();
  }
  const frac = left / fullOf(timer.mode), r = 44, c = 2 * Math.PI * r;
  const chip = $("ts-timer");
  chip.hidden = !running;
  chip.textContent = `${timer.mode === "focus" ? "●" : "☕"} ${mmss(left)}`;
  // each second only the numbers and the ring move (the buttons stay put, so keyboard focus isn't lost)
  const w = $("w-timer");
  const shape = `${timer.mode}|${running}|${timer.muted}|${left < fullOf(timer.mode)}`;
  if (w.dataset.shape === shape && w.querySelector(".tm-left")) {
    w.querySelector(".tm-left").textContent = mmss(left);
    w.querySelector(".tm-ring").setAttribute("stroke-dashoffset", String(c * (1 - frac)));
    return;
  }
  w.dataset.shape = shape;
  const icon = (cls, label, svg, what) => { const b = h("button", { type: "button", className: `tm-icon ${cls}`, ariaLabel: label, title: label, innerHTML: svg }); b.addEventListener("click", (e) => { e.stopPropagation(); timerAct(what); }); return b; };
  const ring = `<svg class="tm-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="tm-track"/><circle cx="50" cy="50" r="${r}" class="tm-ring" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 50 50)"/></svg>`;
  const goLabel = running ? "Pause" : left < fullOf(timer.mode) ? "Resume" : "Start";
  const dial = h("button", { type: "button", className: "tm-dial", ariaLabel: `${goLabel} the ${timer.mode === "focus" ? "focus" : "break"} timer, ${mmss(left)} left`, innerHTML: ring },
    h("b", { className: "tm-left", textContent: mmss(left), role: "timer" }),
    h("span", { className: "tm-go-ico", innerHTML: running ? ICONS.pause : ICONS.play, ariaHidden: "true" }));
  dial.addEventListener("click", () => timerAct("go"));
  const mode = h("button", { type: "button", className: "wg-label tm-mode", textContent: timer.mode === "focus" ? "Focus" : "Break", title: `Switch to ${timer.mode === "focus" ? "a 5-minute break" : "25 minutes of focus"}` });
  mode.addEventListener("click", (e) => { e.stopPropagation(); timerAct("switch"); });
  w.className = `widget wg-timer tm-${timer.mode}${running ? " running" : ""}`;
  w.replaceChildren(mode, dial,
    icon("tm-reset", "Reset", ICONS.reset, "reset"),
    icon("tm-bell", timer.muted ? "Chime off: click to turn it on" : "Chime on: click to mute", timer.muted ? ICONS.muted : ICONS.bell, "mute"));
  // the rail: the countdown follows you round the room while it runs
  chip.dataset.tip = timer.mode === "focus" ? "Focusing: open the desk" : "On a break: open the desk";
}
$("ts-timer").addEventListener("click", () => showDesk(true));
renderTimer();
setInterval(() => { if (timer.endsAt) renderTimer(); }, 1000);

