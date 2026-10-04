// ---- Tree: one goal in the middle, what sits under it spreading out both ways. Click a branch to drill in ----
import { dayOf, todayStr } from "../shared/dates.js";
import { LEVELS, levelIndex } from "../shared/goals.js";
import { $, fmtDay, h, reducedMotion } from "../lib.js";
import { STATE_CLASS, actButton, goalById, kidsOf, renderBoard, rootChoices, setSpiderRoot, spiderRoot } from "./board.js";
import { openGoal } from "./form.js";
import { openPlan } from "./plan.js";
export function spNode(g, depth) {
  const lvl = (g.level || "Task").toLowerCase();
  const st = STATE_CLASS[(g.status || "new").toLowerCase()] || "new";
  const kids = g.children?.length || 0;
  const below = LEVELS[levelIndex(g.level) + 1];
  const late = g.due && st !== "done" && dayOf(g.due) < todayStr();
  const meta = [g.status || "New", kids ? `${g.childDone}/${kids} ${below?.plural || ""}`.trim() : null,
    g.due ? `${late ? "was due" : "due"} ${fmtDay(g.due, { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ");
  const parts = [
    h("span", { className: "sp-type" }, g.level || "Task", depth === 2 && kids ? h("span", { className: "sp-more", textContent: ` +${kids}` }) : null),
    h("span", { className: "sp-title", textContent: g.title }),
    h("span", { className: "g-bar" }, Object.assign(h("i"), { style: `width:${g.progress ?? 0}%` })),
    h("span", { className: `sp-meta${late ? " late" : ""}`, textContent: meta }),
  ];
  if (depth === 0) {
    const el = h("div", { className: `sp-node lv lvl-${lvl} ${st} d0` }, ...parts,
      h("span", { className: "g-actions" },
        actButton("edit", "Edit"),
        below ? actButton("plan", `Plan ${below.plural}`) : null,
        g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null));
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "edit") openGoal(g);
      if (act === "plan") openPlan(g);
    });
    el.dataset.id = g.id;
    return el;
  }
  const el = h("button", { type: "button", className: `sp-node lv lvl-${lvl} ${st} d${depth}`,
    title: below ? `Open “${g.title}” to see its ${below.plural}` : `Review “${g.title}”` }, ...parts);
  el.dataset.id = g.id;
  el.addEventListener("click", () => {
    if (!below) return openGoal(g);
    setSpiderRoot(g.id);
    renderBoard();
  });
  el.addEventListener("dblclick", () => openGoal(g));
  return el;
}

export function renderSpider() {
  const roots = rootChoices();
  if (!goalById(spiderRoot)) setSpiderRoot(roots[0]?.id);
  const wrap = h("div", { className: "sp-wrap" });
  const root = goalById(spiderRoot);
  if (!root) {
    wrap.append(h("p", { className: "pin-empty sp-empty", textContent: "No Epics yet. Press + New and start with a big goal for the year." }));
    return wrap;
  }
  // the path from the Epic down to the goal in the middle, so you can zoom back out
  const trail = [];
  for (let g = root, seen = new Set(); g && !seen.has(g.id); g = goalById(g.parent)) { seen.add(g.id); trail.unshift(g); }
  const crumb = (g) => {
    const b = h("button", { type: "button", className: "sp-crumb", textContent: g.title });
    b.addEventListener("click", () => { setSpiderRoot(g.id); renderBoard(); });
    return b;
  };
  const out = h("button", { type: "button", className: "g-act sp-out", textContent: "‹ Zoom out" });
  out.addEventListener("click", () => { setSpiderRoot(root.parent); renderBoard(); });
  const crumbs = h("nav", { className: "sp-crumbs", ariaLabel: "Where you are" },
    trail.length > 1 ? out : null,
    ...trail.flatMap((g, i) => [i ? h("span", { className: "sp-sep", textContent: "›" }) : null,
      i < trail.length - 1 ? crumb(g) : h("span", { className: "sp-here", textContent: `${g.level}: ${g.title}` })]));
  const stage = h("div", { className: `sp-stage${reducedMotion ? "" : " enter"}` });
  stage.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"), spNode(root, 0));
  const kids = kidsOf(root.id);
  for (const c of kids) {
    stage.append(spNode(c, 1));
    for (const gc of kidsOf(c.id)) stage.append(Object.assign(spNode(gc, 2), { _parent: c.id }));
  }
  const below = LEVELS[levelIndex(root.level) + 1];
  if (!kids.length) {
    const plan = h("button", { type: "button", className: "sp-node sp-ghost d1", textContent: below ? `+ Plan the ${below.plural}` : "Tasks are the smallest level" });
    if (below) plan.addEventListener("click", () => openPlan(root));
    else plan.disabled = true;
    stage.append(plan);
  }
  stage.querySelector("svg").classList.add("sp-lines");
  wrap.append(crumbs, stage);
  return wrap;
}

// Positions the Tree once it's on the page: children split left and right of the centre,
// each with its own children further out, and curved lines between them. Medium widths grow to the right only;
// narrow screens stack it as an outline.
export function layoutSpider() {
  const stage = $("cork-cols").querySelector(".sp-stage");
  if (!stage) return;
  const svg = stage.querySelector("svg");
  svg.replaceChildren();
  const W = stage.clientWidth;
  const stacked = W < 540, oneSide = !stacked && W < 900;
  stage.classList.toggle("stacked", stacked);
  stage.classList.toggle("one-side", oneSide);
  const nodes = [...stage.querySelectorAll(".sp-node")];
  if (stacked) { nodes.forEach((n) => { n.style.left = n.style.top = ""; }); stage.style.height = ""; return; }
  const rootEl = stage.querySelector(".d0");
  const kids = nodes.filter((n) => n.classList.contains("d1"));
  const gk = (k) => nodes.filter((n) => n._parent === k.dataset.id);
  const GAP = 12, BLOCK = 22, PAD = 30;
  const blockH = (k) => Math.max(k.offsetHeight, gk(k).reduce((s, n) => s + n.offsetHeight, 0) + GAP * Math.max(0, gk(k).length - 1));
  // split the branches so both sides weigh about the same, keeping their order
  const total = kids.reduce((s, k) => s + blockH(k), 0);
  let acc = 0;
  const right = [], left = [];
  kids.forEach((k, i) => { (oneSide || i === 0 || acc + blockH(k) / 2 <= total / 2 ? right : left).push(k); acc += blockH(k); });
  const sideH = (list) => list.reduce((s, k) => s + blockH(k), 0) + BLOCK * Math.max(0, list.length - 1);
  const avail = stage.parentElement.clientHeight - stage.offsetTop;
  const H = Math.max(avail, rootEl.offsetHeight + PAD * 2, sideH(right) + PAD * 2, sideH(left) + PAD * 2);
  stage.style.height = `${H}px`;
  const cy = H / 2;
  const place = (el, cx, top) => { el.style.left = `${cx - el.offsetWidth / 2}px`; el.style.top = `${top}px`; };
  place(rootEl, oneSide ? rootEl.offsetWidth / 2 : W / 2, cy - rootEl.offsetHeight / 2);
  const NS = "http://www.w3.org/2000/svg";
  const line = (a, b, dir, lvl) => {
    const ra = { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight };
    const rb = { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
    const x1 = dir > 0 ? ra.x + ra.w : ra.x, y1 = ra.y + ra.h / 2;
    const x2 = dir > 0 ? rb.x : rb.x + rb.w, y2 = rb.y + rb.h / 2;
    const mx = (x1 + x2) / 2;
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    p.setAttribute("class", `lvl-${lvl}`);
    svg.append(p);
  };
  for (const [list, dir] of [[right, 1], [left, -1]]) {
    let y = cy - sideH(list) / 2;
    for (const k of list) {
      const bh = blockH(k), kids2 = gk(k);
      place(k, oneSide ? W * 0.5 : W / 2 + dir * W * 0.215, y + bh / 2 - k.offsetHeight / 2);
      let gy = y + (bh - (kids2.reduce((s, n) => s + n.offsetHeight, 0) + GAP * Math.max(0, kids2.length - 1))) / 2;
      for (const n of kids2) { place(n, oneSide ? W - n.offsetWidth / 2 : W / 2 + dir * W * 0.39, gy); gy += n.offsetHeight + GAP; }
      y += bh + BLOCK;
    }
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  for (const [list, dir] of [[right, 1], [left, -1]]) {
    for (const k of list) {
      line(rootEl, k, dir, k.className.match(/lvl-(\w+)/)?.[1]);
      for (const n of gk(k)) line(k, n, dir, n.className.match(/lvl-(\w+)/)?.[1]);
    }
  }
}
