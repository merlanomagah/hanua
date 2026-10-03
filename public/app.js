const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrow = () => matchMedia("(max-width: 900px)").matches;

// Which Notion area plays which part on the page (ids from config/areas.json)
const ROLE = { tasks: "work", events: "calendar", notes: "learning", people: "relationships" };
const MONEY_BOOK = { id: "money", label: "Money", icon: "$", color: "#2e5e4e", money: true };

let state = { areas: [], money: null, status: {} };

// ---------- helpers ----------

function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const dayOf = (iso) => (iso || "").slice(0, 10);
const timeOf = (iso) => (iso && iso.includes("T") ? iso.slice(11, 16) : "");
const parseDay = (iso) => { const [y, m, d] = dayOf(iso).split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
const money = (n, dp = 0) => "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function fmtDay(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return iso ? parseDay(iso).toLocaleDateString(undefined, opts) : "";
}
function hash(str) {
  let x = 0;
  for (const ch of str) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return (x % 1000) / 1000;
}
const area = (id) => state.areas.find((a) => a.id === id);
const records = (id) => area(id)?.records ?? [];
const isDone = (r) => /^(done|complete|reached)/i.test(r.status || "");

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

// ---------- plants ----------

function vine(len, sway, seed) {
  // a trailing stem with leaves on alternating sides
  let d = "M0 0", leaves = "";
  for (let i = 1; i <= len; i++) {
    const y = i * 22, x = Math.sin(i * 0.9 + seed) * sway;
    d += ` L${x.toFixed(1)} ${y}`;
    const side = i % 2 ? 1 : -1;
    const fill = i % 3 ? "var(--leaf)" : "var(--leaf-2)";
    leaves += `<ellipse cx="${(x + side * 9).toFixed(1)}" cy="${y - 4}" rx="9" ry="5.5" fill="${fill}" transform="rotate(${side * 35} ${(x + side * 9).toFixed(1)} ${y - 4})"/>`;
  }
  return `<path d="${d}" fill="none" stroke="#3f6338" stroke-width="1.6"/>${leaves}`;
}
function drawPlants() {
  const hanging = (seed) => `
    <line x1="70" y1="0" x2="40" y2="92" stroke="#8d8273" stroke-width="1.2"/>
    <line x1="70" y1="0" x2="100" y2="92" stroke="#8d8273" stroke-width="1.2"/>
    <circle cx="70" cy="4" r="4" fill="#8d8273"/>
    <g transform="translate(52 104)">${vine(6, 6, seed)}</g>
    <g transform="translate(88 104)">${vine(8, 8, seed + 2)}</g>
    <g transform="translate(70 106)">${vine(4, 5, seed + 4)}</g>
    <path d="M34 90 h72 l-8 26 q-28 8 -56 0 z" fill="#d9c7aa"/>
    <path d="M34 90 h72" stroke="#b9a684" stroke-width="3"/>
    ${[...Array(7)].map((_, i) => `<ellipse cx="${44 + i * 9}" cy="${86 - (i % 2) * 6}" rx="8" ry="12" fill="${i % 2 ? "var(--leaf)" : "var(--leaf-2)"}" transform="rotate(${(i - 3) * 14} ${44 + i * 9} ${92})"/>`).join("")}`;
  document.querySelector(".hanging.left").innerHTML = hanging(0);
  document.querySelector(".hanging.right").innerHTML = hanging(3);
  document.querySelector(".pot-plant").innerHTML = `
    ${[...Array(9)].map((_, i) => `<ellipse cx="${45 + (i - 4) * 5}" cy="${30 - Math.abs(i - 4) * -2}" rx="5" ry="20" fill="${i % 2 ? "var(--leaf)" : "var(--leaf-2)"}" transform="rotate(${(i - 4) * 16} 45 50)"/>`).join("")}
    <path d="M26 48 h38 l-5 30 h-28 z" fill="#c9774f"/><rect x="24" y="46" width="42" height="7" rx="2" fill="#b5653f"/>`;
}

// ---------- bookcase ----------

function shelfBooks() {
  const list = state.areas.map((a) => ({ ...a }));
  const at = Math.max(0, list.findIndex((a) => a.id === ROLE.events) + 1);
  list.splice(at, 0, { ...MONEY_BOOK, live: state.money?.live });
  return list;
}

function renderShelf() {
  const nav = $("books");
  const books = shelfBooks();
  const groups = [books.slice(0, 3), books.slice(3)];
  nav.replaceChildren();
  groups.forEach((group, gi) => {
    group.forEach((b, i) => {
      const r = hash(b.id);
      const badge = badgeFor(b);
      const el = h("button", { className: "book", type: "button", ariaLabel: `Open ${b.label}` },
        h("span", { className: "b-icon", textContent: b.icon }),
        h("span", { className: "b-title", textContent: b.label }),
        h("span", { className: "b-vol", textContent: `VOL. ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][books.indexOf(b)] ?? ""}` }),
        badge ? h("span", { className: "b-badge", textContent: badge }) : null,
      );
      el.dataset.id = b.id;
      el.style.cssText = `--c:${b.color};--w:${Math.round(80 + r * 16)}%;--h:${Math.round(46 + r * 12)}px;--x:${Math.round(((i + gi) % 2) * r * 6)}%`;
      el.addEventListener("click", () => openBook(b.id, el));
      nav.append(el);
    });
    nav.append(h("div", { className: "shelf-plank" }));
  });
  // bottom shelf: a trailing plant and a stone bookend, to make it feel lived in
  const deco = h("div", { className: "case-deco", ariaHidden: "true" });
  deco.innerHTML = `
    <svg viewBox="0 0 92 84"><g transform="translate(30 40)">${vine(2, 3, 1)}</g><g transform="translate(58 40)">${vine(2, 3, 4)}</g>
      ${[...Array(8)].map((_, i) => `<ellipse cx="${30 + i * 5}" cy="${36 - (i % 2) * 5}" rx="7" ry="10" fill="${i % 2 ? "var(--leaf)" : "var(--leaf-2)"}" transform="rotate(${(i - 3.5) * 16} ${30 + i * 5} 44)"/>`).join("")}
      <path d="M22 40 h48 l-6 30 h-36 z" fill="#e8dcc6"/><rect x="20" y="38" width="52" height="6" rx="2" fill="#d6c7ab"/></svg>
    <svg class="bookend" viewBox="0 0 46 64"><path d="M4 64 V22 q0 -18 19 -18 q19 0 19 18 V64 z" fill="#b9b0a2"/><path d="M10 64 V26 q0 -12 13 -12" fill="none" stroke="#a39a8c" stroke-width="2"/></svg>`;
  nav.append(deco);
}

function badgeFor(b) {
  const today = todayStr();
  if (b.id === ROLE.tasks) {
    const n = records(ROLE.tasks).filter((r) => !isDone(r) && r.date && dayOf(r.date) <= today).length;
    return n ? String(n) : "";
  }
  if (b.id === ROLE.events) {
    const n = records(ROLE.events).filter((r) => dayOf(r.date) === today).length;
    return n ? String(n) : "";
  }
  return "";
}

// ---------- wall: money screen ----------

function renderMoneyScreen() {
  const m = state.money;
  const el = $("money-screen");
  if (!m) return el.replaceChildren(h("div", { className: "screen-in" }, h("p", { className: "eyebrow", textContent: "Loading Pūtea…" })));
  const month = parseDay(`${m.month.ym}-01`).toLocaleDateString(undefined, { month: "long" });
  const change = m.month.prevExpenses ? (m.month.expenses - m.month.prevExpenses) / m.month.prevExpenses : 0;
  const max = Math.max(...m.month.categories.map((c) => c.total), 1);
  el.replaceChildren(h("div", { className: "screen-in" },
    h("div", { className: "screen-top" },
      h("p", { className: "eyebrow", textContent: `${month} spending` }),
      m.month.prevExpenses
        ? h("span", { className: `delta ${change <= 0 ? "down" : "up"}`, textContent: `${change <= 0 ? "↓" : "↑"} ${Math.abs(change * 100).toFixed(0)}% vs last month` })
        : null,
    ),
    h("div", { className: "big", textContent: money(m.month.expenses) }),
    h("div", { className: "cats" }, m.month.categories.map((c) =>
      h("div", { className: "cat" },
        h("span", { textContent: c.name }),
        h("i", {}, Object.assign(h("b"), { style: `width:${(c.total / max) * 100}%` })),
        h("span", { textContent: money(c.total) }),
      ))),
    h("div", { className: "screen-foot" },
      h("span", { textContent: m.live ? "Pūtea · live" : "Sample · Pūtea isn't running" }),
      h("span", { textContent: `Last month ${money(m.month.prevExpenses)}` }),
    ),
  ));
}

// ---------- wall: calendar ----------

const TYPE_COLORS = { work: "#2b3f6b", personal: "#2e5e4e", family: "#b04a4f", social: "#9a5530" };
let selectedDay = null;

function calendarItems() {
  const ev = records(ROLE.events).filter((r) => r.date).map((r) => ({ ...r, kind: r.status || "Event", color: TYPE_COLORS[(r.status || "").toLowerCase()] || "#2e5e4e" }));
  const due = records(ROLE.tasks).filter((r) => r.date && !isDone(r)).map((r) => ({ ...r, kind: "Due", color: area(ROLE.tasks)?.color || "#2b3f6b" }));
  return [...ev, ...due];
}

function renderCalendar() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const items = calendarItems();
  const byDay = new Map();
  for (const it of items) {
    const k = dayOf(it.date);
    byDay.set(k, [...(byDay.get(k) || []), it]);
  }
  const today = todayStr();

  const grid = h("div", { className: "cal-grid" },
    ["M", "T", "W", "T", "F", "S", "S"].map((d) => h("div", { className: "dow", textContent: d })));
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    if (i >= 35 && d.getMonth() !== now.getMonth()) break;
    const key = ymd(d);
    const dayItems = byDay.get(key) || [];
    const cell = h("button", {
      type: "button",
      className: `day${d.getMonth() !== now.getMonth() ? " other" : ""}${key === today ? " today" : ""}${dayItems.length ? " has" : ""}${key === selectedDay ? " sel" : ""}`,
      title: dayItems.map((x) => `${timeOf(x.date) ? timeOf(x.date) + " " : ""}${x.title}`).join("\n"),
      tabIndex: dayItems.length ? 0 : -1,
    },
      h("span", { textContent: d.getDate() }),
      h("span", { className: "dots" }, dayItems.slice(0, 3).map((x) => Object.assign(h("i"), { style: `--dot:${x.color}` }))),
    );
    if (dayItems.length) cell.addEventListener("click", () => { selectedDay = selectedDay === key ? null : key; renderCalendar(); });
    grid.append(cell);
  }

  const list = selectedDay
    ? (byDay.get(selectedDay) || [])
    : items.filter((x) => dayOf(x.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const upcoming = h("ul", { className: "upcoming" },
    list.length
      ? list.map((x) => h("li", {},
          h("time", { textContent: dayOf(x.date) === today ? (timeOf(x.date) || "Today") : fmtDay(x.date, { weekday: "short", day: "numeric" }) }),
          h("span", { textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }),
          h("span", { className: "tag", textContent: x.kind })))
      : h("li", { className: "empty", textContent: "Nothing coming up." }));

  $("calendar").replaceChildren(
    h("div", { className: "rings", ariaHidden: "true" }, h("i"), h("i")),
    h("div", { className: "cal-head" },
      h("h2", { textContent: now.toLocaleDateString(undefined, { month: "long" }) }),
      h("p", { className: "eyebrow", textContent: selectedDay ? fmtDay(selectedDay) : String(now.getFullYear()) })),
    grid,
    upcoming,
  );
}

// ---------- wall: sticky notes ----------

const NOTE_COLORS = ["#f8e58c", "#f6c6c0", "#c9e6c7", "#c6dcf2", "#f3d7a4"];

function renderNotes() {
  const today = todayStr();
  const notes = [];
  for (const r of records(ROLE.notes).slice(0, 4)) {
    notes.push({ text: r.title, meta: `Learning · ${fmtDay(r.date, { day: "numeric", month: "short" })}`, book: ROLE.notes });
  }
  for (const r of records(ROLE.people)) {
    const gap = r.date ? daysBetween(r.date, today) : null;
    if (gap !== null && gap >= 21) notes.push({ text: `Catch up with ${r.title}`, meta: `${gap} days since you spoke`, book: ROLE.people });
  }
  for (const r of records(ROLE.tasks)) {
    if (/blocked/i.test(r.status || "")) notes.push({ text: `${r.title} is blocked`, meta: "Work · needs a nudge", book: ROLE.tasks });
  }
  const box = $("notes");
  if (!notes.length) return box.replaceChildren(h("p", { className: "eyebrow", textContent: "Your notes will pin here" }));
  box.replaceChildren(...notes.slice(0, 8).map((n, i) => {
    const r = hash(n.text);
    const el = h("button", { type: "button", className: "note" },
      h("span", { textContent: n.text }), h("small", { textContent: n.meta }));
    el.style.cssText = `--nc:${NOTE_COLORS[i % NOTE_COLORS.length]};--r:${(r * 6 - 3).toFixed(1)}deg`;
    el.addEventListener("click", () => openBook(n.book, document.querySelector(`.book[data-id="${n.book}"]`)));
    return el;
  }));
}

// ---------- table: checklist ----------

function renderTodo() {
  const today = todayStr();
  const tasks = records(ROLE.tasks)
    .filter((r) => (!isDone(r) && (!r.date || dayOf(r.date) <= today)) || (isDone(r) && dayOf(r.date) === today))
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.date || "9").localeCompare(b.date || "9"));
  const list = h("ul", { className: "todo" });
  if (!tasks.length) list.append(h("li", {}, h("span", { className: "empty", textContent: "Nothing due today. Enjoy it." })));
  for (const r of tasks) {
    const late = r.date && dayOf(r.date) < today && !isDone(r);
    const li = h("li", { className: isDone(r) ? "done" : "" },
      h("button", { type: "button", className: "check", ariaLabel: `Mark ${r.title} ${isDone(r) ? "not done" : "done"}`, innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' }),
      h("span", {},
        h("span", { className: "t", textContent: r.title }),
        h("span", { className: `m${late ? " late" : ""}`, textContent: late ? `Overdue · ${fmtDay(r.date)}` : r.status || "To do" })),
    );
    li.querySelector(".check").addEventListener("click", () => toggleTask(r, li));
    list.append(li);
  }
  const open = tasks.filter((r) => !isDone(r)).length;
  $("todo").replaceChildren(
    h("h2", { className: "paper-title", textContent: "Today's list" }),
    h("p", { className: "paper-sub", textContent: `${open} to do · from your Work book` }),
    list,
  );
}

async function toggleTask(r, li) {
  const done = !isDone(r);
  const before = r.status;
  r.status = done ? "Done" : "Not started";
  li.classList.toggle("done", done);
  try {
    const res = await api(`/api/areas/${ROLE.tasks}/records/${r.id}/done`, { done });
    if (!res.live) toast(done ? "Ticked off (sample data, so Notion isn't changed)" : "Back on the list");
    setTimeout(() => { renderTodo(); renderShelf(); renderCalendar(); }, 450);
  } catch (err) {
    r.status = before;
    li.classList.toggle("done", !done);
    toast(err.message, true);
  }
}

// ---------- table: agenda ----------

function renderAgenda() {
  const today = todayStr();
  const now = new Date();
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const items = records(ROLE.events).filter((r) => dayOf(r.date) === today)
    .sort((a, b) => (timeOf(a.date) || "00:00").localeCompare(timeOf(b.date) || "00:00"));
  const list = h("ol", { className: "slots" });
  let nowPlaced = false;
  for (const r of items) {
    const t = timeOf(r.date);
    if (!nowPlaced && t && t > nowHM) { list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` }))); nowPlaced = true; }
    list.append(h("li", { className: `slot${t && t < nowHM ? " past" : ""}` },
      h("time", { textContent: t || "All day" }),
      h("span", {}, h("span", { className: "t", textContent: r.title }), h("span", { className: "k", textContent: r.status || "" }))));
  }
  if (items.length && !nowPlaced) list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` })));
  $("agenda").replaceChildren(
    h("h2", { className: "paper-title", textContent: "Agenda" }),
    h("p", { className: "paper-sub", textContent: now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) }),
    items.length ? list : h("p", { className: "empty", textContent: "No meetings today." }),
  );
}

// ---------- table: week receipt ----------

function renderWeek() {
  const m = state.money;
  if (!m) return;
  const w = m.week;
  const scale = Math.max(w.usual * 1.25, w.spent, 1);
  const maxDay = Math.max(...w.days.map((d) => d.spent), 1);
  const today = todayStr();
  const avg = w.spent / 7;
  const top = w.days.reduce((a, b) => (b.spent > a.spent ? b : a), w.days[0]);
  $("week").replaceChildren(
    h("h3", { textContent: "This week" }),
    h("p", { className: "r-sub", textContent: `${fmtDay(w.days[0].date, { day: "numeric", month: "short" })} – ${fmtDay(w.days[6].date, { day: "numeric", month: "short" })}` }),
    h("div", { className: "r-big", textContent: money(w.spent) }),
    h("div", { className: "week-bar" },
      Object.assign(h("b", { className: w.spent > w.usual ? "over" : "" }), { style: `width:${(w.spent / scale) * 100}%` }),
      Object.assign(h("i", { title: `Usual week ${money(w.usual)}` }), { style: `left:${(w.usual / scale) * 100}%` })),
    h("div", { className: "week-legend" },
      h("span", { textContent: w.spent <= w.usual ? `${money(w.usual - w.spent)} under usual` : `${money(w.spent - w.usual)} over usual` }),
      h("span", { textContent: `Usual ${money(w.usual)}` })),
    h("div", { className: "days" }, w.days.map((d) => {
      const col = h("div", { className: d.date === today ? "today" : "", title: `${fmtDay(d.date)} · ${money(d.spent, 2)}` });
      col.append(Object.assign(h("i"), { style: `height:${Math.max(4, (d.spent / maxDay) * 100)}%` }));
      return col;
    })),
    h("div", { className: "dl" }, w.days.map((d) => h("span", { textContent: parseDay(d.date).toLocaleDateString(undefined, { weekday: "narrow" }) }))),
    h("hr", { className: "r-rule" }),
    h("div", { className: "r-row" }, h("span", { textContent: "Daily average" }), h("span", { textContent: money(avg, 2) })),
    h("div", { className: "r-row" }, h("span", { textContent: `Biggest day (${fmtDay(top.date, { weekday: "short" })})` }), h("span", { textContent: money(top.spent, 2) })),
    h("hr", { className: "r-rule" }),
    h("p", { className: "r-sub", textContent: m.live ? "PŪTEA · AKAHU · LIVE" : "SAMPLE · START PŪTEA FOR LIVE" }),
  );
}

// ---------- the open book ----------

let openEl = null;

function bookPages(id) {
  if (id === "money") return moneyPages();
  const a = area(id);
  const today = todayStr();
  const recent = a.records.filter((r) => r.date && Math.abs(daysBetween(r.date, today)) <= 30).length;
  const open = a.records.filter((r) => r.status && !isDone(r)).length;
  const left = [
    h("p", { className: "eyebrow", textContent: a.live ? "Live from Notion" : "Sample data" }),
    h("h2", { id: "book-title", textContent: a.label }),
    h("p", { className: "sub", textContent: a.error || `${a.records.length} entries` }),
    h("div", { className: "stats" },
      [[a.records.length, "entries"], [recent, "within 30 days"], [open, "still open"], [a.records[0]?.date ? fmtDay(a.records[0].date, { day: "numeric", month: "short" }) : "—", "latest"]]
        .map(([v, l]) => h("div", { className: "stat" }, h("b", { textContent: v }), h("span", { textContent: l })))),
    askForm(id, a.label),
  ];
  const right = [
    h("h3", { textContent: "Entries" }),
    a.records.length
      ? h("ul", { className: "entries" }, a.records.map((r) => h("li", { className: "entry" },
          h("span", { className: "t", textContent: r.title }),
          typeof r.amount === "number" ? h("span", { className: `v ${r.amount < 0 ? "neg" : ""}`, textContent: r.amount.toLocaleString() }) : h("span"),
          h("span", { className: "m" }, [r.date ? fmtDay(r.date) + (timeOf(r.date) ? " " + timeOf(r.date) : "") : null, r.status].filter(Boolean).join(" · "),
            r.url ? h("span", {}, " · ", h("a", { href: r.url, target: "_blank", rel: "noopener", textContent: "Open in Notion ↗" })) : null))))
      : h("p", { className: "empty", textContent: "Blank pages. Use the Feed bar to write the first entry." }),
  ];
  return { left, right };
}

function moneyPages() {
  const m = state.money;
  const left = [
    h("p", { className: "eyebrow", textContent: m.live ? "Live from Pūtea" : "Sample data" }),
    h("h2", { id: "book-title", textContent: "Money" }),
    h("p", { className: "sub", textContent: "Read from your Akahu accounts through Pūtea" }),
    h("div", { className: "stats" },
      [[money(m.month.expenses), "this month"], [money(m.month.prevExpenses), "last month"], [money(m.week.spent), "this week"], [money(m.week.usual), "usual week"]]
        .map(([v, l]) => h("div", { className: "stat" }, h("b", { textContent: v }), h("span", { textContent: l })))),
    askForm(null, "money"),
  ];
  const right = [
    h("h3", { textContent: "Where it went this month" }),
    h("ul", { className: "entries" }, m.month.categories.map((c) => h("li", { className: "entry" },
      h("span", { className: "t", textContent: c.name }), h("span", { className: "v neg", textContent: money(c.total, 2) })))),
    h("h3", { textContent: "The last seven days", style: "margin-top:22px" }),
    h("ul", { className: "entries" }, [...m.week.days].reverse().map((d) => h("li", { className: "entry" },
      h("span", { className: "t", textContent: fmtDay(d.date, { weekday: "long", day: "numeric", month: "short" }) }),
      h("span", { className: "v", textContent: money(d.spent, 2) })))),
  ];
  return { left, right };
}

function askForm(areaId, label) {
  const input = h("input", { type: "text", autocomplete: "off", placeholder: `Ask this book about ${label.toLowerCase()}…` });
  const answer = h("div", { className: "answer", hidden: true });
  const button = h("button", { type: "submit", textContent: "Ask" });
  const form = h("form", { className: "page-ask" }, input, button);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    answer.hidden = false; answer.className = "answer loading"; answer.textContent = "Claude is reading this book…";
    button.disabled = true;
    try {
      const res = await api("/api/ask", { question, areaId: areaId || undefined });
      answer.className = "answer"; answer.textContent = res.answer;
    } catch (err) {
      answer.className = "answer error"; answer.textContent = err.message;
    } finally { button.disabled = false; }
  });
  return h("div", {}, form, answer);
}

async function openBook(id, fromEl) {
  if (openEl || !(id === "money" ? state.money : area(id))) return;
  const book = shelfBooks().find((b) => b.id === id);
  const { left, right } = bookPages(id);
  $("page-left").replaceChildren(...left);
  $("page-right").replaceChildren(...(isNarrow() ? [...left, h("div", { style: "height:18px" }), ...right] : right));
  const ob = $("open-book");
  ob.style.setProperty("--c", book.color);
  $("reader").hidden = false;
  openEl = fromEl;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => $("reader").classList.add("dim"));
  fromEl?.classList.add("out");

  if (fromEl && !reducedMotion) {
    // grow the open book out of the spine you clicked
    const from = fromEl.getBoundingClientRect();
    const to = ob.getBoundingClientRect();
    await ob.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.6 },
      { transform: "none", opacity: 1 },
    ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }).finished;
  }
  $("reader-close").focus({ preventScroll: true });
}

async function closeBook() {
  if (!openEl && $("reader").hidden) return;
  const ob = $("open-book");
  const fromEl = openEl;
  $("reader").classList.remove("dim");
  if (fromEl && !reducedMotion && fromEl.isConnected) {
    fromEl.classList.remove("out");
    const to = fromEl.getBoundingClientRect();
    const from = ob.getBoundingClientRect();
    await ob.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.4 },
    ], { duration: 320, easing: "cubic-bezier(.5,0,.75,0)" }).finished;
  }
  fromEl?.classList.remove("out");
  $("reader").hidden = true;
  document.body.style.overflow = "";
  openEl = null;
  fromEl?.focus({ preventScroll: true });
}

$("reader-close").addEventListener("click", closeBook);
$("reader").addEventListener("click", (e) => { if (e.target === $("reader")) closeBook(); });
$("money-screen").addEventListener("click", () => openBook("money", document.querySelector('.book[data-id="money"]')));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("reader").hidden && !$("draft-dialog").open) closeBook(); });

// ---------- ask across everything ----------

$("ask-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = $("ask-input").value.trim();
  if (!question) return;
  const answer = $("ask-answer");
  answer.hidden = false; answer.className = "answer loading"; answer.textContent = "Claude is reading your wall…";
  try {
    const res = await api("/api/ask", { question });
    answer.className = "answer"; answer.textContent = res.answer;
  } catch (err) {
    answer.className = "answer error"; answer.textContent = err.message;
  }
});

// ---------- feed ----------

let pendingDraft = null;

$("feed-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("feed-input").value.trim();
  if (!text) return;
  const button = e.submitter;
  button.disabled = true; button.textContent = "Thinking…";
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
    button.disabled = false; button.textContent = "Add";
  }
});

$("draft-dialog").addEventListener("close", async () => {
  if ($("draft-dialog").returnValue !== "save" || !pendingDraft) return;
  const draft = pendingDraft;
  pendingDraft = null;
  $("draft-fields").querySelectorAll("input").forEach((input) => { draft.properties[input.dataset.index].value = input.value; });
  try {
    await api("/api/feed/commit", { areaId: draft.areaId, properties: draft.properties });
    $("feed-input").value = "";
    toast("Written into Notion ✓");
    await load();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- boot ----------

function renderHeader() {
  const now = new Date();
  const hr = now.getHours();
  $("greet").textContent = hr < 12 ? "Good morning." : hr < 17 ? "Good afternoon." : "Good evening.";
  $("today-label").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const { notion, claude } = state.status;
  const live = state.areas.filter((a) => a.live).length;
  $("status").replaceChildren(
    h("span", { className: `pill ${notion && live ? "on" : ""}`, textContent: notion ? `Notion ${live}/${state.areas.length}` : "Notion · sample" }),
    h("span", { className: `pill ${state.money?.live ? "on" : ""}`, textContent: state.money?.live ? "Pūtea live" : "Pūtea · sample" }),
    h("span", { className: `pill ${claude ? "on" : ""}`, textContent: claude ? "Claude on" : "Claude off" }),
  );
}

function renderAll() {
  renderHeader();
  renderShelf();
  renderMoneyScreen();
  renderCalendar();
  renderNotes();
  renderTodo();
  renderAgenda();
  renderWeek();
}

async function load() {
  const [areas, moneyData] = await Promise.allSettled([api("/api/areas"), api("/api/money")]);
  if (areas.status === "fulfilled") Object.assign(state, { areas: areas.value.areas, status: areas.value.status });
  else toast(areas.reason.message, true);
  if (moneyData.status === "fulfilled") state.money = moneyData.value;
  renderAll();
}

drawPlants();
load();
// keep the "now" line and greeting current
setInterval(() => { renderHeader(); renderAgenda(); }, 60_000);
