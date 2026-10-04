// From the Claude Design handoff "The canary, redrawn" (5 Oct 2026), used as delivered.
// Hanua brass cage, redrawn as vector layers. Frame 830 × 1450, cage centre x = 457, tray bottom y = 1440,
// perch top 35.5% up from the bottom (y = 935) for both door states.
export const CW = 830, CH = 1450, CX = 457, PERCH_Y = 935;
const R = 300, RY = 34, N = 28, RING = 560, CROWN = 232, TRAY = 1250;
const DOOR = { x0: 340, x1: 580, y0: 735, y1: 1090 };
const r1 = (n) => Math.round(n * 10) / 10;

const BR = { front: ["#5A4314", "#9E8038", "#E6CD86", 8, 5.6, 1.8], back: ["#3E2F0E", "#6F5826", "#A88E50", 6.5, 4.4, 1.3] };
function brass(d, depth = "front", extra = "") {
  const [a, b, c, w1, w2, w3] = BR[depth];
  return `<g fill="none" stroke-linecap="round" ${extra}><path d="${d}" stroke="${a}" stroke-width="${w1}"/><path d="${d}" stroke="${b}" stroke-width="${w2}"/><path d="${d}" stroke="${c}" stroke-width="${w3}" transform="translate(-1.4,-0.4)" opacity=".9"/></g>`;
}
const ring = (y, rx, ry, front) => `M${CX + rx},${y} A${rx} ${ry} 0 0 ${front ? 1 : 0} ${CX - rx},${y}`;

function bars(front, openDoor) {
  let s = "";
  for (let i = 0; i < N; i++) {
    const t = ((i + 0.5) / N) * Math.PI * 2, sn = Math.sin(t), cs = Math.cos(t);
    if ((sn >= 0) !== front) continue;
    const x = CX + R * cs, yb = TRAY + RY * sn - 4, yt = RING + RY * sn;
    // vertical bar
    if (front && openDoor && x > DOOR.x0 + 4 && x < DOOR.x1 - 4) {
      s += brass(`M${r1(x)},${r1(yb)} L${r1(x)},${DOOR.y1 + 6}`) + brass(`M${r1(x)},${DOOR.y0 - 6} L${r1(x)},${r1(yt)}`);
    } else s += brass(`M${r1(x)},${r1(yb)} L${r1(x)},${r1(yt)}`, front ? "front" : "back");
    // dome meridian up to the crown
    let d = "";
    for (let k = 0; k <= 22; k++) {
      const ph = (k / 22) * Math.PI / 2;
      const px = CX + R * cs * Math.cos(ph), py = RING + RY * sn * Math.cos(ph) - (RING - CROWN) * Math.sin(ph);
      d += (k ? " L" : "M") + r1(px) + "," + r1(py);
    }
    s += brass(d, front ? "front" : "back");
  }
  return s;
}

const trayGrad = `<linearGradient id="tg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#4E3A12"/><stop offset=".1" stop-color="#86682C"/><stop offset=".28" stop-color="#C2A660"/><stop offset=".4" stop-color="#E4CE8E"/><stop offset=".52" stop-color="#B3954A"/><stop offset=".8" stop-color="#7A5F27"/><stop offset="1" stop-color="#46340F"/></linearGradient>`;

function trayFront() {
  const band = (y0, y1, rx) => `M${CX + rx},${y0} A${rx} ${RY + 4} 0 0 1 ${CX - rx},${y0} L${CX - rx},${y1} A${rx} ${RY + 4} 0 0 0 ${CX + rx},${y1} Z`;
  const line = (y, rx, c, w) => `<path d="${ring(y, rx, RY + 4, true)}" stroke="${c}" stroke-width="${w}" fill="none"/>`;
  return `<path d="${band(TRAY, 1368, 330)}" fill="url(#tg)"/>
<path d="${band(1362, 1402, 346)}" fill="url(#tg)"/>
${line(TRAY + 2, 330, "#F0DCA0", 3)}${line(TRAY + 16, 330, "#5A4314", 2.5)}${line(TRAY + 22, 330, "#E2CB8A", 2)}
${line(1340, 330, "#5A4314", 2)}${line(1346, 330, "#D8C07E", 2)}${line(1363, 346, "#F0DCA0", 2.5)}${line(1380, 346, "#5A4314", 2)}
<path d="${ring(1400, 346, RY + 4, true)}" stroke="#3E2F0E" stroke-width="3" fill="none"/>`;
}

function crown() {
  return `<path d="M${CX - 58},${CROWN + 6} C${CX - 50},${CROWN - 22} ${CX + 50},${CROWN - 22} ${CX + 58},${CROWN + 6} Z" fill="url(#tg)"/>
<ellipse cx="${CX}" cy="${CROWN + 6}" rx="58" ry="10" fill="#7A5F27"/><ellipse cx="${CX}" cy="${CROWN + 3}" rx="56" ry="6" fill="none" stroke="#E6CD86" stroke-width="2" opacity=".7"/>
<rect x="${CX - 14}" y="${CROWN - 46}" width="28" height="30" rx="4" fill="url(#tg)"/>
<circle cx="${CX}" cy="${CROWN - 62}" r="22" fill="url(#tg)"/><circle cx="${CX - 7}" cy="${CROWN - 70}" r="6" fill="#F4E2AA" opacity=".8"/>
<circle cx="${CX}" cy="${CROWN - 128}" r="40" fill="none" stroke="#5A4314" stroke-width="15"/><circle cx="${CX}" cy="${CROWN - 128}" r="40" fill="none" stroke="#A88A40" stroke-width="10"/>
<path d="M${CX - 32},${CROWN - 150} A40 40 0 0 1 ${CX + 10},${CROWN - 167}" fill="none" stroke="#EED89A" stroke-width="3"/>`;
}

function doorPanel(angle) {
  // hinged on the left edge, swings out toward the viewer and to the left
  const a = (angle * Math.PI) / 180, w = DOOR.x1 - DOOR.x0;
  const fx = DOOR.x0 + w * Math.cos(a), grow = 1 + 0.07 * Math.sin(a);
  const h = DOOR.y1 - DOOR.y0, fy0 = DOOR.y0 - (h * (grow - 1)) / 2, fy1 = DOOR.y1 + (h * (grow - 1)) / 2;
  const P = (u, v) => [DOOR.x0 + (fx - DOOR.x0) * u, (DOOR.y0 + (fy0 - DOOR.y0) * u) + ((DOOR.y1 + (fy1 - DOOR.y1) * u) - (DOOR.y0 + (fy0 - DOOR.y0) * u)) * v];
  const L = (p, q) => `M${r1(p[0])},${r1(p[1])} L${r1(q[0])},${r1(q[1])}`;
  let s = brass(`${L(P(0, 0), P(1, 0))} ${L(P(1, 0), P(1, 1))} ${L(P(1, 1), P(0, 1))} ${L(P(0, 1), P(0, 0))}`);
  s += brass(`${L(P(0.03, 0.03), P(0.97, 0.03))} ${L(P(0.97, 0.97), P(0.03, 0.97))}`, "front", 'opacity=".75"');
  for (let i = 1; i < 6; i++) s += brass(L(P(i / 6, 0), P(i / 6, 1)));
  const latch = P(1, 0.42);
  s += `<rect x="${r1(latch[0] - 14)}" y="${r1(latch[1] - 9)}" width="28" height="18" rx="3" fill="url(#tg)" stroke="#5A4314" stroke-width="2"/><circle cx="${r1(latch[0] - 48 * Math.cos(a))}" cy="${r1(latch[1])}" r="7" fill="url(#tg)" stroke="#5A4314" stroke-width="2"/>`;
  s += brass(L([latch[0] - 48 * Math.cos(a), latch[1]], latch));
  return s;
}
function doorFrame() {
  const { x0, x1, y0, y1 } = DOOR;
  return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#5A4314" stroke-width="9"/><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#A88A40" stroke-width="6"/><rect x="${x0 - 1.4}" y="${y0 - 0.4}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#E6CD86" stroke-width="1.6"/>
<rect x="${x0 - 8}" y="${y0 + 70}" width="12" height="34" rx="2" fill="url(#tg)"/><rect x="${x0 - 8}" y="${y1 - 104}" width="12" height="34" rx="2" fill="url(#tg)"/>`;
}

export function cageSVG(layer, opts = {}) {
  let body = "";
  if (layer === "cage-back") {
    body = `<ellipse cx="${CX}" cy="${TRAY}" rx="326" ry="${RY + 2}" fill="url(#ti)"/>
<path d="${ring(TRAY, 330, RY + 4, false)}" stroke="#7A5F27" stroke-width="9" fill="none"/>
${bars(false)}${brass(ring(RING, R, RY, false), "back")}${brass(ring(RING + 28, R, RY, false), "back")}${brass(ring(TRAY - 18, R, RY, false), "back")}`;
  } else if (layer === "cage-perch") {
    body = `<rect x="${CX - 296}" y="${PERCH_Y}" width="592" height="22" rx="5" fill="url(#wd)"/>
<path d="M${CX - 280},${PERCH_Y + 8} h200 M${CX - 40},${PERCH_Y + 13} h250 M${CX + 60},${PERCH_Y + 6} h160" stroke="#5A3418" stroke-width="1.4" opacity=".45"/>
<rect x="${CX - 296}" y="${PERCH_Y}" width="592" height="4" rx="2" fill="#C08A58" opacity=".7"/>`;
  } else if (layer === "cage-front-closed" || layer === "cage-front-open" || layer === "cage-door-frame") {
    const angle = layer === "cage-front-closed" ? 0 : layer === "cage-front-open" ? 150 : opts.angle ?? 0;
    const open = angle > 0;
    body = `${bars(true, open)}${brass(ring(RING, R, RY, true))}${brass(ring(RING + 28, R, RY, true))}${brass(ring(TRAY - 18, R, RY, true))}
${brass(`M${CX + R},${RING} L${CX + R},${TRAY - 4} M${CX - R},${RING} L${CX - R},${TRAY - 4}`)}
${open ? doorFrame() : ""}${doorPanel(angle)}${trayFront()}${crown()}`;
  } else if (layer === "cage-cover") {
    const c = opts.color === "terracotta" ? ["#C4602A", "#9E4A1E", "#E08A5A"] : ["#EFE6D5", "#CBB998", "#FBF6EC"];
    const folds = [190, 260, 330, 400, 470, 540, 610, 690].map((x, i) =>
      `<path d="M${x},${300 + (i % 3) * 20} C${x - 8},600 ${x + 10},900 ${x - 4 + (i % 2) * 10},1170" stroke="${i % 2 ? c[1] : c[2]}" stroke-width="${i % 2 ? 18 : 10}" fill="none" opacity="${i % 2 ? 0.45 : 0.6}" stroke-linecap="round"/>`).join("");
    body = `<defs><clipPath id="cc"><path id="cvp" d="M${CX - 24},${CROWN - 26} C${CX - 190},${CROWN - 10} ${CX - 330},${CROWN + 120} ${CX - 334},${RING + 40} L${CX - 350},1176 Q${CX - 290},1196 ${CX - 230},1180 T${CX - 110},1182 T${CX + 10},1180 T${CX + 130},1184 T${CX + 250},1180 T${CX + 352},1178 L${CX + 334},${RING + 40} C${CX + 330},${CROWN + 120} ${CX + 190},${CROWN - 10} ${CX + 24},${CROWN - 26} Z"/></clipPath></defs>
<path d="M${CX - 24},${CROWN - 26} C${CX - 190},${CROWN - 10} ${CX - 330},${CROWN + 120} ${CX - 334},${RING + 40} L${CX - 350},1176 Q${CX - 290},1196 ${CX - 230},1180 T${CX - 110},1182 T${CX + 10},1180 T${CX + 130},1184 T${CX + 250},1180 T${CX + 352},1178 L${CX + 334},${RING + 40} C${CX + 330},${CROWN + 120} ${CX + 190},${CROWN - 10} ${CX + 24},${CROWN - 26} Z" fill="${c[0]}"/>
<g clip-path="url(#cc)">${folds}<rect x="0" y="0" width="${CW}" height="${CH}" fill="url(#cl)"/><path d="M${CX - 350},1150 Q${CX},1172 ${CX + 352},1150" stroke="${c[1]}" stroke-width="3" stroke-dasharray="10 8" fill="none" opacity=".7"/></g>`;
  }
  const defs = `<defs>${trayGrad}<radialGradient id="ti" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#8A6C30"/><stop offset="1" stop-color="#3A2B0E"/></radialGradient>
<linearGradient id="wd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#B07A4A"/><stop offset=".45" stop-color="#8A5530"/><stop offset="1" stop-color="#4E2C14"/></linearGradient>
<linearGradient id="cl" x1="0" x2="1" y1="0" y2="0.3"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1C1814" stop-opacity=".22"/></linearGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${opts.width ?? CW}" height="${opts.width ? (opts.width * CH) / CW : CH}">${defs}<g id="${layer}">${body}</g></svg>`;
}
export const LAYERS = ["cage-back", "cage-perch", "cage-front-closed", "cage-front-open", "cage-cover"];
export const DOOR_FRAMES = [0, 30, 60, 90, 120, 150];
