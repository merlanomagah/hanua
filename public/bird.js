// The canary: no purpose, just life. It flies now and then and lands on the tops of things (the lamp, the clock,
// the plant, the calendar, the TV, the whiteboard), hops, tilts its head and preens. It lives in a brass cage at
// the foot of the bookcase: close the door and it stays in. It goes to bed when the lights go off and wakes when
// they come on, visits the plant after a watering, hops for joy on the coin when a goal is done, bobs to music on
// the record player, gets out of the way of the mouse, and pecks the whiteboard marker.
// Never annoying: no sound, only on the tops of objects, still while you type, draw, water or have a dialog open,
// about one flight a minute, paused when Hanua isn't showing, and just sits in its cage if motion is reduced.
import { $, reducedMotion, store } from "./lib.js";

const W = 42, H = 36; // the bird's size (its drawing is 30 × 26, scaled up); its feet are at the bottom middle
// Where it can land: the top of each thing, x between two fractions of its width, y a fraction down from its top
const PERCHES = [
  { sel: ".greet-row .lamp-img", x: [0.38, 0.62], y: 0.2, w: 3 },
  { sel: "#clock", x: [0.2, 0.8], y: 0, w: 3 },
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
const COIN = { sel: ".topshelf .coin", x: [0.5, 0.5], y: 0.98, w: 0, name: "coin" };

// ---- the bird ----
const bird = document.createElement("div");
bird.className = "canary";
bird.setAttribute("aria-hidden", "true");
bird.innerHTML = `<svg viewBox="0 0 30 26">
  <defs><radialGradient id="canary-body" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe27a"/><stop offset=".6" stop-color="#f5c542"/><stop offset="1" stop-color="#d9a12a"/></radialGradient></defs>
  <g class="legs"><path d="M14 19.5 L13 25 M17 19.5 L17.6 25" stroke="#b07a3a" stroke-width="1" stroke-linecap="round"/><path d="M11.5 25 H14.5 M16 25 H19" stroke="#b07a3a" stroke-width=".8" stroke-linecap="round"/></g>
  <path class="tail" d="M9 16.5 L0.5 21.5 L1.5 19.5 L0 18.6 L8 14.2 Z" fill="#d9a12a"/>
  <ellipse cx="15" cy="15" rx="8.6" ry="5.2" transform="rotate(-22 15 15)" fill="url(#canary-body)"/>
  <g class="head"><circle cx="22.2" cy="8.6" r="4" fill="url(#canary-body)"/>
    <circle class="eye" cx="23.4" cy="7.9" r=".95" fill="#2a2018"/><circle class="eye" cx="23.7" cy="7.6" r=".3" fill="#fff"/>
    <path class="eye-shut" d="M22.5 8.1 Q23.4 8.9 24.3 8.1" stroke="#2a2018" stroke-width=".8" fill="none"/>
    <path d="M25.8 8.4 L28.6 9.3 L25.8 10.2 Z" fill="#e3913a"/></g>
  <path class="wing" d="M17.5 11.5 Q12 11.5 7 17.8 Q13 18.2 18.5 15 Z" fill="#e2ad33" stroke="#c48d24" stroke-width=".5"/>
  <path d="M9.5 16.6 L13 15.4 M11 17.3 L14.5 15.9" stroke="#c48d24" stroke-width=".4" opacity=".7"/>
</svg>`;
document.body.append(bird);

const cage = $("cage"), slot = $("cage-slot"), door = $("cage-door");
let doorOpen = store("bird-door") !== "closed";
let where = null; // { perch, el, fx, fy } while perched, "cage" when home, null while flying
let flight = 0, nextTimer = 0, idleTimer = 0, lastKey = 0, lastShoo = 0;

const lightsOff = () => $("app").classList.contains("lamp-off");
const cageShown = () => cage && cage.getClientRects().length > 0 && cage.getBoundingClientRect().width > 0;
const busy = () => document.hidden || document.querySelector("dialog[open]") || Date.now() - lastKey < 4000
  || $("menu-board")?.dataset.tool || document.querySelector(".can.lifted") || flight;

// a perch's landing point right now (screen coordinates), or null when it isn't on screen
function pointOf(p, el, fx) {
  const r = el.getBoundingClientRect();
  if (!r.width || el.closest("[inert]")) return null;
  const x = r.left + r.width * fx, y = r.top + r.height * p.y;
  const top = p === COIN ? 0 : ($("topshelf")?.getBoundingClientRect().bottom || 0) + 8;
  // keep off the bookcase (on a phone it runs across the top instead, and the top shelf covers that)
  const shelf = document.querySelector(".shelf")?.getBoundingClientRect();
  const left = p === COIN || !shelf || shelf.width > innerWidth / 2 ? 0 : shelf.right;
  if ((p !== COIN && y < top + H) || y > innerHeight - 6 || x < left + W / 2 || x > innerWidth - W / 2) return null;
  return { x, y };
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
  const total = options.reduce((s, o) => s + o.w, 0);
  let r = Math.random() * total;
  return options.find((o) => (r -= o.w) <= 0) || options[0] || null;
}
const musicOn = () => $("app").dataset.music === "playing";

// ---- moving: the bird is fixed to the screen while out, and sits inside the cage when home ----
function place(x, y, faceLeft) {
  bird.style.transform = `translate(${(x - W / 2).toFixed(1)}px, ${(y - H).toFixed(1)}px)`;
  if (faceLeft != null) bird.classList.toggle("left", faceLeft);
}
function leaveCage() {
  if (bird.parentElement !== slot) return;
  const r = bird.getBoundingClientRect();
  document.body.append(bird);
  bird.classList.remove("home");
  place(r.left + W / 2, r.bottom);
}
function current() {
  const r = bird.getBoundingClientRect();
  return { x: r.left + W / 2, y: r.bottom };
}

// fly in an arc to a target (it may move while we fly: it's read again each frame), then call land
function flyTo(target, land, ms) {
  // nowhere to go (the perch went off screen): stay put
  if (!target()) return schedule();
  clearTimeout(nextTimer);
  clearTimeout(idleTimer);
  leaveCage();
  const keep = bird.classList.contains("left");
  bird.className = `canary flying${keep ? " left" : ""}`;
  where = null;
  const from = current();
  const first = target();
  const dist = Math.hypot(first.x - from.x, first.y - from.y);
  const dur = ms || Math.min(2200, 700 + dist * 0.9);
  const lift = 50 + dist * 0.18;
  const start = performance.now();
  bird.classList.toggle("left", first.x < from.x);
  const step = (now) => {
    const to = target();
    if (!to) { flight = 0; bird.className = "canary"; return wander(); }
    const t = Math.min(1, (now - start) / dur), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - lift;
    const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e ** 2 * to.x;
    const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e ** 2 * to.y;
    place(x, y);
    if (t < 1) flight = requestAnimationFrame(step);
    else { flight = 0; bird.classList.remove("flying"); land(); }
  };
  flight = requestAnimationFrame(step);
}

function perchAt(choice, after) {
  const { perch, el, fx } = choice;
  flyTo(() => pointOf(perch, el, fx), () => {
    where = choice;
    if (perch.name === "records" && musicOn()) bird.classList.add("bob");
    if (perch.name === "marker") { peck(); el.classList.add("pecked"); setTimeout(() => el.classList.remove("pecked"), 900); }
    after?.();
    idle();
    schedule();
  });
}

function goHome(then) {
  if (!cageShown()) {
    // no cage on a phone: settle wherever it is (or on the nearest perch)
    if (!where) { const c = choose(); if (c) return perchAt(c, then); }
    return then?.();
  }
  if (bird.parentElement === slot) return then?.();
  const target = () => { const r = slot.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.bottom } : null; };
  flyTo(target, () => {
    slot.append(bird);
    bird.style.transform = "";
    bird.className = "canary home";
    where = "cage";
    then?.();
    idle();
    schedule();
  });
}

// ---- what it does while sitting: little hops, head tilts, a preen ----
function idle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!flight && !bird.classList.contains("sleep")) {
      const move = ["hop", "tilt", "tilt", "preen"][Math.floor(Math.random() * 4)];
      bird.classList.add(move);
      setTimeout(() => bird.classList.remove(move), 700);
    }
    idle();
  }, 3000 + Math.random() * 5000);
}
function peck(times = 2) {
  bird.classList.remove("peck");
  void bird.offsetWidth;
  bird.classList.add("peck");
  setTimeout(() => bird.classList.remove("peck"), 260 * times);
}

// ---- the day: about one flight a minute, home now and then, asleep when the lights are off ----
function schedule() {
  clearTimeout(nextTimer);
  nextTimer = setTimeout(wander, 20000 + Math.random() * 40000);
}
function wander() {
  if (reducedMotion || lightsOff() || (!doorOpen && cageShown())) return goHome();
  if (busy()) return schedule();
  bird.classList.remove("bob");
  if (where !== "cage" && cageShown() && Math.random() < 0.12) return goHome();
  const c = choose();
  if (c) perchAt(c); else schedule();
}

function sleep() {
  bird.classList.remove("bob");
  goHome(() => bird.classList.add("sleep"));
}
function wake() {
  bird.classList.remove("sleep");
  if (doorOpen) { clearTimeout(nextTimer); nextTimer = setTimeout(wander, 1500 + Math.random() * 2500); }
}
new MutationObserver(() => {
  if (lightsOff() && !bird.classList.contains("sleep")) sleep();
  else if (!lightsOff() && bird.classList.contains("sleep")) wake();
}).observe($("app"), { attributes: true, attributeFilter: ["class"] });

// ---- the cage door: closed keeps it in ----
function renderDoor() {
  cage?.classList.toggle("open", doorOpen);
  door?.setAttribute("aria-pressed", String(!doorOpen));
  if (door) door.ariaLabel = doorOpen ? "Close the cage door (the canary stays in)" : "Open the cage door (the canary can fly about)";
  if (door) door.title = door.ariaLabel;
}
door?.addEventListener("click", () => {
  doorOpen = !doorOpen;
  store("bird-door", doorOpen ? "open" : "closed");
  renderDoor();
  if (!doorOpen) goHome();
  else if (!lightsOff()) { clearTimeout(nextTimer); nextTimer = setTimeout(wander, 1200); }
});

// ---- reacting to the room ----
window.addEventListener("keydown", () => { lastKey = Date.now(); }, true);
// the mouse comes close: hop out of the way to somewhere nearby
window.addEventListener("pointermove", (e) => {
  if (!where || where === "cage" || flight || Date.now() - lastShoo < 3000) return;
  const r = bird.getBoundingClientRect();
  if (Math.hypot(e.clientX - (r.left + W / 2), e.clientY - (r.top + H / 2)) > 56) return;
  lastShoo = Date.now();
  const here = current();
  const c = choose((p) => { const el = document.querySelector(p.sel); if (!el) return false; const b = el.getBoundingClientRect(); return Math.hypot(b.left - here.x, b.top - here.y) < 500; }) || choose();
  if (c) perchAt(c);
}, { passive: true });
// after a watering it visits the plant and has a drink
window.addEventListener("hanua:watered", () => {
  if (lightsOff() || (!doorOpen && cageShown()) || reducedMotion) return;
  setTimeout(() => {
    const c = choose((p) => p.name === "plant");
    if (c) perchAt(c, () => setTimeout(() => peck(3), 500));
  }, 2200);
});
// a goal done: a happy hop on the coin
window.addEventListener("hanua:done", () => {
  if (lightsOff() || (!doorOpen && cageShown()) || reducedMotion) return;
  const el = document.querySelector(COIN.sel);
  if (!el) return;
  setTimeout(() => perchAt({ perch: COIN, el, fx: 0.5 }, () => {
    bird.classList.add("happy");
    setTimeout(() => bird.classList.remove("happy"), 1400);
  }), 600);
});
// music starts or stops while it's on the record player
new MutationObserver(() => bird.classList.toggle("bob", musicOn() && where?.perch?.name === "records"))
  .observe($("app"), { attributes: true, attributeFilter: ["data-music"] });

// keep it on its perch when the page scrolls or the window changes; fly off if the perch goes away
function stick() {
  if (!where || where === "cage" || flight) return;
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
if (cageShown()) { slot.append(bird); bird.className = "canary home"; where = "cage"; }
else { const c = choose(); if (c) { where = c; const pt = pointOf(c.perch, c.el, c.fx); place(pt.x, pt.y); } }
if (lightsOff()) bird.classList.add("sleep");
else if (!reducedMotion && doorOpen) { nextTimer = setTimeout(wander, 4000); }
idle();
