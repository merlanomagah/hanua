// The focus timer widget: 25 minutes on, 5 off (a soft chime, mutable); the rail shows the countdown while it runs
import { $, h, toast } from "../lib.js";
import { showDesk } from "../planner.js";

// ---- the focus timer: 25 minutes on, 5 off (a soft chime at the end, mutable); the rail shows it while it runs ----
const FOCUS_MS = 25 * 60_000, BREAK_MS = 5 * 60_000;
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
function renderTimer() {
  const left = leftNow(), running = Boolean(timer.endsAt);
  if (running && left <= 0) { // finished: chime, and the other half is ready to start
    const was = timer.mode;
    timer.mode = was === "focus" ? "break" : "focus"; timer.endsAt = 0; timer.left = fullOf(timer.mode); keepTimer();
    chime();
    toast(was === "focus" ? "Focus done. Take five." : "Break's over. Ready when you are.", false, { label: was === "focus" ? "Start break" : "Start focus", run: () => timerAct("go") });
    return renderTimer();
  }
  const frac = left / fullOf(timer.mode), r = 34, c = 2 * Math.PI * r;
  const chip = $("ts-timer");
  chip.hidden = !running;
  chip.textContent = `${timer.mode === "focus" ? "●" : "☕"} ${mmss(left)}`;
  // each second only the numbers and the ring move (the buttons stay put, so keyboard focus isn't lost)
  const shape = `${timer.mode}|${running}|${timer.muted}|${left < fullOf(timer.mode)}`;
  if ($("w-timer").dataset.shape === shape) {
    $("w-timer").querySelector(".tm-left").textContent = mmss(left);
    $("w-timer").querySelector(".tm-ring").setAttribute("stroke-dashoffset", String(c * (1 - frac)));
    return;
  }
  $("w-timer").dataset.shape = shape;
  const btn = (label, what, cls = "") => { const b = h("button", { type: "button", className: `tm-btn ${cls}`, textContent: label }); b.addEventListener("click", () => timerAct(what)); return b; };
  const ring = `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${r}" class="tm-track"/><circle cx="40" cy="40" r="${r}" class="tm-ring" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 40 40)"/></svg>`;
  $("w-timer").className = `widget wg-timer tm-${timer.mode}${running ? " running" : ""}`;
  $("w-timer").replaceChildren(
    h("span", { className: "wg-label", textContent: timer.mode === "focus" ? "Focus timer" : "Break" }),
    h("div", { className: "tm-row" },
      h("div", { className: "tm-dial", innerHTML: ring }, h("b", { className: "tm-left", textContent: mmss(left), role: "timer", ariaLabel: `${mmss(left)} left` })),
      h("div", { className: "tm-btns" }, btn(running ? "Pause" : left < fullOf(timer.mode) ? "Resume" : "Start", "go", "tm-go"), btn("Reset", "reset"),
        btn(timer.mode === "focus" ? "Break" : "Focus", "switch"),
        (() => { const m = h("button", { type: "button", className: "tm-btn tm-mute", ariaPressed: String(timer.muted), title: timer.muted ? "Chime off" : "Chime on", textContent: timer.muted ? "🔕" : "🔔" }); m.addEventListener("click", () => timerAct("mute")); return m; })())));
  // the rail: the countdown follows you round the room while it runs
  chip.dataset.tip = timer.mode === "focus" ? "Focusing: open the desk" : "On a break: open the desk";
}
$("ts-timer").addEventListener("click", () => showDesk(true));
renderTimer();
setInterval(() => { if (timer.endsAt) renderTimer(); }, 1000);

