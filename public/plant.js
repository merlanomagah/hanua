// The plant on the greeting shelf and its watering can. Pick the can up (drag it over the plant and hold) or
// just click it, and it pours. Each day watered adds a leaf to the vine trailing along the shelf; days missed
// turn it yellow, then brown. The kind version: growth is never lost, and one watering brings it straight back.
import { todayStr } from "./shared/dates.js";
import { plantState } from "./shared/plant.js";
import { $, api, reducedMotion, toast } from "./lib.js";

let watered = [];
let pouring = false;
const SEG = 34; // px between the vine's nodes along the shelf
const DROP = 26; // leaves on the strand that hangs down once the shelf is full

export async function loadPlant() {
  try { watered = (await api("/api/plant")).watered || []; } catch { watered = []; }
  renderPlant();
}

export function renderPlant(grown = false) {
  const s = plantState(watered, todayStr());
  $("plant-drop").toggleAttribute("hidden", s.wateredToday); // a drop by the leaves until it's been watered today (an svg: no .hidden)
  const shelf = document.querySelector(".greet-shelf");
  shelf.dataset.health = s.health;
  const can = $("can");
  can.title = s.wateredToday ? "Watered today ✓ Drag it over the plant, or click, any time" : "Water the plant: drag the can over it and hold, or just click";
  can.ariaLabel = s.wateredToday ? "Watering can. The plant's been watered today" : "Water the plant";
  $("shelf-plant").title = s.days
    ? `${s.days} day${s.days === 1 ? "" : "s"} of care. It's ${s.words}${s.wateredToday ? ", and watered today" : ""}.`
    : "A new plant. Water it each day and it'll grow along the shelf.";
  drawVine(s.days, grown);
}

// The vine: a stem from the pot running left along the front of the shelf, a leaf for every day watered,
// alternating above and below the stem. When the shelf is full, a second strand hangs down from the pot.
function drawVine(leaves, grown) {
  const svg = $("vine"), shelf = document.querySelector(".greet-shelf .float-shelf");
  const box = shelf.getBoundingClientRect(), pot = $("shelf-plant").getBoundingClientRect();
  if (!box.width || !pot.width) return;
  const x0 = pot.left + pot.width * 0.42 - box.left, y0 = 6;
  const nodes = Math.max(0, Math.floor((x0 - 24) / SEG));
  const along = Math.min(leaves, nodes * 2), down = Math.min(Math.max(0, leaves - nodes * 2), DROP);
  svg.setAttribute("viewBox", `0 0 ${box.width} 160`);
  svg.style.width = `${box.width}px`;
  const parts = [];
  if (along) {
    const n = Math.ceil(along / 2);
    // the stem sags a little between nodes, like a real trailing plant
    let d = `M ${x0} ${y0}`;
    for (let i = 1; i <= n; i++) {
      const x = x0 - i * SEG, y = y0 + 9 + (i % 2) * 5 + Math.min(i, 8) * 0.6;
      d += ` Q ${x + SEG / 2} ${y + 9} ${x} ${y}`;
    }
    parts.push(`<path class="stem" d="${d}"/>`);
    for (let k = 0; k < along; k++) {
      const i = Math.floor(k / 2) + 1, up = k % 2 === 0;
      const x = x0 - i * SEG + SEG * 0.25, y = y0 + 9 + (i % 2) * 5 + Math.min(i, 8) * 0.6;
      parts.push(leaf(x, y, up ? -150 + (i % 3) * 12 : 18 - (i % 3) * 10, 0.8 + (i % 4) * 0.07, grown && k === along - 1 + 0 && !down));
    }
  }
  if (down) {
    const x = x0 + 4;
    parts.push(`<path class="stem" d="M ${x} ${y0} C ${x + 10} ${y0 + 30} ${x - 8} ${y0 + 60} ${x + 2} ${y0 + down * 5.2}"/>`);
    for (let k = 0; k < down; k++) {
      const y = y0 + 10 + k * 5;
      parts.push(leaf(x + (k % 2 ? 4 : -2), y, k % 2 ? 40 : -40 + 180, 0.62 + (k % 3) * 0.06, grown && k === down - 1));
    }
  }
  svg.innerHTML = parts.join("");
}

// A pothos leaf: a heart, pointing away from the stem
function leaf(x, y, angle, scale, fresh) {
  return `<g class="leaf${fresh ? " new" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle}) scale(${scale.toFixed(2)})">`
    + `<path d="M0 0 C -7 -3 -11 -11 -7 -17 C -4 -21 0 -19 0 -16 C 0 -19 4 -21 7 -17 C 11 -11 7 -3 0 0 Z"/>`
    + `<path class="vein" d="M0 -2 L0 -15"/></g>`;
}

async function water() {
  const today = todayStr();
  const before = plantState(watered, today);
  if (before.wateredToday) { toast("Already watered today. It's happy 🌿"); return; }
  try {
    watered = (await api("/api/plant/water", { day: today })).watered;
    const after = plantState(watered, today);
    renderPlant(true);
    window.dispatchEvent(new Event("hanua:watered"));
    toast(before.since != null && before.since >= 3
      ? `Watered. It's perking up again (${after.days} days of care).`
      : `Watered ✓ ${after.days} day${after.days === 1 ? "" : "s"} of care.`);
  } catch (err) { toast(err.message, true); }
}

// ---- the can: drag it over the plant and hold to pour, or click (or Enter) and it pours by itself ----
const can = $("can");
let drag = null;
can.addEventListener("pointerdown", (e) => {
  if (pouring || e.button > 0) return;
  e.preventDefault();
  can.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false, timer: 0 };
});
can.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  can.classList.add("lifted");
  can.style.transform = `translate(${dx}px, ${dy}px)`;
  // the spout is the can's left tip: pour when it's over the plant
  const spout = can.getBoundingClientRect(), pot = $("shelf-plant").getBoundingClientRect();
  const over = spout.right > pot.left - 10 && spout.left < pot.right && spout.bottom > pot.top - 60 && spout.top < pot.top + pot.height * 0.6;
  can.classList.toggle("pour", over);
  if (over && !drag.timer) drag.timer = setTimeout(() => { drag && (drag.done = true); water(); }, 900);
  if (!over && drag.timer) { clearTimeout(drag.timer); drag.timer = 0; }
});
const putBack = () => {
  can.classList.remove("pour", "lifted");
  can.style.transform = "";
};
can.addEventListener("pointerup", () => {
  if (!drag) return;
  const { moved, timer, done } = drag;
  clearTimeout(timer);
  drag = null;
  if (!moved) return autoPour();
  if (done) setTimeout(putBack, 350); else putBack();
});
can.addEventListener("pointercancel", () => { if (drag) clearTimeout(drag.timer); drag = null; putBack(); });
can.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); autoPour(); } });

// Click, tap or Enter: the can lifts over to the plant, pours, and goes back
function autoPour() {
  if (pouring) return;
  if (reducedMotion) return water();
  pouring = true;
  const c = can.getBoundingClientRect(), pot = $("shelf-plant").getBoundingClientRect();
  const dx = pot.left + pot.width * 0.35 - c.right + 6, dy = pot.top - c.bottom + 4;
  can.classList.add("lifted", "gliding");
  can.style.transform = `translate(${dx}px, ${dy}px)`;
  setTimeout(() => can.classList.add("pour"), 420);
  setTimeout(() => water(), 900);
  setTimeout(() => { can.classList.remove("pour"); can.style.transform = ""; }, 1500);
  setTimeout(() => { can.classList.remove("lifted", "gliding"); pouring = false; }, 1950);
}

// the shelf changes width with the window, and the plant's health changes at midnight
let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderPlant(), 150); });
setInterval(() => renderPlant(), 60_000);
