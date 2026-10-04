// From the Claude Design handoff "The canary, redrawn" (5 Oct 2026), used as delivered.
// Hanua canary rig. One parametric vector drawing; every pose is a list of parameter frames.
// Frame box 168 × 144 (4× of 42 × 36). Feet anchor (84, 144). Body centre of mass (84, 100) in every frame,
// flight included, so frames swap without a jump. Faces right; mirror with scaleX(-1) to face left.
export const W = 168, H = 144;

const D = { rot: -25, fluff: 1, hRot: 0, hTurn: 0, hFlip: 0, hx: 0, hy: 0, tuck: 0, eye: 1, beak: 0,
  wing: null, wLift: 0, far: 0, tail: 0, spread: 0, legs: "perch", crouch: 0, by: 0, bx: 0, ruffle: 0, shadow: 1 };

const C = {
  back: "#E9B41C", mid: "#F8D332", belly: "#FBE68A", crown: "#EAB51E",
  edge: "#A49B3E", feather: "#E2B52C", featherDk: "#CDA024", covert: "#F0C431",
  beak1: "#F4D3C4", beak2: "#D59C8B", leg1: "#C88A7A", leg2: "#EDBFAE", eye: "#120D09", ring: "#FFF5CC",
};

const r2 = (n) => Math.round(n * 100) / 100;
const rad = (d) => (d * Math.PI) / 180;
function rotP([x, y], deg) { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [x * c - y * s, x * s + y * c]; }
// tiny seeded random so feather texture is identical every render
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function leaf(x1, y1, x2, y2, w) {
  // a feather: narrow leaf from root to tip, w = half width
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
  const mx = x1 + dx * 0.45, my = y1 + dy * 0.45;
  return `M${r2(x1)},${r2(y1)} Q${r2(mx + nx)},${r2(my + ny)} ${r2(x2)},${r2(y2)} Q${r2(mx - nx)},${r2(my - ny)} ${r2(x1)},${r2(y1)}Z`;
}

const BODY = "M40,-2 C40,-18 26,-27 6,-27 C-14,-27 -32,-18 -44,-6 C-48,-2 -48,4 -44,6 C-32,16 -14,26 6,26 C26,26 40,14 40,-2Z";
const HEAD = "M-16,2 C-17,-11 -7,-18 3,-18 C12,-18 17,-11 17,-3 C17,5 13,12 4,14 C-6,15 -15,11 -16,2Z";

function defs(id) {
  return `<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${C.back}"/><stop offset=".42" stop-color="${C.mid}"/><stop offset="1" stop-color="${C.belly}"/></linearGradient>
<radialGradient id="${id}hl" cx=".3" cy=".22" r=".55"><stop offset="0" stop-color="#FFFBE6" stop-opacity=".5"/><stop offset="1" stop-color="#FFFBE6" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}sh" cx=".78" cy=".92" r=".7"><stop offset="0" stop-color="#7A5A14" stop-opacity=".42"/><stop offset="1" stop-color="#7A5A14" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}h" x1=".1" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="${C.crown}"/><stop offset=".55" stop-color="${C.mid}"/><stop offset="1" stop-color="#FBE68A"/></linearGradient>
<linearGradient id="${id}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.beak1}"/><stop offset="1" stop-color="${C.beak2}"/></linearGradient>
<linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.covert}"/><stop offset="1" stop-color="${C.feather}"/></linearGradient>
<radialGradient id="${id}cs" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1C1814" stop-opacity=".42"/><stop offset="1" stop-color="#1C1814" stop-opacity="0"/></radialGradient>
<clipPath id="${id}bc"><path d="${BODY}"/></clipPath>
<clipPath id="${id}hc"><path d="${HEAD}"/></clipPath>
</defs>`;
}

function texture(id, p) {
  // scalloped contour feathers inside the body; more and looser when fluffed
  const R = rng(7 + Math.round(p.ruffle * 3)), a = 2.6 + p.ruffle * 2.4;
  let s = "";
  for (let y = -24; y < 26; y += 6.5) for (let x = -44; x < 40; x += 8) {
    const jx = x + (R() - 0.5) * 4 + (y / 6.5 % 2 ? 4 : 0), jy = y + (R() - 0.5) * 3;
    const dark = jy < 2;
    s += `<path d="M${r2(jx)},${r2(jy)} q${r2(a)},${r2(a * 0.9)} ${r2(a * 2.2)},0" stroke="${dark ? "#B88A1C" : "#FFF9DC"}" stroke-opacity="${dark ? 0.32 : 0.55}" stroke-width=".9" fill="none"/>`;
  }
  return `<g clip-path="url(#${id}bc)">${s}<rect x="-50" y="-30" width="92" height="58" fill="url(#${id}hl)"/><rect x="-50" y="-30" width="92" height="58" fill="url(#${id}sh)"/></g>`;
}

function tufts(p) {
  if (p.ruffle < 0.3 && p.fluff < 1.15) return "";
  const R = rng(11), n = 14; let s = "";
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, x = Math.cos(t) * 40 - 2, y = Math.sin(t) * 25;
    const L = 2 + R() * (2 + p.ruffle * 3);
    s += `<path d="${leaf(x, y, x + Math.cos(t + (R() - 0.5)) * L * 1.6, y + Math.sin(t + (R() - 0.5)) * L, 1.6)}" fill="${y < 0 ? C.back : C.belly}"/>`;
  }
  return s;
}

function foldedWing(id, lift) {
  const prim = [0, 1, 2, 3, 4].map((k) =>
    `<path d="${leaf(-2 - 3 * k, -9 + 2 * k, -49 - 1.2 * k, 0 + 1.6 * k, 3.6)}" fill="${k % 2 ? C.feather : C.featherDk}" stroke="${C.edge}" stroke-width=".6"/>`).join("");
  const tert = [0, 1, 2].map((k) =>
    `<path d="${leaf(6 - 5 * k, -16 + 2 * k, -30 - 4 * k, -6 + 3 * k, 5)}" fill="${C.feather}" stroke="${C.edge}" stroke-width=".7" stroke-opacity=".8"/>`).join("");
  return `<g id="wing-near" transform="translate(20,-15) rotate(${r2(-lift)}) translate(-20,15)">${prim}${tert}
<path d="M26,-14 C16,-25 -8,-24 -22,-15 C-27,-11 -22,-4 -10,-2 C4,0 20,-3 26,-14Z" fill="url(#${id}w)"/>
<path d="M18,-17 q-8,3 -16,1 M10,-20 q-8,3 -18,2 M2,-10 q-8,2 -16,0" stroke="${C.featherDk}" stroke-opacity=".45" stroke-width=".8" fill="none"/></g>`;
}

function openWing(id, w, far) {
  // wing frame: shoulder at origin, wing extends along +x, trailing edge toward -y
  const s = w.ws ?? 1, L = w.wl ?? 1;
  const fA = far ? "#B48A1E" : C.feather, fB = far ? "#9C7716" : C.featherDk, ed = far ? "#6F6E2A" : C.edge;
  let f = "";
  for (let i = 0; i < 6; i++) { const x = 3 + 3.6 * i; f += `<path d="${leaf(x, 1, x - 3 - i * 0.6, 21 - i * 0.4, 4.2)}" fill="${fA}" stroke="${ed}" stroke-width=".8"/>`; }
  for (let j = 6; j >= 0; j--) {
    const a = rad((70 - (62 * j) / 6) * (0.3 + 0.7 * s)), len = 24 + j * 3.2, x = 22 + j * 1.5;
    f += `<path d="${leaf(x, 0, x + Math.cos(a) * len, Math.sin(a) * len, 4.2)}" fill="${j % 2 ? fA : fB}" stroke="${ed}" stroke-width=".8"/>`;
  }
  const cov = `<path d="M-2,-2 C10,-6 30,-5 46,1 C34,10 18,13 4,11 C-2,8 -4,3 -2,-2Z" fill="${far ? "#C99E28" : `url(#${id}w)`}"/><path d="M0,-1 C12,-4 30,-3 46,1" stroke="${far ? "#D9B64A" : "#FBE79A"}" stroke-width="1.4" fill="none"/>`;
  return `<g id="${far ? "wing-far" : "wing-near"}" transform="rotate(${r2(-90 + w.wa)}) scale(${r2(1.22 * L * (far ? 0.92 : 1))},1.22)"><g transform="scale(1,-1)">${f}${cov}</g></g>`;
}

function tail(p) {
  let s = "";
  const n = 6;
  for (let k = 0; k < n; k++) {
    const t = k - (n - 1) / 2, a = rad(180 + t * (2.2 + p.spread * 7.5));
    const len = 33 + Math.abs(t) * 1.4; // outer feathers longer: forked tip
    s += `<path d="${leaf(0, 0, Math.cos(a) * len, Math.sin(a) * len, 3.2)}" fill="${Math.abs(t) > 1 ? C.featherDk : C.feather}" stroke="${C.edge}" stroke-width=".8"/>`;
  }
  return `<g id="tail" transform="translate(-41,4) rotate(${r2(-p.tail - 8)})">${s}<path d="M4,-4 C-6,-5 -14,0 -16,4 C-10,7 0,7 6,4Z" fill="${C.belly}"/></g>`;
}

function toes(x, y, open) {
  const o = open ? 1.6 : 1;
  return `<path d="M${x},${y} q4,${-1 * o} 9,${1.5 * o} M${x},${y} q4,${0.4 * o} 7.5,${3 * o} M${x},${y} q2,${2 * o} 4,${4 * o} M${x},${y} q-3,${0.4} -6,${2.2 * o}"/>`;
}

function legs(id, p, hipN, hipF) {
  const st = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const pair = (a, b, open) => `<g id="legs" ${st}><g stroke="${C.leg1}" stroke-width="2.8">${seg(a, b, open)}</g><g stroke="${C.leg2}" stroke-width="1.3">${seg(a, b, open)}</g></g>`;
  const seg = (a, b, open) => a.map((h, i) => `<path d="M${r2(h[0])},${r2(h[1])} L${r2(b[i][0])},${r2(b[i][1])}"/>${toes(r2(b[i][0]), r2(b[i][1]), open)}`).join("");
  if (p.legs === "perch") return pair([hipF, hipN], [[80, 141.5], [88, 141.5]]);
  if (p.legs === "reach") return pair([hipF, hipN], [[hipF[0] + 8, hipF[1] + 17], [hipN[0] + 11, hipN[1] + 16]], true);
  if (p.legs === "stretch") return pair([hipF, hipN], [[80, 141.5], [hipN[0] - 16, hipN[1] + 10]]);
  return pair([hipF, hipN], [[hipF[0] - 7, hipF[1] + 5], [hipN[0] - 6, hipN[1] + 6]]); // tucked in flight
}

let uid = 0;
export function frameSVG(params, opts = {}) {
  const p = { ...D, ...params };
  const id = "c" + (opts.id ?? (uid++).toString(36)) + "_";
  const cx = 84 + p.bx, cy = 100 - p.by + p.crouch;
  const fx = 1 + (p.fluff - 1) * 0.45, fy = p.fluff;
  const toWorld = (pt) => { const q = rotP([pt[0] * fx, pt[1] * fy], p.rot); return [cx + q[0], cy + q[1]]; };
  const bodyT = `translate(${r2(cx)},${r2(cy)}) rotate(${p.rot}) scale(${r2(fx)},${r2(fy)})`;
  const hipN = toWorld([7, 19]), hipF = toWorld([0, 19]);
  const neck = toWorld([30, -16]);
  const hc = [neck[0] + 8 + p.hx, neck[1] - 14 + p.hy];
  const t = p.hTurn, eyeX = 7 + 2.5 * t, beakS = 1 - 0.45 * Math.abs(t);
  const eye = p.eye
    ? `<g id="eye-open"><circle cx="${eyeX}" cy="-4" r="4.3" fill="${C.ring}" opacity=".75"/><circle cx="${eyeX}" cy="-4" r="3" fill="${C.eye}"/><circle cx="${r2(eyeX - 1.1)}" cy="-5.2" r=".95" fill="#fff"/></g>`
    : `<g id="eye-shut"><path d="M${eyeX - 3},-4 Q${eyeX},-1.6 ${eyeX + 3},-4" stroke="#7A5E1E" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;
  const bo = p.beak * 3;
  const head = `<g id="head" transform="translate(${r2(hc[0])},${r2(hc[1])}) rotate(${p.hRot}) scale(${p.hFlip ? -1 : 1},1)">
<path d="${HEAD}" fill="url(#${id}h)"/>
<g clip-path="url(#${id}hc)"><circle cx="-6" cy="-10" r="14" fill="url(#${id}hl)"/><path d="M-12,-8 q3,2 6,0 M-6,-14 q3,2 6,0 M-13,2 q3,2 6,0 M-4,8 q3,2 6,0" stroke="#B88A1C" stroke-opacity=".28" stroke-width=".8" fill="none"/><path d="M15,-8 C17,-2 15,6 9,11" stroke="#FFF6C8" stroke-width="1.6" fill="none" opacity=".7"/></g>
<g id="beak" transform="translate(14,0) scale(${r2(beakS)},1)"><path d="M0,-6 C5,-5 10,-2 14,0.4 C10,${2.4 + bo} 5,${4 + bo} 0,${4.6 + bo}Z" fill="url(#${id}k)"/><path d="M1,${-0.4 + bo * 0.4} L12,${0.6 + bo * 0.6}" stroke="#B9806F" stroke-width=".7"/><path d="M1,-5.2 C5,-4.5 9,-2.4 12,-0.6" stroke="#FBE6DC" stroke-width=".7" fill="none"/></g>
${eye}</g>`;
  const neckBlob = p.tuck ? "" : `<circle cx="${r2((neck[0] + hc[0]) / 2)}" cy="${r2((neck[1] + hc[1]) / 2 + 2)}" r="${r2(14 * (0.9 + p.fluff * 0.1))}" fill="${C.mid}"/>`;
  const wingNear = p.wing ? `<g transform="${bodyT}"><g transform="translate(18,-15)">${openWing(id, p.wing, false)}</g></g>` : `<g transform="${bodyT}">${foldedWing(id, p.wLift)}</g>`;
  const wingFar = p.wing ? `<g transform="${bodyT}"><g transform="translate(22,-19)">${openWing(id, { ...p.wing, wa: p.wing.wa - (p.wing.lag ?? 8) }, true)}</g></g>` : "";
  const shadow = p.shadow ? `<ellipse cx="84" cy="142.5" rx="${r2(24 - p.by * 0.6)}" ry="3.6" fill="url(#${id}cs)" opacity="${r2(Math.max(0, 1 - p.by / 30) * p.shadow)}"/>` : "";
  const body = `<g id="body" transform="${bodyT}"><path d="${BODY}" fill="url(#${id}b)"/>${texture(id, p)}${tufts(p)}
<path d="M38,-8 C40,2 34,14 22,21" stroke="#FFF4C0" stroke-width="1.4" fill="none" opacity=".4"/></g>`;
  const tailG = `<g transform="${bodyT}">${tail(p)}</g>`;
  const order = p.tuck
    ? [shadow, wingFar, tailG, legs(id, p, hipN, hipF), body, head, wingNear]
    : [shadow, wingFar, tailG, legs(id, p, hipN, hipF), body, neckBlob, wingNear, head];
  const size = opts.size ? `width="${opts.size * W / 168}" height="${opts.size * H / 168}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${size} overflow="visible">${defs(id)}<g id="canary" transform="translate(84 144) scale(1.12) translate(-84 -144)">${order.join("")}</g></svg>`;
}

// ---- poses ----
const P = {}; // perch defaults
const flap = (wa, ws, wl, extra = {}) => ({ rot: -8, fluff: 0.92, legs: "tuck", shadow: 0, tail: -8, spread: 0.4, wing: { wa, ws, wl }, ...extra });
export const POSES = {
  perch: { ms: 600, loop: true, ease: "ease-in-out", note: "Rest, slow breathing swell",
    frames: [{}, { fluff: 1.02 }, { fluff: 1.035 }, { fluff: 1.02 }] },
  look: { ms: 100, loop: false, ease: "steps", note: "Sharp head turns",
    frames: [{ hTurn: 0.8, hRot: -4 }, { hTurn: 0.8, hRot: -4 }, { hTurn: -0.7, hRot: 6, hx: -1 }, {}] },
  tilt: { ms: 200, loop: false, ease: "steps", note: "Curious tilt",
    frames: [{ hRot: -14, hy: -1 }, { hRot: -27, hy: -2, hTurn: 0.3 }, { hRot: -14, hy: -1 }] },
  preen: { ms: 150, loop: false, ease: "steps", note: "Beak into the wing",
    frames: [{ hRot: 20, hx: -4, hy: 2, wLift: 3 }, { hFlip: 1, hx: -16, hy: 10, hRot: -35, wLift: 8, fluff: 1.05 },
      { hFlip: 1, hx: -20, hy: 15, hRot: -48, wLift: 12, fluff: 1.08, ruffle: 0.5 }, { hFlip: 1, hx: -22, hy: 17, hRot: -55, wLift: 13, fluff: 1.08, ruffle: 0.6 },
      { hFlip: 1, hx: -19, hy: 15, hRot: -45, wLift: 12, fluff: 1.08, ruffle: 0.5 }, { hFlip: 1, hx: -22, hy: 17, hRot: -55, wLift: 13, fluff: 1.07, ruffle: 0.6 },
      { hFlip: 1, hx: -14, hy: 8, hRot: -30, wLift: 6, fluff: 1.04 }, { hRot: 8, hx: -2, wLift: 2 }] },
  hop: { ms: 80, loop: false, ease: "steps", note: "Hop in place or along a perch",
    frames: [{ crouch: 4, rot: -30 }, { by: 12, legs: "tuck", rot: -22, wLift: 10, tail: -6 }, { by: 17, legs: "tuck", rot: -20, wLift: 6 },
      { by: 8, legs: "reach", rot: -26, tail: 6 }, { crouch: 3, rot: -27 }] },
  peck: { ms: 62, loop: false, ease: "steps", note: "One peck (play 2–3 times)",
    frames: [{ rot: -14, hRot: 22, hx: 4, hy: 6 }, { rot: -2, hRot: 48, hx: 9, hy: 17, crouch: 2 }, { rot: 2, hRot: 58, hx: 11, hy: 21, crouch: 3 }, { rot: -16, hRot: 18, hx: 3, hy: 4 }] },
  bob: { ms: 120, loop: true, ease: "steps", note: "Head bob to music",
    frames: [{}, { hy: 3, hRot: 7, crouch: 1 }, { hy: 6, hRot: 12, crouch: 2 }, { hy: 3, hRot: 6, crouch: 1 }] },
  fluff: { ms: 117, loop: false, ease: "steps", note: "Shake, fluff, settle",
    frames: [{ fluff: 1.12, ruffle: 0.4 }, { fluff: 1.26, ruffle: 1, hRot: -10, wLift: 6, spread: 0.6 }, { fluff: 1.24, ruffle: 1, hRot: 10, wLift: 4, spread: 0.7, bx: 1 },
      { fluff: 1.2, ruffle: 0.8, hRot: -6, bx: -1 }, { fluff: 1.08, ruffle: 0.3 }, { fluff: 1.03 }] },
  sleep: { ms: 800, loop: true, ease: "ease-in-out", note: "Fluffed ball, head tucked",
    frames: [0, 0.03, 0.05, 0.03].map((b) => ({ rot: -10, fluff: 1.36 + b, crouch: 9, tuck: 1, hFlip: 1, hx: -22, hy: 14, hRot: -28, eye: 0, legs: "perch", ruffle: 0.2, tail: -10 })) },
  wake: { ms: 125, loop: false, ease: "steps", note: "Head out, stretch a wing, settle",
    frames: [{ rot: -10, fluff: 1.36, crouch: 9, tuck: 1, hFlip: 1, hx: -16, hy: 10, hRot: -20, eye: 0, tail: -10 },
      { rot: -16, fluff: 1.28, crouch: 7, hx: -4, hy: 6, hRot: 10, eye: 0 }, { rot: -20, fluff: 1.2, crouch: 5, hRot: 4, eye: 1 },
      { rot: -22, fluff: 1.1, crouch: 2, legs: "stretch", wing: { wa: 200, ws: 1, wl: 0.85 }, tail: 10, spread: 0.8 },
      { rot: -22, fluff: 1.08, legs: "stretch", wing: { wa: 210, ws: 1, wl: 0.9 }, tail: 12, spread: 1 },
      { rot: -24, fluff: 1.05, wing: { wa: 190, ws: 0.4, wl: 0.7 }, tail: 6, spread: 0.4 }, { rot: -25, fluff: 1.08, ruffle: 0.4 }, { rot: -25 }] },
  takeoff: { ms: 50, loop: false, ease: "steps", note: "Crouch, spring, first beat",
    frames: [{ crouch: 6, rot: -32, hy: 2, tail: 8 }, { by: 6, rot: -20, legs: "reach", wing: { wa: 10, ws: 0.6, wl: 0.8 }, shadow: 0.8 },
      { by: 4, rot: -14, legs: "tuck", wing: { wa: -15, ws: 1, wl: 1 }, shadow: 0, tail: 4, spread: 0.5 }, flap(120, 0.8, 0.8)] },
  flap: { ms: 20, loop: true, ease: "linear", note: "One wingbeat (0.12 s)",
    frames: [flap(-15, 1, 1), flap(25, 0.9, 0.85), flap(75, 0.8, 0.45), flap(130, 0.7, 0.75), flap(165, 0.4, 0.8, { tail: 0 }), flap(-55, 0.15, 0.6, { tail: 6 })] },
  glide: { ms: 240, loop: false, ease: "hold", note: "Wings tucked between bursts",
    frames: [{ rot: -4, fluff: 0.95, legs: "tuck", shadow: 0, tail: 2, spread: 0 }] },
  land: { ms: 62, loop: false, ease: "steps", note: "Flare: wings up and forward, tail down, feet reach",
    frames: [{ rot: -48, legs: "reach", wing: { wa: -30, ws: 1, wl: 1, lag: 4 }, tail: 26, spread: 1, shadow: 0.3, by: 8 },
      { rot: -56, legs: "reach", wing: { wa: -50, ws: 1, wl: 0.95 }, tail: 30, spread: 1, shadow: 0.7, by: 3 },
      { rot: -34, crouch: 4, wing: { wa: 140, ws: 0.4, wl: 0.6 }, tail: 14, spread: 0.5 }, { rot: -27, crouch: 1, wLift: 4, tail: 4 }] },
  happy: { ms: 117, loop: false, ease: "steps", note: "Two quick bounces, wings flicked",
    frames: [{ crouch: 4 }, { by: 12, legs: "tuck", wing: { wa: -40, ws: 0.4, wl: 0.7 }, shadow: 0.6 }, { crouch: 3, wLift: 6 },
      { by: 14, legs: "tuck", wing: { wa: -45, ws: 0.5, wl: 0.75 }, shadow: 0.6, hRot: -8 }, { crouch: 3, wLift: 4 }, { fluff: 1.04 }] },
};
export const ORDER = Object.keys(POSES);

// the layered SVG alternative: perch pose with every named group
export function layeredSVG() { return frameSVG(POSES.perch.frames[0], { id: "L" }); }
