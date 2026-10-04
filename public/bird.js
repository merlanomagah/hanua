// The canary: no purpose, just life. It flies now and then and lands on the tops of things (the lamp, the clock,
// the plant, the calendar, the TV, the whiteboard), looks about, tilts its head, hops, preens and fluffs. It lives
// in a brass cage at the foot of the bookcase: close the door and it stays in. It goes to bed when the lights go
// off (a cloth comes down over the cage) and wakes when they come on, visits the plant after a watering, hops for
// joy at the coin when a goal is done, bobs to music on the record player, gets out of the way of the mouse, and
// pecks the whiteboard marker.
// The drawing and the cage are Claude Design's (public/canary/rig.js, cage.js; 5 Oct 2026): a feathered vector
// rig whose 15 poses are frames, and the cage in layers so the bird sits inside it, between perch and bars.
// Never annoying: no sound, only on the tops of objects, still while you type, draw, water or have a dialog open,
// about one flight a minute, paused when Hanua isn't showing, and just sits still in its cage if motion is reduced.
import { $, reducedMotion, store } from "./lib.js";
import { ORDER, POSES, frameSVG } from "./canary/rig.js";
import { CH, CW, CX, DOOR_FRAMES, PERCH_Y, cageSVG } from "./canary/cage.js";

const W = 56, H = 48; // the bird on screen (Corn; a third bigger since 5 Oct 2026, to scale with the cage and plant); its feet are at the bottom middle
const url = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
// Where it can land: the top of each thing, x between two fractions of its width, y a fraction down from its top
const PERCHES = [
  { sel: ".greet-row .lamp-img", x: [0.4, 0.6], y: 0.2, w: 3 },
  { sel: "#clock", x: [0.2, 0.8], y: 0, w: 3 },
  { sel: ".wall-clock.away", x: [0.25, 0.75], y: 0, w: 2 },
  { sel: ".weather-window", x: [0.08, 0.92], y: -0.07, w: 2 },
  { sel: ".ww-sill", x: [0.1, 0.9], y: 0.12, w: 2 },
  { sel: "#shelf-plant", x: [0.35, 0.6], y: 0.06, w: 2, name: "plant" },
  { sel: "#can", x: [0.3, 0.45], y: 0.08, w: 1 },
  { sel: ".cal-card", x: [0.12, 0.88], y: 0, w: 2 },
  { sel: "#monitor", x: [0.15, 0.85], y: 0, w: 2 },
  { sel: ".deco-books", x: [0.25, 0.6], y: 0.12, w: 1 },
  { sel: "#record-player", x: [0.3, 0.7], y: 0.06, w: 1, name: "records" },
  { sel: ".mb-frame", x: [0.08, 0.92], y: 0, w: 2 },
  { sel: ".mb-tray .marker.ink", x: [0.45, 0.6], y: -0.1, w: 1, name: "marker" },
  { sel: ".note", x: [0.3, 0.7], y: 0, w: 1 },
  { sel: ".desk .cup", x: [0.3, 0.6], y: 0.1, w: 2 },
  { sel: ".desk-lamp .lamp-img", x: [0.4, 0.6], y: 0.2, w: 1 },
  { sel: "#todo", x: [0.2, 0.8], y: 0, w: 1 },
];
// the coin is right at the top of the screen, so the bird stands in front of it rather than on top
const COIN = { sel: ".topshelf .ts-earn", x: [0.5, 0.5], y: 0.98, w: 0, name: "coin" };

// ---- the frames: every pose drawn once, as pictures the bird swaps between ----
const frames = {};
for (const k of ORDER) frames[k] = POSES[k].frames.map((f, i) => url(frameSVG(f, { id: k + i })));

// ---- the bird ----
const bird = document.createElement("img");
bird.className = "canary";
bird.alt = "";
bird.setAttribute("aria-hidden", "true");
bird.src = frames.perch[0];
document.body.append(bird);

// ---- the cage: back bars, perch, (bird), front bars with the door, and a cloth for the night ----
const cage = $("cage"), slot = $("cage-slot"), door = $("cage-door");
const doorFrames = DOOR_FRAMES.map((a) => url(a === 0 ? cageSVG("cage-front-closed") : cageSVG("cage-door-frame", { angle: a })));
if (cage) {
  $("cage-back").src = url(cageSVG("cage-back"));
  $("cage-perch").src = url(cageSVG("cage-perch"));
  $("cage-cover").src = url(cageSVG("cage-cover", { color: "cream" }));
  // the canary's feet on the perch: its slot sits on the perch's top edge, centred on the cage
  slot.style.left = `calc(${((CX / CW) * 100).toFixed(2)}% - ${W / 2}px)`;
  slot.style.top = `calc(${((PERCH_Y / CH) * 100).toFixed(2)}% - ${H}px)`;
}

let doorOpen = store("bird-door") !== "closed";
let where = null; // { perch, el, fx } while perched, "cage" when home, null while flying
let face = 1, x = 0, y = 0;
let flying = false, asleep = false, bobbing = false, posing = false;
let raf = 0, nextTimer = 0, idleTimer = 0, poseTimer = 0, lastKey = 0, lastShoo = 0;

const lightsOff = () => $("app").classList.contains("lamp-off");
const musicOn = () => $("app").dataset.music === "playing";
const cageShown = () => Boolean(cage && cage.getClientRects().length && cage.getBoundingClientRect().width);
const busy = () => document.hidden || document.querySelector("dialog[open]") || Date.now() - lastKey < 4000
  || document.querySelector(".can.lifted") || flying;

// a perch's landing point right now (screen coordinates), or null when it isn't on screen
function pointOf(p, el, fx) {
  const r = el.getBoundingClientRect();
  if (!r.width || el.closest("[inert]")) return null;
  const px = r.left + r.width * fx, py = r.top + r.height * p.y;
  const top = p === COIN ? 0 : ($("topshelf")?.getBoundingClientRect().bottom || 0) + 8;
  // keep off the bookcase (on a phone it runs across the top instead, and the top shelf covers that)
  const shelf = document.querySelector(".shelf")?.getBoundingClientRect();
  const left = p === COIN || !shelf || shelf.width > innerWidth / 2 ? 0 : shelf.right;
  if ((p !== COIN && py < top + H) || py > innerHeight - 6 || px < left + W / 2 || px > innerWidth - W / 2) return null;
  return { x: px, y: py };
}
function choose(filter = () => true) {
  const options = [];
  for (const p of PERCHES) {
    if (!filter(p)) continue;
    for (const el of document.querySelectorAll(p.sel)) {
      const fx = p.x[0] + Math.random() * (p.x[1] - p.x[0]);
      if (where?.el === el) continue;
      if (pointOf(p, el, fx)) options.push({ perch: p, el, fx, w: p.w * (p.name === "records" && musicOn() ? 4 : 1) });
    }
  }
  let r = Math.random() * options.reduce((s, o) => s + o.w, 0);
  return options.find((o) => (r -= o.w) <= 0) || options[0] || null;
}

// ---- posing: one frame at a time, at the pose's own timing ----
const show = (pose, i) => { bird.src = frames[pose][i]; };
function play(pose, { times = 1, then } = {}) {
  clearTimeout(poseTimer);
  const P = POSES[pose];
  let i = 0, n = 0;
  const step = () => {
    show(pose, i++);
    if (i >= P.frames.length) {
      i = 0; n++;
      if (!P.loop && n >= times) { poseTimer = setTimeout(() => (then ? then() : rest()), P.ms); return; }
    }
    poseTimer = setTimeout(step, P.ms);
  };
  step();
}
// what it does when nothing's happening: breathing, asleep, or bobbing to music
function rest() {
  if (flying) return;
  const base = asleep ? "sleep" : bobbing ? "bob" : "perch";
  if (reducedMotion) { clearTimeout(poseTimer); return show(base, 0); }
  play(base);
}
// now and then while sitting: a look round, a tilt, a hop, a preen, a fluff (and sometimes a feather drifts down)
function idle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!flying && !asleep && !bobbing && !posing && !reducedMotion && !document.hidden) {
      const move = ["look", "look", "tilt", "tilt", "hop", "preen", "fluff"][Math.floor(Math.random() * 7)];
      posing = true;
      if (move === "hop" && Math.random() < 0.4 && where !== "cage") setTimeout(() => { face *= -1; place(x, y); }, 160);
      play(move, { then: () => { posing = false; if (move === "fluff" && Math.random() < 0.4) feather(); rest(); } });
    }
    idle();
  }, 3000 + Math.random() * 5000);
}
function feather() {
  const r = bird.getBoundingClientRect();
  if (!r.width) return;
  const f = document.createElement("img");
  f.className = "feather";
  f.alt = "";
  f.src = url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 8"><path d="M1,4 Q8,0 19,3 Q9,8 1,4Z" fill="#F4D24A"/><path d="M1,4 Q10,3.4 18,3.2" stroke="#C9A12E" stroke-width=".6" fill="none"/></svg>`);
  document.body.append(f);
  const x0 = r.left + W / 2, y0 = r.bottom - 16, t0 = performance.now();
  const fall = (now) => {
    const t = (now - t0) / 3200;
    if (t >= 1) return f.remove();
    f.style.transform = `translate(${x0 + Math.sin(t * 9) * 10}px, ${y0 + t * 90}px) rotate(${Math.sin(t * 9) * 40}deg)`;
    f.style.opacity = String(Math.min(1, (1 - t) * 3));
    requestAnimationFrame(fall);
  };
  requestAnimationFrame(fall);
}

// ---- moving: fixed to the screen while out, sitting inside the cage (between perch and bars) when home ----
function place(px, py) {
  x = px; y = py;
  bird.style.visibility = "";
  bird.style.transform = `translate(${(px - W / 2).toFixed(1)}px, ${(py - H).toFixed(1)}px) scaleX(${face})`;
}
function leaveCage() {
  if (bird.parentElement !== slot) return;
  const r = slot.getBoundingClientRect();
  document.body.append(bird);
  bird.classList.remove("home");
  place(r.left + W / 2, r.bottom);
}
function enterCage() {
  slot.append(bird);
  bird.classList.add("home");
  bird.style.transform = `scaleX(${face})`;
  where = "cage";
}

// takeoff, then bounding flight (bursts of wingbeats, then a glide with the wings tucked), then a flare to land.
// The target is read again each frame, so a perch that scrolls is still met.
function flyTo(target, land) {
  if (!target()) return schedule();
  clearTimeout(nextTimer); clearTimeout(poseTimer); cancelAnimationFrame(raf);
  flying = true; posing = false; bobbing = false;
  leaveCage();
  where = null;
  const to0 = target();
  if (bird.style.visibility === "hidden") place(to0.x, to0.y - 40);
  const from = { x, y };
  const dist = Math.hypot(to0.x - from.x, to0.y - from.y);
  face = to0.x < from.x ? -1 : 1;
  place(x, y);
  play("takeoff", { then: () => {
    const dur = Math.min(2600, Math.max(800, 520 + dist * 1.15)), landMs = 248, lift = 26 + dist * 0.16, A = 7;
    const segs = [];
    for (let t = 0; t < dur;) {
      const n = 3 + Math.floor(Math.random() * 2);
      segs.push({ k: "flap", t0: t, len: n * 120 }); t += n * 120;
      segs.push({ k: "glide", t0: t, len: 240 }); t += 240;
    }
    const start = performance.now();
    const step = (now) => {
      const to = target() || to0;
      const el = now - start, tt = Math.min(1, el / dur);
      const e = tt < 0.5 ? 2 * tt * tt : 1 - (-2 * tt + 2) ** 2 / 2;
      const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - lift;
      let px = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e * e * to.x;
      let py = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
      if (el >= dur - landMs) show("land", Math.min(3, Math.floor((el - (dur - landMs)) / 62)));
      else {
        const s = segs.find((g) => el >= g.t0 && el < g.t0 + g.len) || segs[segs.length - 1], u = (el - s.t0) / s.len;
        const fade = Math.min(1, (dur - landMs - el) / 220, el / 160);
        if (s.k === "flap") { py -= A * u * fade; show("flap", Math.floor((el - s.t0) / 20) % 6); }
        else { py -= A * (1 - u * u) * fade; show("glide", 0); }
      }
      place(px, py);
      if (tt < 1) raf = requestAnimationFrame(step);
      else { flying = false; place(to.x, to.y); land(); }
    };
    raf = requestAnimationFrame(step);
  } });
}

function perchAt(choice, after) {
  flyTo(() => pointOf(choice.perch, choice.el, choice.fx), () => {
    where = choice;
    if (choice.perch.name === "records" && musicOn()) bobbing = true;
    if (choice.perch.name === "marker") { choice.el.classList.add("pecked"); setTimeout(() => choice.el.classList.remove("pecked"), 900); }
    if (after) after();
    else if (choice.perch.name === "marker") peck(2);
    else rest();
    schedule(); idle();
  });
}
function peck(times = 3) {
  posing = true;
  play("peck", { times, then: () => { posing = false; rest(); } });
}

function homePoint() {
  const r = slot.getBoundingClientRect();
  return r.width ? { x: r.left + W / 2, y: r.bottom } : null;
}
function goHome(then) {
  if (!cageShown()) {
    // no cage on a phone: settle wherever it is (or on a perch)
    if (!where) { const c = choose(); if (c) return perchAt(c, then); }
    then?.(); return;
  }
  if (where === "cage") { then?.(); return; }
  if (reducedMotion) { enterCage(); then?.(); return rest(); }
  flyTo(homePoint, () => {
    enterCage();
    if (then) then(); else rest();
    schedule(); idle();
  });
}

// ---- the day: about one flight a minute, home now and then, asleep when the lights are off ----
function schedule() {
  clearTimeout(nextTimer);
  nextTimer = setTimeout(wander, 20000 + Math.random() * 40000);
}
function wander() {
  if (reducedMotion || lightsOff() || (!doorOpen && cageShown())) return goHome();
  if (busy()) return schedule();
  if (where !== "cage" && cageShown() && Math.random() < 0.12) return goHome();
  const c = choose();
  if (c) perchAt(c); else schedule();
}

// night: home, the cloth comes down, a fluffed sleeping ball. Morning: cloth up, wake, out a little later
function sleep() {
  goHome(() => { asleep = true; bobbing = false; rest(); cage?.classList.add("covered"); });
}
function wake() {
  cage?.classList.remove("covered");
  asleep = false;
  const after = () => { rest(); if (doorOpen) { clearTimeout(nextTimer); nextTimer = setTimeout(wander, 2500); } };
  if (reducedMotion) after(); else play("wake", { then: after });
}
new MutationObserver(() => {
  if (lightsOff() && !asleep) sleep();
  else if (!lightsOff() && asleep) wake();
}).observe($("app"), { attributes: true, attributeFilter: ["class"] });

// ---- the cage door: it swings; shut keeps the bird in ----
function swingDoor(open, then) {
  const steps = open ? doorFrames : [...doorFrames].reverse();
  const front = $("cage-front");
  if (!front) return then?.();
  if (reducedMotion) { front.src = steps[steps.length - 1]; return then?.(); }
  let i = 0;
  const step = () => { front.src = steps[i++]; if (i < steps.length) setTimeout(step, 60); else then?.(); };
  step();
}
function renderDoor() {
  cage?.classList.toggle("open", doorOpen);
  if (!door) return;
  door.setAttribute("aria-pressed", String(!doorOpen));
  door.ariaLabel = doorOpen ? "Close the cage door (the canary stays in)" : "Open the cage door (the canary can fly about)";
  door.title = door.ariaLabel;
}
door?.addEventListener("click", () => {
  doorOpen = !doorOpen;
  store("bird-door", doorOpen ? "open" : "closed");
  renderDoor();
  if (doorOpen) { swingDoor(true); if (!lightsOff()) { clearTimeout(nextTimer); nextTimer = setTimeout(wander, 1500); } }
  else goHome(() => { rest(); swingDoor(false); });
});

// ---- reacting to the room ----
window.addEventListener("keydown", () => { lastKey = Date.now(); }, true);
// the mouse comes close: off to somewhere nearby
window.addEventListener("pointermove", (e) => {
  if (!where || where === "cage" || flying || Date.now() - lastShoo < 3000) return;
  if (Math.hypot(e.clientX - x, e.clientY - (y - H / 2)) > 56) return;
  lastShoo = Date.now();
  const c = choose((p) => { const el = document.querySelector(p.sel); if (!el) return false; const b = el.getBoundingClientRect(); return Math.hypot(b.left - x, b.top - y) < 450; }) || choose();
  if (c) perchAt(c);
}, { passive: true });
// after a watering it visits the plant and has a drink
const canGo = () => !lightsOff() && (doorOpen || !cageShown()) && !reducedMotion;
window.addEventListener("hanua:watered", () => {
  if (!canGo()) return;
  setTimeout(() => {
    const c = choose((p) => p.name === "plant");
    if (c) perchAt(c, () => setTimeout(() => peck(3), 300));
  }, 2200);
});
// a goal done: a happy hop at the coin
window.addEventListener("hanua:done", () => {
  if (!canGo()) return;
  const el = document.querySelector(COIN.sel);
  if (!el) return;
  setTimeout(() => perchAt({ perch: COIN, el, fx: 0.5 }, () => { posing = true; play("happy", { times: 2, then: () => { posing = false; rest(); } }); }), 600);
});
// music starts or stops while it's on the record player
new MutationObserver(() => {
  const on = musicOn() && where?.perch?.name === "records";
  if (on !== bobbing && !flying) { bobbing = on; if (!posing) rest(); }
}).observe($("app"), { attributes: true, attributeFilter: ["data-music"] });

// keep it on its perch when the page scrolls or the window changes; fly off if the perch goes away
function stick() {
  if (!where || where === "cage" || flying) return;
  const pt = pointOf(where.perch, where.el, where.fx);
  if (pt) place(pt.x, pt.y);
  else wander();
}
window.addEventListener("scroll", stick, { passive: true });
window.addEventListener("resize", stick);
setInterval(stick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && !lightsOff()) schedule(); });

// start at home, then out into the room (unless it's night, the door's shut, or motion is reduced)
renderDoor();
if ($("cage-front")) $("cage-front").src = doorOpen ? doorFrames[doorFrames.length - 1] : doorFrames[0];
if (cageShown()) enterCage();
else {
  // no cage (a phone): out of sight until the room has laid out, then settle on a perch
  bird.style.visibility = "hidden";
  setTimeout(() => { const c = choose(); if (c && !where) { where = c; const pt = pointOf(c.perch, c.el, c.fx); place(pt.x, pt.y); } }, 1500);
}
if (lightsOff()) { asleep = true; cage?.classList.add("covered"); }
rest();
idle();
if (!lightsOff() && !reducedMotion && doorOpen) nextTimer = setTimeout(wander, 4000);
