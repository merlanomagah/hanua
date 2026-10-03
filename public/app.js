const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => innerWidth <= 720;

let state = { centre: null, areas: [], status: {}, view: "shelf", open: null };

// ---------- helpers ----------

function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter((c) => c != null));
  return node;
}

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const DAY = 86_400_000;
const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / DAY;
const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

// Stable pseudo-random number per string, so spine heights don't jump between reloads.
function hash(str) {
  let x = 0;
  for (const ch of str) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return (x % 1000) / 1000;
}

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function toast(msg, bad = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("bad", bad);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
}

// "Level" = how active an area has been in the 30 days either side of today.
function activity(records) {
  const recent = records.filter((r) => r.date && Math.abs(daysAgo(r.date)) <= 30).length;
  return { recent, level: Math.floor(Math.sqrt(recent)) + 1, progress: Math.sqrt(recent) % 1 };
}

// ---------- shelf view ----------

function renderShelf() {
  const shelf = $("shelf");
  shelf.replaceChildren(...state.areas.map((area) => {
    // Thicker spine = more entries. Height varies a little so the shelf looks real.
    const width = Math.round(46 + Math.min(area.records.length, 40) * 1.2);
    const height = Math.round(230 + hash(area.id) * 70);
    const { level } = activity(area.records);
    const spine = h("button", {
      className: `spine${area.live ? "" : " sample"}${area.error ? " err" : ""}`,
      ariaLabel: `Open ${area.label}`,
    },
      h("span", { className: "spine-icon", textContent: area.icon }),
      h("span", { className: "spine-title", textContent: area.label }),
      h("span", { className: "spine-meta", textContent: `LV${level}` }),
    );
    spine.dataset.id = area.id;
    spine.style.cssText = `--c:${area.color};--w:${width}px;--h:${height}px`;
    spine.addEventListener("click", () => openBook(area.id, spine));
    spine.addEventListener("mouseenter", () => showSpineCard(area, spine));
    spine.addEventListener("focus", () => showSpineCard(area, spine));
    spine.addEventListener("mouseleave", hideSpineCard);
    spine.addEventListener("blur", hideSpineCard);
    return spine;
  }));
}

function showSpineCard(area, spine) {
  const card = $("spine-card");
  const latest = area.records.find((r) => r.date);
  card.replaceChildren(
    h("h4", { textContent: area.label }),
    h("p", { textContent: `${area.records.length} entries · Lv ${activity(area.records).level}` }),
    latest ? h("p", { textContent: `Latest: ${truncate(latest.title, 24)} · ${fmtDate(latest.date)}` }) : null,
    h("p", { textContent: area.error ? "⚠ Couldn't load from Notion" : area.live ? "Live from Notion" : "Sample data" }),
  );
  card.hidden = false;
  const view = $("shelf-view").getBoundingClientRect();
  const r = spine.getBoundingClientRect();
  const left = Math.min(r.right - view.left + 10, view.width - card.offsetWidth - 8);
  card.style.left = `${Math.max(8, left)}px`;
  card.style.top = `${r.top - view.top - 10}px`;
}

const hideSpineCard = () => ($("spine-card").hidden = true);

// ---------- tree view ----------

function renderTree() {
  const tree = $("tree");
  const R_AREA = 220, R_LEAF = 380, LEAVES = 5;
  const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  tree.replaceChildren();
  const links = svg("g", {}, tree);
  const nodes = svg("g", {}, tree);
  const sector = 360 / state.areas.length;

  state.areas.forEach((area, i) => {
    const angle = -90 + i * sector;
    const [ax, ay] = polar(R_AREA, angle);
    const [qx, qy] = polar(R_AREA * 0.5, angle - sector * 0.15);
    svg("path", { d: `M0 0 Q${qx} ${qy} ${ax} ${ay}`, class: "link trunk", stroke: area.color }, links);

    const leaves = area.records.slice(0, LEAVES);
    const spread = sector * 0.7;
    leaves.forEach((rec, j) => {
      const t = leaves.length === 1 ? 0.5 : j / (leaves.length - 1);
      const la = angle - spread / 2 + t * spread;
      const [lx, ly] = polar(R_LEAF, la);
      const [mx, my] = polar((R_AREA + R_LEAF) / 2, (angle + la) / 2);
      svg("path", { d: `M${ax} ${ay} Q${mx} ${my} ${lx} ${ly}`, class: "link branch", stroke: area.color }, links);
      const leaf = svg("g", { class: "node leaf", tabindex: 0, role: "button", "aria-label": `${area.label}: ${rec.title}` }, nodes);
      svg("circle", { cx: lx, cy: ly, r: 6, stroke: area.color }, leaf);
      const right = Math.cos((la * Math.PI) / 180) >= 0;
      svg("text", { x: lx + (right ? 14 : -14), y: ly, "text-anchor": right ? "start" : "end" }, leaf).textContent = truncate(rec.title, 18);
      svg("title", {}, leaf).textContent = [rec.title, fmtDate(rec.date), rec.status].filter(Boolean).join(" · ");
      onActivate(leaf, () => openBook(area.id, leaf, rec.id));
    });

    const { level, progress } = activity(area.records);
    const node = svg("g", { class: `node area${area.error ? " err" : ""}`, tabindex: 0, role: "button", "aria-label": `Open ${area.label}`, style: `--glow:${area.color}` }, nodes);
    const ringR = 52, circ = 2 * Math.PI * ringR;
    svg("circle", { cx: ax, cy: ay, r: ringR, class: "ring-bg", "stroke-width": 4 }, node);
    svg("circle", {
      cx: ax, cy: ay, r: ringR, class: "ring", stroke: area.color, "stroke-width": 4,
      "stroke-dasharray": circ, "stroke-dashoffset": circ * (1 - Math.max(progress, 0.04)),
      transform: `rotate(-90 ${ax} ${ay})`,
    }, node);
    svg("circle", { cx: ax, cy: ay, r: 42, class: "core", stroke: area.color }, node);
    svg("text", { x: ax, y: ay, class: "icon", fill: area.color }, node).textContent = area.icon;
    svg("text", { x: ax, y: ay + 78, class: "label" }, node).textContent = area.label;
    svg("text", { x: ax, y: ay + 98, class: "meta" }, node).textContent = area.error ? "⚠ couldn't load" : `LV ${level} · ${area.records.length} ITEMS`;
    onActivate(node, () => openBook(area.id, node));
  });

  const centre = svg("g", { class: "node centre", tabindex: 0, role: "button", "aria-label": "Ask across everything", style: "--glow:var(--accent)" }, nodes);
  svg("circle", { cx: 0, cy: 0, r: 64, class: "core" }, centre);
  svg("text", { x: 0, y: -6, class: "icon" }, centre).textContent = state.centre?.icon ?? "✦";
  svg("text", { x: 0, y: 36, class: "meta" }, centre).textContent = (state.centre?.label ?? "Me").toUpperCase();
  onActivate(centre, () => $("ask-all-input").focus());
}

function onActivate(node, fn) {
  node.addEventListener("click", fn);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  });
}

function setView(view) {
  state.view = view;
  try { localStorage.setItem("hanua-view", view); } catch {}
  $("shelf-view").hidden = view !== "shelf";
  $("tree-view").hidden = view !== "tree";
  document.querySelectorAll(".view-toggle button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
}

document.querySelectorAll(".view-toggle button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// ---------- the book ----------
//
// The book is a CSS 3D box: front cover, spine, fore-edge and back cover.
// Closed on the shelf it is turned 90° so only the spine faces you.
// Opening = slide up off the shelf, fly to the centre while turning to face
// you, then swing the cover open on its hinge.

function bookSize() {
  const vw = innerWidth, vh = innerHeight;
  if (isPhone()) return { W: vw - 24, H: vh - 72 };
  return { W: Math.min(460, (vw - 96) / 2), H: Math.min(640, vh - 96) };
}

function buildBook(area, highlightId, size, depth) {
  const index = state.areas.indexOf(area);
  const vol = `Vol. ${ROMAN[index] ?? index + 1}`;
  const book = h("div", { className: "book3d" });
  book.style.cssText = `--W:${size.W}px;--H:${size.H}px;--D:${depth}px;--c:${area.color}`;

  const askPage = [
    h("p", { className: "eyebrow", textContent: `${vol} · ${area.live ? "Live from Notion" : "Sample data"}` }),
    h("h2", { textContent: area.label }),
    h("p", { className: "sub", textContent: area.error || (area.live ? "Kept in your Notion workspace." : "Add a Notion database ID in config/areas.json to make this real.") }),
    h("div", { className: "stats" }),
    askForm(area),
  ];

  const right = h("div", { className: "face right-page" },
    h("div", { className: "ribbon" }),
    h("div", { className: "page" },
      h("div", { className: "mobile-only" }, askPage.map((n) => n.cloneNode(true))),
      h("h3", { textContent: "Entries" }),
      h("ul", { className: "records" }),
    ),
  );

  const cover = h("div", { className: "cover" },
    h("div", { className: "cover-front" },
      h("div", { className: "cover-icon", textContent: area.icon }),
      h("h2", { textContent: area.label }),
      h("p", { className: "eyebrow", textContent: vol }),
    ),
    h("div", { className: "cover-back" },
      isPhone() ? h("div", { className: "endpaper" }) : h("div", { className: "page" }, askPage),
    ),
  );

  book.append(
    h("div", { className: "face back-cover" }),
    h("div", { className: "face page-block" }),
    h("div", { className: "face spine-face" },
      h("span", { className: "spine-icon", textContent: area.icon }),
      h("span", { className: "spine-title", textContent: area.label }),
    ),
    right,
    cover,
  );

  // The phone layout clones the ask form, so wire up every copy.
  book.querySelectorAll("form.page-ask").forEach((f) => wireAsk(f, area));
  fillBook(book, area, highlightId);
  return { book, cover };
}

function askForm(area) {
  return h("div", {},
    h("form", { className: "page-ask" },
      h("input", { type: "text", autocomplete: "off", placeholder: `Ask this book about ${area.label.toLowerCase()}…` }),
      h("button", { type: "submit", textContent: "Ask" }),
    ),
    h("div", { className: "answer", hidden: true }),
  );
}

function wireAsk(form, area) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const question = input.value.trim();
    if (!question) return;
    const answer = form.nextElementSibling;
    const button = form.querySelector("button");
    answer.hidden = false;
    answer.className = "answer loading";
    answer.textContent = "Claude is reading this volume…";
    button.disabled = true;
    try {
      const res = await api("/api/ask", { question, areaId: area.id });
      answer.className = "answer";
      answer.textContent = res.answer;
    } catch (err) {
      answer.className = "answer error";
      answer.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

function fillBook(book, area, highlightId) {
  const { recent, level } = activity(area.records);
  const stats = [[area.records.length, "entries"], [recent, "within 30 days"], [`Lv ${level}`, "activity"]];
  const spend = area.records.filter((r) => typeof r.amount === "number" && r.date && daysAgo(r.date) >= 0 && daysAgo(r.date) <= 30);
  if (spend.length) stats.push([money.format(spend.reduce((s, r) => s + r.amount, 0)), "net · 30 days"]);
  else stats.push([area.records[0]?.date ? fmtDate(area.records[0].date) : "—", "latest"]);
  const statEls = () => stats.map(([v, l]) => h("div", { className: "stat" }, h("b", { textContent: v }), h("span", { textContent: l })));
  book.querySelectorAll(".stats").forEach((s) => s.replaceChildren(...statEls()));

  const list = book.querySelector(".records");
  if (area.error) return list.replaceChildren(h("li", { className: "error", textContent: area.error }));
  if (!area.records.length) return list.replaceChildren(h("li", { className: "empty", textContent: "Blank pages. Use the Feed bar to write the first entry." }));
  list.replaceChildren(...area.records.map((r) => recordItem(r, r.id === highlightId)));
}

function recordItem(r, highlight) {
  return h("li", { className: `record${highlight ? " highlight" : ""}` },
    h("span", { className: "record-title", textContent: r.title }),
    typeof r.amount === "number"
      ? h("span", { className: `record-amount ${r.amount < 0 ? "neg" : "pos"}`, textContent: money.format(r.amount) })
      : h("span"),
    h("div", { className: "record-meta" },
      r.date ? h("span", { textContent: fmtDate(r.date) }) : null,
      r.status ? h("span", { textContent: `· ${r.status}` }) : null,
    ),
    r.url ? h("a", { href: r.url, target: "_blank", rel: "noopener", textContent: "Open ↗" }) : h("span"),
  );
}

// Transform that puts the closed book (spine forward) exactly over `rect`.
function spinePose(rect, size) {
  const s = rect.height / size.H;
  const dx = rect.left + rect.width / 2 - innerWidth / 2;
  const dy = rect.top + rect.height / 2 - innerHeight / 2;
  return { s, dx, dy };
}

const T = (dx, dy, s, turn) => `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotateY(${turn}deg)`;

async function openBook(areaId, fromEl, highlightId) {
  if (state.open) return;
  const area = state.areas.find((a) => a.id === areaId);
  hideSpineCard();
  const size = bookSize();
  const rect = fromEl.getBoundingClientRect();
  const pose = spinePose(rect, size);
  const depth = Math.max(28, Math.min(110, rect.width / pose.s));
  const { book, cover } = buildBook(area, highlightId, size, depth);

  book.style.transform = T(pose.dx, pose.dy, pose.s, 90); // avoid a one-frame flash at the centre
  const reader = $("reader");
  reader.hidden = false;
  reader.append(book);
  state.open = { area, book, cover, fromEl, size, depth };
  if (fromEl.classList.contains("spine")) fromEl.classList.add("out");
  requestAnimationFrame(() => reader.classList.add("dim"));

  const shift = isPhone() ? 0 : size.W / 2; // centre the open two-page spread
  const ms = reducedMotion ? 0 : 1;

  // 1. Slide up off the shelf, then fly to the centre while turning to face us.
  await book.animate([
    { transform: T(pose.dx, pose.dy, pose.s, 90) },
    { transform: T(pose.dx, pose.dy - 70 * pose.s - 20, pose.s, 90), offset: 0.3 },
    { transform: T(0, 0, 1, 0) },
  ], { duration: 900 * ms, easing: "cubic-bezier(.6,.05,.3,1)", fill: "forwards" }).finished;

  // 2. Swing the cover open (and slide right so the spread is centred).
  const coverOpen = cover.animate([
    { transform: `translateZ(${depth / 2}px) rotateY(0deg)` },
    { transform: `translateZ(${depth / 2}px) rotateY(-180deg)` },
  ], { duration: 850 * ms, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" });
  const slide = book.animate([
    { transform: T(0, 0, 1, 0) },
    { transform: T(shift, 0, 1, 0) },
  ], { duration: 850 * ms, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" });
  await Promise.all([coverOpen.finished, slide.finished]);
  book.classList.add("is-open");
  book.querySelector(".record.highlight")?.scrollIntoView({ block: "center" });
  (book.querySelector(".cover-back .page-ask input") || book.querySelector(".page-ask input"))?.focus({ preventScroll: true });

  // Pull fresh rows from Notion while the user reads.
  if (area.live) {
    api(`/api/areas/${area.id}`).then(({ records }) => {
      area.records = records;
      if (state.open?.book === book) fillBook(book, area, highlightId);
    }).catch((err) => toast(err.message, true));
  }
}

async function closeBook() {
  const open = state.open;
  if (!open || open.closing) return;
  open.closing = true;
  const { book, cover, fromEl, size, depth } = open;
  const reader = $("reader");
  const shift = isPhone() ? 0 : size.W / 2;
  const ms = reducedMotion ? 0 : 1;
  book.classList.remove("is-open");

  await Promise.all([
    cover.animate([
      { transform: `translateZ(${depth / 2}px) rotateY(-180deg)` },
      { transform: `translateZ(${depth / 2}px) rotateY(0deg)` },
    ], { duration: 650 * ms, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }).finished,
    book.animate([{ transform: T(shift, 0, 1, 0) }, { transform: T(0, 0, 1, 0) }],
      { duration: 650 * ms, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }).finished,
  ]);

  reader.classList.remove("dim");
  // Fly back to wherever the spine is now (the page may have scrolled).
  const target = fromEl.isConnected ? fromEl.getBoundingClientRect() : null;
  if (target) {
    const pose = spinePose(target, size);
    await book.animate([
      { transform: T(0, 0, 1, 0) },
      { transform: T(pose.dx, pose.dy - 70 * pose.s - 20, pose.s, 90), offset: 0.7 },
      { transform: T(pose.dx, pose.dy, pose.s, 90) },
    ], { duration: 800 * ms, easing: "cubic-bezier(.6,.05,.3,1)", fill: "forwards" }).finished;
  }
  fromEl.classList?.remove("out");
  book.remove();
  reader.hidden = true;
  state.open = null;
  if (fromEl.isConnected) fromEl.focus({ preventScroll: true });
}

$("reader-close").addEventListener("click", closeBook);
$("reader").addEventListener("click", (e) => { if (e.target === $("reader")) closeBook(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.open && !$("draft-dialog").open) closeBook();
});

// ---------- ask across everything ----------

$("ask-all-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = $("ask-all-input").value.trim();
  if (!question) return;
  const answer = $("ask-all-answer");
  answer.hidden = false;
  answer.className = "answer loading";
  answer.textContent = "Claude is reading the whole library…";
  try {
    const res = await api("/api/ask", { question });
    answer.className = "answer";
    answer.textContent = res.answer;
  } catch (err) {
    answer.className = "answer error";
    answer.textContent = err.message;
  }
});

// ---------- feed ----------

let pendingDraft = null;

$("feed-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("feed-input").value.trim();
  if (!text) return;
  const button = e.submitter;
  button.disabled = true;
  button.textContent = "Thinking…";
  try {
    const { draft, areaLabel } = await api("/api/feed/draft", { text });
    pendingDraft = draft;
    $("draft-area").textContent = areaLabel;
    $("draft-note").textContent = draft.note || "Check the fields, then save.";
    $("draft-fields").replaceChildren(...draft.properties.map((p, i) => {
      const input = h("input", { value: p.value });
      input.dataset.index = i;
      return h("label", {}, p.name, input);
    }));
    $("draft-dialog").showModal();
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Add";
  }
});

$("draft-dialog").addEventListener("close", async () => {
  if ($("draft-dialog").returnValue !== "save" || !pendingDraft) return;
  const draft = pendingDraft;
  pendingDraft = null;
  $("draft-fields").querySelectorAll("input").forEach((input) => {
    draft.properties[input.dataset.index].value = input.value;
  });
  try {
    await api("/api/feed/commit", { areaId: draft.areaId, properties: draft.properties });
    $("feed-input").value = "";
    toast("Written into Notion ✓");
    if (state.open) await closeBook();
    await load();
    const spine = document.querySelector(`.spine[data-id="${draft.areaId}"]`);
    if (spine && state.view === "shelf") openBook(draft.areaId, spine);
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- boot ----------

function renderHeader() {
  const { notion, claude } = state.status;
  const live = state.areas.filter((a) => a.live).length;
  const entries = state.areas.reduce((n, a) => n + a.records.length, 0);
  if (state.centre?.title) $("hero-title").textContent = state.centre.title;
  $("hero-count").textContent = `${state.areas.length} volumes · ${entries} entries`;
  $("status").replaceChildren(
    h("span", { className: `pill ${notion && live ? "on" : "warn"}`, textContent: notion ? `Notion ${live}/${state.areas.length}` : "Notion · sample" }),
    h("span", { className: `pill ${claude ? "on" : "warn"}`, textContent: claude ? "Claude on" : "Claude off" }),
  );
}

async function load() {
  try {
    const data = await api("/api/areas");
    Object.assign(state, { centre: data.centre, areas: data.areas, status: data.status });
    renderHeader();
    renderShelf();
    renderTree();
  } catch (err) {
    toast(err.message, true);
  }
}

let saved = "shelf";
try { saved = localStorage.getItem("hanua-view") || "shelf"; } catch {}
setView(saved);
load();
