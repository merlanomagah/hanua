import { GUIDE, WIP_LIMIT, SIZES, SIZE_QUESTIONS, coachChecks, suggestSize } from "./coach.js";

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrow = () => matchMedia("(max-width: 900px)").matches;

// Which Notion area plays which part on the page (ids from config/areas.json)
const ROLE = { tasks: "work", events: "calendar", notes: "learning", people: "relationships" };
const MONEY_BOOK = { id: "money", label: "Money", icon: "$", color: "#2e5e4e", money: true };
// Spine artwork per book (assets/shelf/book-*.png); books without one get a plain cloth spine
const SPINES = { work: "work", calendar: "calendar", money: "money", health: "health", learning: "learning", relationships: "people" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

let state = { areas: [], money: null, status: {}, goals: { goals: [], live: false, notionUrl: null }, records: [], reviews: { reviews: [], live: false }, shop: { items: [], live: false, coinsPerDollar: 10, coinsPerLevel: { Epic: 1000, Feature: 250, PBI: 50, Task: 10 } } };

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
const num = (n, dp = 0) => Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (n, dp = 0) => "$" + num(n, dp);

function fmtDay(iso, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return iso ? parseDay(iso).toLocaleDateString(undefined, opts) : "";
}
// "Saturday, 3 October" in a fixed order, whatever the browser's locale
function longDate(d, comma = true) {
  const wd = d.toLocaleDateString(undefined, { weekday: "long" });
  const mon = d.toLocaleDateString(undefined, { month: "long" });
  return `${wd}${comma ? "," : ""} ${d.getDate()} ${mon}`;
}
const area = (id) => state.areas.find((a) => a.id === id);
const records = (id) => area(id)?.records ?? [];
const isDone = (r) => /^(done|complete|reached)/i.test(r.status || "");

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// A short message at the bottom. Pass an action ({ label, run }) to offer e.g. Undo.
function toast(msg, bad = false, action = null) {
  const t = $("toast");
  t.replaceChildren(msg);
  if (action) {
    const b = h("button", { type: "button", className: "toast-act", textContent: action.label });
    b.addEventListener("click", () => { t.classList.remove("show"); action.run(); });
    t.append(b);
  }
  t.classList.toggle("bad", bad);
  t.classList.toggle("has-action", Boolean(action));
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 6000 : 3500);
}

// ---------- bookcase ----------

let activeBook = null;

function shelfBooks() {
  const list = state.areas.map((a) => ({ ...a }));
  const at = Math.max(0, list.findIndex((a) => a.id === ROLE.events) + 1);
  list.splice(at, 0, { ...MONEY_BOOK, live: state.money?.live });
  return list;
}

function renderShelf() {
  const books = shelfBooks();
  const groups = [books.slice(0, 3), books.slice(3)].filter((g) => g.length);
  $("books").replaceChildren(...groups.map((group) => h("div", { className: "shelf-row" },
    h("div", { className: "shelf-books" }, group.map((b) => {
      const spine = SPINES[b.id];
      const badge = badgeFor(b);
      const el = h("button", { className: `book${spine ? "" : " plain"}${b.id === activeBook ? " active" : ""}`, type: "button", title: b.label, ariaLabel: `Open ${b.label}` },
        h("span", { className: "b-label" },
          h("span", { className: "b-title", textContent: b.label }),
          h("span", { className: "b-vol", textContent: ROMAN[books.indexOf(b)] ?? "" })),
        badge ? h("span", { className: "b-badge", textContent: badge, ariaLabel: `${badge} for today` }) : null,
      );
      el.dataset.id = b.id;
      if (spine) el.style.setProperty("--spine", `url("assets/shelf/book-${spine}.png")`);
      else el.style.setProperty("--c", b.color);
      if (b.id === ROLE.events) el.style.setProperty("--pl", "16%");
      el.addEventListener("click", () => openBook(b.id, el));
      return el;
    })),
    h("img", { src: "assets/shelf/plank.png", alt: "", className: "plank" }),
  )));
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

const bookEl = (id) => document.querySelector(`.book[data-id="${id}"]`);

// ---------- wall: lamp and clock ----------

let lampOn = store("room-lamp") !== "off";

function renderLamp() {
  $("app").classList.toggle("lamp-off", !lampOn);
  $("lamp").title = lampOn ? "Switch lamp off" : "Switch lamp on";
  $("lamp").setAttribute("aria-pressed", String(lampOn));
}
$("lamp").addEventListener("click", () => {
  lampOn = !lampOn;
  store("room-lamp", lampOn ? "on" : "off");
  renderLamp();
});

// Retro flip clock: each digit is a card; when it changes, the top half flips down to show the new one.
const clockShown = [];
function flipTo(card, digit, animate) {
  if (!card.firstChild) {
    card.innerHTML = '<span class="half top"><b></b></span><span class="half bottom"><b></b></span><span class="leaf front"><b></b></span><span class="leaf back"><b></b></span>';
  }
  const [top, bottom, front, back] = card.children;
  const old = top.firstChild.textContent;
  if (!animate || reducedMotion || old === "") {
    for (const el of card.children) el.firstChild.textContent = digit;
    return;
  }
  // new digit waits underneath on top; the old top folds down, then the new bottom lands
  top.firstChild.textContent = digit;
  front.firstChild.textContent = old;
  back.firstChild.textContent = digit;
  card.classList.remove("flipping");
  void card.offsetWidth;
  card.classList.add("flipping");
  setTimeout(() => { bottom.firstChild.textContent = digit; card.classList.remove("flipping"); }, 620);
}

function renderClock() {
  const t = new Date();
  const hr12 = t.getHours() % 12 || 12;
  const digits = `${pad(hr12)}${pad(t.getMinutes())}`;
  for (let i = 0; i < 4; i++) {
    if (clockShown[i] !== digits[i]) flipTo($(`fd${i}`), i === 0 && digits[0] === "0" ? "" : digits[i], clockShown[i] !== undefined);
    clockShown[i] = digits[i];
  }
  $("flip-ampm").textContent = t.getHours() < 12 ? "AM" : "PM";
  $("clock").ariaLabel = `Clock showing ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// ---------- wall: money monitor and its remote ----------

// The remote's power hides every money view (screen, desk receipt, Money book); the screen's own button only the screen.
let moneyHidden = store("room-money") === "hidden";
const CHANNELS = ["Overview", "Expenses", "Income"];
let channel = Math.min(CHANNELS.length - 1, Math.max(0, Number(store("room-channel")) || 0));

const row = (name, mid, amt, cls = "") =>
  h("span", { className: `cat ${cls}` }, h("span", { className: "name", textContent: name }), mid, h("span", { className: "amt", textContent: amt }));

function renderMoneyScreen() {
  const m = state.money;
  const el = $("screen");
  if (!m) return el.replaceChildren(h("span", { className: "screen-title", textContent: "Loading Pūtea…" }));
  const month = parseDay(`${m.month.ym}-01`).toLocaleDateString(undefined, { month: "long" });
  const total = (n) => h("span", { className: "total" }, h("span", { className: "cur", textContent: "$" }), h("span", { className: "num", textContent: num(n) }));
  let body;
  if (channel === 1) {
    const list = m.month.recentExpenses || [];
    body = [
      h("span", { className: "screen-top" },
        h("span", { className: "screen-title", textContent: `${month} expenses` }),
        m.month.expenseCount ? h("span", { className: "delta", textContent: `${m.month.expenseCount} payments` }) : null),
      total(m.month.expenses),
      h("span", { className: "cats tx" }, list.length
        ? list.map((t) => row(t.name, h("span", { className: "when", textContent: `${fmtDay(t.date, { day: "numeric", month: "short" })} · ${t.category}` }), money(t.amount, 2)))
        : h("span", { className: "screen-title", textContent: "No payments yet this month" })),
    ];
  } else if (channel === 2) {
    const income = m.month.income ?? 0;
    const kept = income - m.month.expenses;
    const ratio = income ? Math.min(1, m.month.expenses / income) : 1;
    body = [
      h("span", { className: "screen-top" },
        h("span", { className: "screen-title", textContent: `${month} income` }),
        income ? h("span", { className: `delta${kept < 0 ? " up" : ""}`, textContent: kept >= 0 ? `${money(kept)} kept so far` : `${money(-kept)} more out than in` }) : null),
      total(income),
      h("span", { className: "cats" },
        row("Spent", h("span", { className: "track" }, Object.assign(h("span", { className: `fill${kept < 0 ? " over" : ""}` }), { style: `width:${ratio * 100}%` })), money(m.month.expenses)),
        (m.month.incomes || []).map((t) => row(t.name, h("span", { className: "when", textContent: fmtDay(t.date, { day: "numeric", month: "short" }) }), money(t.amount, 2), "in")),
        (m.month.incomes || []).length ? null : h("span", { className: "screen-title", textContent: "No income in yet this month" })),
    ];
  } else {
    const change = m.month.prevExpenses ? (m.month.expenses - m.month.prevExpenses) / m.month.prevExpenses : 0;
    const max = Math.max(...m.month.categories.map((c) => c.total), 1);
    body = [
      h("span", { className: "screen-top" },
        h("span", { className: "screen-title", textContent: `${month} spending` }),
        m.month.prevExpenses
          ? h("span", { className: `delta${change > 0 ? " up" : ""}`, textContent: `${change <= 0 ? "↓" : "↑"} ${Math.abs(change * 100).toFixed(0)}% vs last month` })
          : null),
      total(m.month.expenses),
      h("span", { className: "cats" }, m.month.categories.map((c) =>
        row(c.name, h("span", { className: "track" }, Object.assign(h("span", { className: "fill" }), { style: `width:${(c.total / max) * 100}%` })), money(c.total)))),
    ];
  }
  el.replaceChildren(...body,
    h("span", { className: "screen-foot" },
      h("span", { textContent: `CH ${channel + 1} · ${CHANNELS[channel]}` }),
      h("span", { textContent: m.live ? "Pūtea · live" : "Sample · Pūtea isn't running" })),
    h("span", { className: "osd", id: "osd", textContent: `CH ${channel + 1}`, ariaHidden: "true" }),
  );
}

// The power button blanks the screen, for when someone is looking over your shoulder. Remembered between visits.
let screenOn = store("room-screen") !== "off";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
function applyScreen(animate) {
  const mon = $("monitor");
  mon.classList.remove("powering-off", "powering-on");
  const done = () => { mon.classList.remove("powering-off", "powering-on"); mon.classList.toggle("off", !screenOn); };
  if (animate && !reduceMotion.matches) {
    if (screenOn) mon.classList.remove("off");
    void mon.offsetWidth;
    mon.classList.add(screenOn ? "powering-on" : "powering-off");
    setTimeout(done, screenOn ? 320 : 380);
  } else done();
  $("screen-power").setAttribute("aria-pressed", String(screenOn));
  $("screen-power").title = screenOn ? "Turn the screen off" : "Turn the screen on";
  $("screen-power").ariaLabel = screenOn ? "Turn the spending screen off" : "Turn the spending screen on";
  $("money-screen").ariaLabel = screenOn ? "Open the Money book" : "Spending screen is off";
  $("screen").setAttribute("aria-hidden", String(!screenOn));
}
function setScreen(on, animate = true) {
  if (on === screenOn) return;
  screenOn = on;
  store("room-screen", screenOn ? "on" : "off");
  applyScreen(animate);
}
$("screen-power").addEventListener("click", () => setScreen(!screenOn));

function blinkRemote() {
  const ir = $("remote-ir");
  ir.classList.remove("blink");
  void ir.offsetWidth;
  ir.classList.add("blink");
}

function applyRemote() {
  const p = $("remote-power");
  p.setAttribute("aria-pressed", String(moneyHidden));
  p.title = moneyHidden ? "Show money views again" : "Hide all money views";
  p.ariaLabel = moneyHidden ? "Show all money views" : "Hide all money views";
  $("app").classList.toggle("money-hidden", moneyHidden);
}

$("remote-power").addEventListener("click", () => {
  blinkRemote();
  moneyHidden = !moneyHidden;
  store("room-money", moneyHidden ? "hidden" : "shown");
  setScreen(!moneyHidden);
  applyRemote();
  renderWeek();
  if (activeBook === "money") closeBook();
});

function changeChannel(step) {
  blinkRemote();
  if (!screenOn) return; // like a real set: channels need the screen on
  channel = (channel + step + CHANNELS.length) % CHANNELS.length;
  store("room-channel", String(channel));
  renderMoneyScreen();
  const glass = $("money-screen");
  glass.classList.remove("tuning");
  void glass.offsetWidth;
  glass.classList.add("tuning");
}
$("ch-up").addEventListener("click", () => changeChannel(1));
$("ch-down").addEventListener("click", () => changeChannel(-1));

applyScreen(false);
applyRemote();

// ---------- wall: calendar ----------

const TYPE_COLORS = { work: "#2b3f6b", personal: "#3B6B5A", family: "#C4602A", social: "#9a5530" };
let selectedDay = todayStr();

function calendarItems() {
  const ev = records(ROLE.events).filter((r) => r.date).map((r) => ({ ...r, kind: r.status || "Event", color: TYPE_COLORS[(r.status || "").toLowerCase()] || "#3B6B5A" }));
  const due = records(ROLE.tasks).filter((r) => r.date && !isDone(r)).map((r) => ({ ...r, kind: "Due", color: "#C4602A" }));
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

  const grid = h("div", { className: "cal-grid" });
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    if (i >= 35 && d.getMonth() !== now.getMonth()) break;
    const key = ymd(d);
    const inMonth = d.getMonth() === now.getMonth();
    const dayItems = byDay.get(key) || [];
    const col = i % 7;
    const cell = h("button", {
      type: "button",
      className: `day${inMonth ? "" : " other"}${key === today ? " today" : ""}${inMonth && key === selectedDay && key !== today ? " sel" : ""}${col >= 5 ? " edge" : ""}`,
      tabIndex: inMonth ? 0 : -1,
      ariaLabel: `${longDate(d, false)}${dayItems.length ? `, ${dayItems.length} item${dayItems.length > 1 ? "s" : ""}` : ""}`,
    },
      h("span", { className: "n", textContent: d.getDate() }),
      dayItems.length ? h("span", { className: "dots" }, dayItems.slice(0, 3).map((x) => Object.assign(h("i"), { style: `--dot:${x.color}` }))) : null,
      inMonth ? h("span", { className: "peek", ariaHidden: "true" },
        h("b", { textContent: fmtDay(key, { weekday: "short", day: "numeric", month: "short" }) }),
        dayItems.length
          ? sortByTime(dayItems).slice(0, 4).map((x) => h("span", {}, h("em", { textContent: timeOf(x.date) || (x.kind === "Due" ? "Due" : "All day") }), x.title))
          : h("span", { className: "quiet", textContent: "Nothing scheduled" }),
        dayItems.length > 4 ? h("span", { className: "quiet", textContent: `+ ${dayItems.length - 4} more` }) : null) : null,
    );
    if (inMonth) cell.addEventListener("click", () => { selectedDay = key; renderCalendar(); openDay(key); });
    grid.append(cell);
  }

  // today shows what's coming up; any other day shows just that day
  const list = selectedDay === today
    ? items.filter((x) => dayOf(x.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
    : (byDay.get(selectedDay) || []);

  $("calendar").closest(".wall-right").classList.toggle("has-list", list.length > 0);
  $("calendar").replaceChildren(
    h("div", { className: "cal-head" },
      h("h2", { textContent: now.toLocaleDateString(undefined, { month: "long" }) }),
      h("span", { textContent: String(now.getFullYear()) })),
    h("div", { className: "dow", ariaHidden: "true" }, ["M", "T", "W", "T", "F", "S", "S"].map((d) => h("span", { textContent: d }))),
    grid,
    h("div", { className: "cal-foot" },
      h("span", { className: "sel-label", textContent: longDate(parseDay(selectedDay), false) }),
      list.length ? null : h("span", { className: "none", textContent: selectedDay === today ? "Nothing coming up." : "Nothing on this day." })),
    list.length
      ? h("ul", { className: "upcoming" }, list.map((x) => h("li", {},
          h("time", { textContent: dayOf(x.date) === today ? (timeOf(x.date) || "Today") : fmtDay(x.date, { weekday: "short", day: "numeric" }) }),
          h("span", { className: "t", textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }),
          h("span", { className: "tag", textContent: x.kind }))))
      : "",
  );
}

const sortByTime = (list) => [...list].sort((a, b) => (timeOf(a.date) || "00:00").localeCompare(timeOf(b.date) || "00:00"));

// The day window: everything on one day, each linking back to its Notion page.
let dialogDay = null;
function openDay(key) {
  dialogDay = key;
  const items = calendarItems().filter((x) => dayOf(x.date) === key);
  const events = sortByTime(items.filter((x) => x.kind !== "Due"));
  const due = items.filter((x) => x.kind === "Due");
  const d = parseDay(key);
  const rel = daysBetween(todayStr(), key);
  $("day-eyebrow").textContent = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : rel > 0 ? `In ${rel} days` : `${-rel} days ago`;
  $("day-title").textContent = longDate(d, false);
  const line = (x, label) => h("li", { className: "entry" },
    h("span", { className: "t", textContent: x.title }),
    h("span", { className: "v", textContent: label }),
    h("span", { className: "m" }, x.kind, x.url ? h("span", {}, " · ", h("a", { href: x.url, target: "_blank", rel: "noopener", textContent: "Open in Notion ↗" })) : null));
  $("day-body").replaceChildren(...[
    events.length ? h("div", {}, h("h4", { textContent: `${events.length} event${events.length > 1 ? "s" : ""}` }),
      h("ul", { className: "entries" }, events.map((x) => line(x, timeOf(x.date) || "All day")))) : null,
    due.length ? h("div", {}, h("h4", { textContent: `${due.length} task${due.length > 1 ? "s" : ""} due` }),
      h("ul", { className: "entries" }, due.map((x) => line({ ...x, kind: "Work" }, x.status || "To do")))) : null,
    items.length ? null : h("p", { className: "empty", textContent: "Nothing scheduled. “Add to this day” drafts something with the Feed bar." }),
  ].filter(Boolean));
  const cal = area(ROLE.events);
  $("day-notion").hidden = !cal?.notionUrl;
  if (cal?.notionUrl) $("day-notion").href = cal.notionUrl;
  if (!$("day-dialog").open) $("day-dialog").showModal();
}
const shiftDay = (key, n) => { const d = parseDay(key); return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
$("day-prev").addEventListener("click", () => openDay(shiftDay(dialogDay, -1)));
$("day-next").addEventListener("click", () => openDay(shiftDay(dialogDay, 1)));
$("day-close").addEventListener("click", () => $("day-dialog").close());
$("day-dialog").addEventListener("click", (e) => { if (e.target === $("day-dialog")) $("day-dialog").close(); });
$("day-add").addEventListener("click", () => {
  $("day-dialog").close();
  $("feed-input").value = `${fmtDay(dialogDay, { weekday: "short", day: "numeric", month: "short" })}: `;
  $("feed-input").focus();
});

// ---------- wall: pinned notes ----------

const NOTE_COLORS = ["#F5DDD0", "#D8EDE8", "#EDE5D4", "#D0E8F0"];
const NOTE_TILTS = ["-2deg", "1.5deg", "-0.8deg", "2.4deg", "-1.6deg"];

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
  if (reviewDue()) notes.unshift({ text: "Weekly review due", meta: "Goals · ten minutes", run: () => { showBoard(true); openReview(); } });
  const box = $("notes");
  if (!notes.length) {
    return box.replaceChildren(h("div", { className: "notes-empty" },
      h("div", { className: "placeholder", ariaHidden: "true" }),
      h("span", { textContent: "Your notes will pin here." })));
  }
  box.replaceChildren(...notes.slice(0, 8).map((n, i) => {
    const el = h("button", { type: "button", className: "note" },
      h("span", { className: "meta", textContent: n.meta }),
      h("span", { className: "text", textContent: n.text }));
    el.style.cssText = `--nc:${NOTE_COLORS[i % NOTE_COLORS.length]};--r:${NOTE_TILTS[i % NOTE_TILTS.length]}`;
    el.addEventListener("click", () => (n.run ? n.run() : openBook(n.book, bookEl(n.book))));
    return el;
  }));
}

// ---------- desk: notepad checklist ----------

const PAD_LINES = 18; // ruled lines left on the notepad below the heading

function renderTodo() {
  const today = todayStr();
  const tasks = records(ROLE.tasks)
    .filter((r) => (!isDone(r) && (!r.date || dayOf(r.date) <= today)) || (isDone(r) && dayOf(r.date) === today))
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.date || "9").localeCompare(b.date || "9"));
  const shown = tasks.length > PAD_LINES ? tasks.slice(0, PAD_LINES - 1) : tasks;
  const list = h("ul", { className: "todo" });
  if (!tasks.length) list.append(h("li", {}, h("span", { className: "empty", textContent: "Nothing due today. Enjoy it." })));
  for (const r of shown) {
    const late = r.date && dayOf(r.date) < today && !isDone(r);
    const li = h("li", { className: isDone(r) ? "done" : "" },
      h("button", { type: "button", className: "check", ariaLabel: `Mark ${r.title} ${isDone(r) ? "not done" : "done"}`, innerHTML: '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' }),
      h("span", { className: "t", textContent: r.title, title: r.title }),
      h("span", { className: `m${late ? " late" : ""}`, textContent: late ? `Overdue · ${fmtDay(r.date, { day: "numeric", month: "short" })}` : r.status || "To do" }),
    );
    li.querySelector(".check").addEventListener("click", () => toggleTask(r, li));
    list.append(li);
  }
  if (shown.length < tasks.length) {
    const more = h("li", {}, h("button", { type: "button", className: "more", style: "border:0;background:none;padding:0;cursor:pointer", textContent: `+ ${tasks.length - shown.length} more in your Work book` }));
    more.firstChild.addEventListener("click", () => openBook(ROLE.tasks, bookEl(ROLE.tasks)));
    list.append(more);
  }
  const open = tasks.filter((r) => !isDone(r)).length;
  $("todo").replaceChildren(
    h("img", { src: "assets/obj/notepad.png", alt: "" }),
    h("div", { className: "pad-lines" },
      h("h2", { className: "pad-title", style: "margin:0", textContent: "Today's list" }),
      h("div", { className: "pad-sub", textContent: `${open} to do · from your Work book` }),
      list),
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

// ---------- desk: agenda ----------

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
      h("span", {}, h("span", { className: "t", textContent: r.title }), r.status ? h("span", { className: "k", textContent: r.status }) : null)));
  }
  if (items.length && !nowPlaced) list.append(h("li", { className: "now-line" }, h("span", { textContent: `NOW ${nowHM}` })));
  $("agenda").replaceChildren(
    h("div", { className: "band", ariaHidden: "true" }),
    h("div", { className: "inner" },
      h("h2", { textContent: "Agenda" }),
      h("div", { className: "date", textContent: longDate(now) }),
      h("div", { className: "body" },
        items.length ? list : h("p", { className: "empty", style: "margin:0", textContent: "No meetings today." }))),
  );
}

// ---------- desk: week receipt ----------

function renderWeek() {
  const m = state.money;
  if (!m) return;
  if (moneyHidden) {
    return $("week").replaceChildren(
      h("div", { className: "paper hidden-paper" },
        h("div", { className: "r-head", textContent: "THIS WEEK" }),
        h("div", { className: "r-hidden", textContent: "Hidden with the remote" }),
        h("div", { className: "r-foot", textContent: "PRESS ⏻ ON THE REMOTE TO SHOW" })),
      h("div", { className: "tear", ariaHidden: "true" }));
  }
  const w = m.week;
  const scale = Math.max(w.usual / 0.86, w.spent * 1.05, 1);
  const maxDay = Math.max(...w.days.map((d) => d.spent), 1);
  const today = todayStr();
  const avg = w.spent / 7;
  const top = w.days.reduce((a, b) => (b.spent > a.spent ? b : a), w.days[0]);
  const short = { day: "numeric", month: "short" };
  $("week").replaceChildren(
    h("div", { className: "paper" },
      h("div", { className: "r-head", textContent: "THIS WEEK" }),
      h("div", { className: "r-range", textContent: `${fmtDay(w.days[0].date, short)} – ${fmtDay(w.days[6].date, short)}` }),
      h("div", { className: "r-big", textContent: money(w.spent) }),
      h("div", { className: "week-bar" },
        Object.assign(h("b", { className: w.spent > w.usual ? "over" : "" }), { style: `width:${(w.spent / scale) * 100}%` }),
        Object.assign(h("i", { title: `Usual week ${money(w.usual)}` }), { style: `left:${(w.usual / scale) * 100}%` })),
      h("div", { className: "week-legend" },
        h("span", { textContent: w.spent <= w.usual ? `${money(w.usual - w.spent)} under usual` : `${money(w.spent - w.usual)} over usual` }),
        h("span", { textContent: `Usual ${money(w.usual)}` })),
      h("div", { className: "days" }, w.days.map((d) => Object.assign(
        h("i", { className: d.date === today ? "today" : "", title: `${fmtDay(d.date)} · ${money(d.spent, 2)}` }),
        { style: `height:${Math.max(4, (d.spent / maxDay) * 100)}%` }))),
      h("div", { className: "dl" }, w.days.map((d) => h("span", { textContent: parseDay(d.date).toLocaleDateString(undefined, { weekday: "narrow" }) }))),
      h("div", { className: "r-rows" },
        h("div", { className: "r-row" }, h("span", { textContent: "Daily average" }), h("span", { textContent: money(avg, 2) })),
        h("div", { className: "r-row" }, h("span", { textContent: `Biggest day (${fmtDay(top.date, { weekday: "short" })})` }), h("span", { textContent: money(top.spent, 2) }))),
      h("div", { className: "r-foot", textContent: m.live ? "PŪTEA · AKAHU · LIVE" : "SAMPLE · START PŪTEA FOR LIVE" })),
    h("div", { className: "tear", ariaHidden: "true" }),
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
  if (moneyHidden) {
    return {
      left: [h("p", { className: "eyebrow", textContent: "Hidden" }), h("h2", { id: "book-title", textContent: "Money" }),
        h("p", { className: "sub", textContent: "Money is hidden with the remote. Press its power button to show it again." })],
      right: [h("p", { className: "empty", textContent: "These pages are face down for now." })],
    };
  }
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

function setActive(id) {
  activeBook = id;
  document.querySelectorAll(".book").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
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
  openEl = fromEl || true;
  setActive(id);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => $("reader").classList.add("dim"));

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
  const fromEl = openEl instanceof Element ? openEl : null;
  $("reader").classList.remove("dim");
  if (fromEl && !reducedMotion && fromEl.isConnected) {
    const to = fromEl.getBoundingClientRect();
    const from = ob.getBoundingClientRect();
    await ob.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.4 },
    ], { duration: 320, easing: "cubic-bezier(.5,0,.75,0)" }).finished;
  }
  $("reader").hidden = true;
  document.body.style.overflow = $("library").hidden ? "" : "hidden";
  openEl = null;
  setActive(null);
  fromEl?.dispatchEvent(new Event("bookclosed"));
  fromEl?.focus({ preventScroll: true });
}

$("reader-close").addEventListener("click", closeBook);
$("reader").addEventListener("click", (e) => { if (e.target === $("reader")) closeBook(); });
$("money-screen").addEventListener("click", () => { if (screenOn) openBook("money", bookEl("money")); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (!$("reader").hidden) closeBook();
  else if (!$("library").hidden) closeLibrary();
  else if ($("turntable").classList.contains("open")) closeTurntable();
  else if (onBoard) showBoard(false);
});

// ---------- library view: the bookcase across the middle of the screen ----------

const LIB_HEIGHTS = [100, 92, 97, 88, 95, 90, 98, 86];

function bookSummary(b) {
  if (b.id === "money") {
    if (moneyHidden) return "Hidden with the remote";
    return state.money ? `${money(state.money.month.expenses)} spent this month · ${state.money.live ? "live from Pūtea" : "sample"}` : "Loading";
  }
  const a = area(b.id);
  if (!a) return "";
  if (a.error) return "Couldn't reach Notion";
  const n = a.records.length;
  return `${n ? `${n} entr${n === 1 ? "y" : "ies"}` : "No entries yet"} · ${a.live ? "live from Notion" : "sample"}`;
}

function renderLibrary() {
  const books = shelfBooks();
  const caption = $("lib-caption");
  const show = (b, i) => caption.replaceChildren(
    h("span", { className: "lc-vol", textContent: `Vol. ${ROMAN[i] ?? i + 1}` }),
    h("span", { className: "lc-title", textContent: b.label }),
    h("span", { className: "lc-sum", textContent: bookSummary(b) }));
  caption.replaceChildren(h("span", { className: "lc-sum", textContent: `${books.length} books · choose one to take it down` }));
  $("lib-books").replaceChildren(...books.map((b, i) => {
    const spine = SPINES[b.id];
    const el = h("button", { type: "button", className: `lib-book${spine ? "" : " plain"}`, ariaLabel: `Take down ${b.label}` },
      h("span", { className: "lib-spine" },
        h("span", { className: "b-title", textContent: b.label }),
        h("span", { className: "b-vol", textContent: ROMAN[i] ?? "" })));
    el.style.setProperty("--hgt", `${LIB_HEIGHTS[i % LIB_HEIGHTS.length]}%`);
    if (spine) el.style.setProperty("--spine", `url("assets/shelf/book-${spine}.png")`);
    else el.style.setProperty("--c", b.color);
    el.addEventListener("mouseenter", () => show(b, i));
    el.addEventListener("focus", () => show(b, i));
    el.addEventListener("click", () => takeDown(b, el));
    el.addEventListener("bookclosed", () => putBack(el));
    return el;
  }));
}

async function takeDown(b, el) {
  if (openEl || el.classList.contains("out")) return;
  el.classList.add("out");
  $("lib-books").classList.add("picking");
  if (!reducedMotion) {
    // tip it forward off the shelf, then lift it toward you
    await el.animate([
      { transform: "none" },
      { transform: "translateY(-46%)", offset: 0.55 },
      { transform: "translateY(-46%) scale(1.12) rotate(-3deg)" },
    ], { duration: 520, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" }).finished;
  }
  await openBook(b.id, el);
}

async function putBack(el) {
  const lifted = el.getAnimations();
  if (lifted.length && !reducedMotion) {
    await el.animate([{ transform: "translateY(-46%) scale(1.12) rotate(-3deg)" }, { transform: "none" }], { duration: 360, easing: "cubic-bezier(.4,0,.2,1)" }).finished;
  }
  lifted.forEach((a) => a.cancel());
  el.classList.remove("out");
  $("lib-books").classList.remove("picking");
}

let libraryFrom = null;
function openLibrary() {
  renderLibrary();
  libraryFrom = document.activeElement;
  $("library").hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => $("library").classList.add("in"));
  $("library-close").focus({ preventScroll: true });
}
function closeLibrary() {
  $("library").classList.remove("in");
  setTimeout(() => { $("library").hidden = true; }, reducedMotion ? 0 : 280);
  document.body.style.overflow = "";
  libraryFrom?.focus?.({ preventScroll: true });
}
$("library-open").addEventListener("click", openLibrary);
$("library-close").addEventListener("click", closeLibrary);
$("library").addEventListener("click", (e) => { if (e.target === $("library")) closeLibrary(); });

// ---------- goals pin board: swipe right to slide the wall aside ----------

// Options match the columns of the Goals database in Notion (config/areas.json "goals").
// The levels work like an Azure DevOps backlog: each goal belongs to one a level up.
const LEVELS = [
  { name: "Epic", when: "This year", plural: "Epics" },
  { name: "Feature", when: "This quarter", plural: "Features" },
  { name: "PBI", when: "This month", plural: "PBIs" },
  { name: "Task", when: "This week", plural: "Tasks" },
];
const GOAL_STATUS = ["New", "Active", "At risk", "Done"];
const GOAL_AREAS = ["Work", "Health", "Learning", "People", "Money", "Personal"];
const STATE_CLASS = { new: "new", active: "active", "at risk": "risk", done: "done" };
const CARD_TILTS = ["-1.2deg", "0.9deg", "-0.5deg", "1.5deg", "-1.6deg", "0.6deg"];
const levelIndex = (name) => LEVELS.findIndex((l) => l.name === name);

let onBoard = false;
function showBoard(on) {
  if (on === onBoard) return;
  onBoard = on;
  if (on) renderBoard();
  $("wall").classList.toggle("on-board", on);
  if (!on) $("wall").style.minHeight = "";
  $("board-pane").inert = !on;
  $("wall-in").inert = on;
  const top = $("wall").getBoundingClientRect().top + window.scrollY;
  if (window.scrollY > top + 40) window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  (on ? $("goal-add") : $("to-board")).focus({ preventScroll: true });
}
$("to-board").addEventListener("click", () => showBoard(true));
$("to-wall").addEventListener("click", () => showBoard(false));

// Trackpad: two fingers moving right shows the board, left brings the wall back.
let swipeX = 0, swipeTimer = 0, swipeLock = 0;
$("wall").addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || document.querySelector("dialog[open]")) return;
  e.preventDefault();
  if (Date.now() < swipeLock) return;
  swipeX += e.deltaX;
  clearTimeout(swipeTimer);
  swipeTimer = setTimeout(() => { swipeX = 0; }, 250);
  if (Math.abs(swipeX) < 70) return;
  showBoard(swipeX < 0);
  swipeX = 0;
  swipeLock = Date.now() + 700;
}, { passive: false });

// Touch: a finger dragged sideways across the wall.
let touch0 = null;
$("wall").addEventListener("touchstart", (e) => { touch0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$("wall").addEventListener("touchend", (e) => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest(".goal-card, .pin-list")) showBoard(dx > 0);
});

// ---- board state ----
let boardView = store("goals-view") === "kanban" ? "kanban" : "tree";
let boardLevel = LEVELS.some((l) => l.name === store("goals-level")) ? store("goals-level") : "Task";
let focusGoal = null;
const goalById = (id) => state.goals.goals.find((g) => g.id === id);
const isGoalDone = (g) => /^done/i.test(g.status || "");

// A goal plus everything above and below it: the thread shown when you pick a card.
function lineage(id) {
  const ids = new Set([id]);
  for (let g = goalById(id); g?.parent && !ids.has(g.parent); g = goalById(g.parent)) ids.add(g.parent);
  const down = (gid) => state.goals.goals.filter((c) => c.parent === gid).forEach((c) => { if (!ids.has(c.id)) { ids.add(c.id); down(c.id); } });
  down(id);
  return ids;
}

// Order each column so children sit in the same order as their parents (like a backlog tree).
function treeOrder(goals) {
  const order = new Map();
  const byPriority = (a, b) => (a.priority ?? 9) - (b.priority ?? 9) || (a.due || "9").localeCompare(b.due || "9") || a.title.localeCompare(b.title);
  let n = 0;
  const visit = (g) => { order.set(g.id, n++); goals.filter((c) => c.parent === g.id).sort(byPriority).forEach(visit); };
  goals.filter((g) => !g.parent || !goalById(g.parent)).sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || byPriority(a, b)).forEach(visit);
  return (a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9);
}

function renderBoard() {
  const { goals, live, notionUrl, error } = state.goals;
  const open = goals.filter((g) => !isGoalDone(g));
  const count = (st) => goals.filter((g) => (g.status || "").toLowerCase() === st).length;
  const soon = open.filter((g) => g.due && daysBetween(todayStr(), g.due) >= 0 && daysBetween(todayStr(), g.due) <= 7).length;
  $("board-sub").textContent = error
    ? `Couldn't reach Notion: ${error}`
    : `${open.length} open · ${count("active")} active · ${count("at risk")} at risk · ${count("done")} done · ${soon} due this week${live ? "" : " · sample goals"}`;
  $("goals-notion").hidden = !notionUrl;
  if (notionUrl) $("goals-notion").href = notionUrl;
  $("goals-guide").hidden = !state.goals.guideUrl;
  if (state.goals.guideUrl) $("goals-guide").href = state.goals.guideUrl;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === boardView)));
  document.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.level === boardLevel)));
  $("level-seg").hidden = boardView !== "kanban";
  $("review-open").classList.toggle("due", reviewDue());
  $("review-open").title = reviewDue() ? "Your weekly review is due" : `Last review ${fmtDay(state.reviews.reviews[0]?.date)}`;
  $("goal-add").textContent = boardView === "kanban" ? `+ New ${boardLevel}` : "+ New Epic";
  $("cork").classList.toggle("kanban", boardView === "kanban");
  if (focusGoal && !goalById(focusGoal)) focusGoal = null;
  const thread = focusGoal ? lineage(focusGoal) : null;
  let n = 0;
  const cols = boardView === "kanban"
    ? GOAL_STATUS.map((st) => {
        const list = goals.filter((g) => g.level === boardLevel && (g.status || "New") === st).sort(treeOrder(goals));
        // Personal Kanban: cap what's in progress, so things get finished
        const over = st === "Active" && list.length > WIP_LIMIT;
        const col = h("section", { className: `pin-col state-${STATE_CLASS[st.toLowerCase()]}${over ? " over-limit" : ""}` },
          h("h3", { className: "pin-tag", title: st === "Active" ? `Work-in-progress limit: ${WIP_LIMIT}. Finish one before starting another.` : "" }, st,
            h("span", { className: "pin-count", textContent: st === "Active" ? `${list.length}/${WIP_LIMIT}` : list.length })),
          over ? h("p", { className: "wip-note", textContent: `Over your limit of ${WIP_LIMIT}. Finish or park one before starting more.` }) : null,
          h("div", { className: "pin-list" }, list.length ? list.map((g) => goalCard(g, n++, thread)) : h("p", { className: "pin-empty", textContent: "Drop a card here" })));
        dropZone(col, st);
        return col;
      })
    : LEVELS.map((lvl) => {
        const list = goals.filter((g) => (g.level || "Task") === lvl.name).sort(treeOrder(goals));
        return h("section", { className: `pin-col lvl-${lvl.name.toLowerCase()}` },
          h("h3", { className: "pin-tag", title: GUIDE[lvl.name].what }, lvl.name, h("span", { className: "pin-when", textContent: ` · ${lvl.when}` }), h("span", { className: "pin-count", textContent: list.length })),
          h("div", { className: "pin-list" }, list.length ? list.map((g) => goalCard(g, n++, thread)) : h("p", { className: "pin-empty", textContent: lvl.name === "Epic" ? "Start with a big goal for the year" : "Nothing pinned" })));
      });
  $("cork-cols").replaceChildren(...cols);
  $("cork-cols").querySelectorAll(".pin-list").forEach((l) => l.addEventListener("scroll", drawThreads, { passive: true }));
  renderJars();
  // the wall stretches to fit a long board (phones stack the columns)
  $("wall").style.minHeight = onBoard ? `${$("board-pane").offsetHeight}px` : "";
  requestAnimationFrame(drawThreads);
}

function actButton(act, label) {
  const b = h("button", { type: "button", className: "g-act", textContent: label });
  b.dataset.act = act;
  return b;
}

function goalCard(g, i, thread) {
  const st = STATE_CLASS[(g.status || "new").toLowerCase()] || "new";
  const late = g.due && st !== "done" && dayOf(g.due) < todayStr();
  const lvl = (g.level || "Task").toLowerCase();
  const childLevel = LEVELS[levelIndex(g.level) + 1];
  const parent = goalById(g.parent);
  const kids = g.children?.length || 0;
  const el = h("article", {
    className: `goal-card lvl-${lvl} ${st}${thread ? (thread.has(g.id) ? " lit" : " dim") : ""}${focusGoal === g.id ? " focus" : ""}`,
    tabIndex: 0, ariaLabel: `${g.level || "Task"}: ${g.title}, ${g.status || "New"}`,
  },
    h("span", { className: "g-top" },
      h("span", { className: "g-type", textContent: g.level || "Task" }),
      g.priority ? h("span", { className: `g-pri p${g.priority}`, textContent: `P${g.priority}`, title: `Priority ${g.priority}` }) : null,
      g.area ? h("span", { className: "g-area", textContent: g.area }) : null),
    h("span", { className: "g-title", textContent: g.title }),
    boardView === "kanban" && parent ? h("span", { className: "g-parent", textContent: `↑ ${parent.title}` }) : null,
    focusGoal === g.id && g.why ? h("span", { className: "g-why", textContent: g.why }) : null,
    h("span", { className: "g-bar", title: kids ? `${g.childDone} of ${kids} done` : "" }, Object.assign(h("i"), { style: `width:${g.progress ?? 0}%` })),
    h("span", { className: "g-meta" },
      h("span", { className: "g-state" }, h("i"), g.status || "New"),
      h("span", { className: late ? "late" : "", textContent: [
        kids ? `${g.childDone}/${kids}` : `${g.progress ?? 0}%`,
        g.effortTotal ? `${g.effortTotal} pts` : null,
        g.due ? `${late ? "was due" : "due"} ${fmtDay(g.due, { day: "numeric", month: "short" })}` : null,
      ].filter(Boolean).join(" · ") })),
    focusGoal === g.id ? h("span", { className: "g-actions" },
      actButton("edit", "Edit"),
      childLevel ? actButton("child", `+ ${childLevel.name}`) : null,
      g.url ? h("a", { className: "g-act", href: g.url, target: "_blank", rel: "noopener", textContent: "Notion ↗" }) : null) : null,
    st === "done" ? h("span", { className: "g-stamp", textContent: "Done" }) : null);
  el.dataset.id = g.id;
  el.style.setProperty("--r", CARD_TILTS[i % CARD_TILTS.length]);
  el.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "edit") return openGoal(g);
    if (act === "child") return openGoal(null, { level: childLevel.name, parent: g.id, area: g.area });
    if (e.target.closest("a")) return;
    focusGoal = focusGoal === g.id ? null : g.id;
    renderBoard();
  });
  el.addEventListener("dblclick", () => openGoal(g));
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) openGoal(g); });
  if (boardView === "kanban") {
    el.draggable = true;
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", g.id); e.dataTransfer.effectAllowed = "move"; el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
  }
  return el;
}

// Red string, pin to pin, between a picked goal and its parents and children.
function drawThreads() {
  const svg = $("threads");
  svg.replaceChildren();
  if (!focusGoal || !onBoard) return;
  const ids = lineage(focusGoal);
  const box = $("cork").getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const pin = (id) => {
    const card = $("cork-cols").querySelector(`.goal-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return null;
    const r = card.getBoundingClientRect(), list = card.closest(".pin-list").getBoundingClientRect();
    if (r.bottom < list.top || r.top > list.bottom) return null; // scrolled out of view
    return { x: r.left + r.width / 2 - box.left, y: r.top - box.top + 2 };
  };
  const NS = "http://www.w3.org/2000/svg";
  for (const id of ids) {
    const g = goalById(id);
    if (!g?.parent || !ids.has(g.parent)) continue;
    const a = pin(g.parent), b = pin(id);
    if (!a || !b) continue;
    const sag = Math.min(60, Math.abs(b.x - a.x) * 0.18 + 14);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.max(a.y, b.y) + sag} ${b.x},${b.y}`);
    svg.append(path);
  }
}
window.addEventListener("resize", () => { if (onBoard) drawThreads(); });

// Kanban: drop a card on a column to change its state. Saves straight away, with Undo.
function dropZone(col, status) {
  col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
  col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("over"); });
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    col.classList.remove("over");
    const g = goalById(e.dataTransfer.getData("text/plain"));
    if (g && (g.status || "New") !== status) moveGoal(g, status);
  });
}

async function moveGoal(g, status, undoing = false) {
  const before = g.status || "New";
  // the Completed date feeds the weekly review: set on Done, cleared if it moves back
  const completed = status === "Done" ? todayStr() : before === "Done" ? "" : undefined;
  g.status = status;
  renderBoard();
  try {
    const res = await api(`/api/goals/${g.id}`, { values: { status, completed } });
    if (res.live) state.goals = await api("/api/goals");
    else { if (completed !== undefined) g.completed = completed || null; recalcSample(); }
    renderBoard();
    if (status === "Done" && !undoing) askFelt(goalById(g.id) || g);
    const active = state.goals.goals.filter((x) => x.level === g.level && x.status === "Active").length;
    const wip = status === "Active" && active > WIP_LIMIT ? ` That's ${active} active, over your limit of ${WIP_LIMIT}.` : "";
    const earned = status === "Done" ? coinText(g) : "";
    if (!undoing) toast(`“${g.title}” moved to ${status}${res.live ? "" : " (sample, not saved to Notion)"}.${earned}${wip}`, Boolean(wip), { label: "Undo", run: () => moveGoal(goalById(g.id) || g, before, true) });
  } catch (err) {
    g.status = before;
    renderBoard();
    toast(err.message, true);
  }
}

// Sample goals: roll progress up locally, the way the server does for real ones.
function recalcSample() {
  const goals = state.goals.goals;
  const kids = (id) => goals.filter((c) => c.parent === id);
  const walk = (g, seen = new Set()) => {
    if (seen.has(g.id)) return g;
    seen.add(g.id);
    const ch = kids(g.id).map((c) => walk(c, seen));
    g.children = ch.map((c) => c.id);
    g.childDone = ch.filter(isGoalDone).length;
    g.progress = isGoalDone(g) ? 100 : ch.length ? Math.round(ch.reduce((s, c) => s + c.progress, 0) / ch.length) : g.progressSet ?? 0;
    const ce = ch.reduce((s, c) => s + (c.effortTotal || 0), 0);
    g.effortTotal = ch.length && ce ? ce : g.effort ?? null;
    return g;
  };
  goals.forEach((g) => walk(g));
}

document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  boardView = b.dataset.view;
  store("goals-view", boardView);
  renderBoard();
}));
document.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
  boardLevel = b.dataset.level;
  store("goals-level", boardLevel);
  renderBoard();
}));
$("cork").addEventListener("click", (e) => {
  if (focusGoal && !e.target.closest(".goal-card")) { focusGoal = null; renderBoard(); }
});

// ---- the goal form: review, edit, or add (Notion only changes on Save) ----
let editingGoal = null;
function fillSelect(sel, options, value, blank = "—") {
  sel.replaceChildren(h("option", { value: "", textContent: blank }), ...options.map((o) => typeof o === "string" ? h("option", { value: o, textContent: o }) : h("option", { value: o.value, textContent: o.label })));
  if (value && ![...sel.options].some((o) => o.value === String(value))) sel.append(h("option", { value, textContent: String(value) }));
  sel.value = value ?? "";
}
function fillParents(level, value) {
  const up = LEVELS[levelIndex(level) - 1];
  const f = $("goal-form").elements;
  f.parent.disabled = !up;
  const options = up ? state.goals.goals.filter((g) => g.level === up.name && g.id !== editingGoal?.id).map((g) => ({ value: g.id, label: g.title })) : [];
  fillSelect(f.parent, options, value, up ? `No ${up.name} yet` : "Epics are the top level");
}
function openGoal(g, preset = {}) {
  editingGoal = g || null;
  const v = { ...g, ...preset };
  const f = $("goal-form").elements;
  const level = v.level || "Epic";
  $("goal-heading").textContent = g ? `${level}: review` : `New ${level}`;
  $("goal-note").textContent = state.goals.live ? "Nothing changes in Notion until you press Save." : "Sample goals: saving changes them here only, not in Notion.";
  f.title.value = v.title || "";
  fillSelect(f.level, LEVELS.map((l) => ({ value: l.name, label: `${l.name} · ${l.when}` })), level);
  fillParents(level, v.parent || "");
  fillSelect(f.status, GOAL_STATUS, v.status || "New");
  fillSelect(f.priority, [1, 2, 3, 4].map((p) => ({ value: String(p), label: `P${p}${p === 1 ? " · highest" : p === 4 ? " · lowest" : ""}` })), v.priority ? String(v.priority) : "");
  fillSelect(f.area, GOAL_AREAS, v.area || "");
  f.effort.value = v.effort ?? "";
  f.start.value = dayOf(v.start || "");
  f.due.value = dayOf(v.due || "");
  f.description.value = v.description || "";
  f.why.value = v.why || "";
  f.doneWhen.value = v.doneWhen || "";
  ideasFor = null;
  $("coach-parent").dataset.for = "";
  sz = { work: null, unknown: 0, waiting: 0 };
  // a goal with children has its progress worked out from them
  const kids = g?.children?.length || 0;
  $("progress-field").hidden = kids > 0;
  $("progress-rolled").hidden = !kids;
  if (kids) $("progress-rolled").textContent = `Progress ${g.progress}%, worked out from ${g.childDone} of ${kids} ${LEVELS[levelIndex(g.level) + 1]?.plural || "children"} done.`;
  f.progress.value = g?.progressSet ?? 0;
  f.progressOut.value = `${f.progress.value}%`;
  $("goal-open").hidden = !g?.url;
  if (g?.url) $("goal-open").href = g.url;
  $("coach-reply").hidden = true;
  $("coach-ask").hidden = !state.goals.coach;
  $("coach-guide").hidden = !state.goals.guideUrl;
  if (state.goals.guideUrl) $("coach-guide").href = state.goals.guideUrl;
  updateCoach();
  $("goal-dialog").showModal();
}
$("goal-form").elements.level.addEventListener("change", (e) => fillParents(e.target.value, ""));

// ---- the coach beside the form ----
function formValues() {
  const f = $("goal-form").elements;
  return { id: editingGoal?.id, title: f.title.value, level: f.level.value, parent: f.parent.disabled ? "" : f.parent.value, status: f.status.value,
    priority: f.priority.value, effort: f.effort.value, area: f.area.value, start: f.start.value, due: f.due.value,
    why: f.why.value, doneWhen: f.doneWhen.value, description: f.description.value };
}
function updateCoach() {
  const v = formValues();
  const guide = GUIDE[v.level] || GUIDE.Task;
  const parentLevel = LEVELS[levelIndex(v.level) - 1]?.name;
  const siblings = state.goals.goals.filter((g) => g.level === v.level && !isGoalDone(g) && g.id !== v.id && (v.level === "Epic" || (v.parent && g.parent === v.parent)));
  // level-specific labels and examples on the form
  const f = $("goal-form").elements;
  $("why-field").hidden = v.level === "Task";
  f.why.placeholder = guide.why;
  $("done-label").textContent = guide.doneLabel;
  f.doneWhen.placeholder = guide.done;
  renderCoachParent(v);
  renderSizePick(v);
  renderSizer(v);
  $("coach-level").textContent = `${v.level} · ${guide.when}`;
  $("coach-what").textContent = guide.what;
  $("coach-eg").textContent = `e.g. ${guide.example}`;
  const childCount = editingGoal?.children?.length || 0;
  const checks = coachChecks(v, { parentLevel, childCount, openSiblings: v.level === "Epic" || v.parent ? siblings.length : 0, today: todayStr() });
  $("coach-checks").replaceChildren(...(checks.length ? checks : [{ ok: false, text: "Start with a title" }]).map((c) =>
    h("li", { className: c.ok ? "ok" : c.ok === null ? "ask" : "nudge" }, h("span", { className: "mark", ariaHidden: "true", textContent: c.ok ? "✓" : c.ok === null ? "?" : "·" }), c.text)));
}
$("goal-form").addEventListener("input", updateCoach);
$("goal-form").addEventListener("change", updateCoach);

$("coach-template").addEventListener("click", () => {
  const f = $("goal-form").elements;
  const t = (GUIDE[f.level.value] || GUIDE.Task).scaffold;
  if (f.level.value !== "Task" && !f.why.value.trim()) f.why.value = "So that ";
  f.doneWhen.value = f.doneWhen.value.trim() ? `${f.doneWhen.value.trimEnd()}\n${t}` : t;
  (f.level.value !== "Task" && f.why.value === "So that " ? f.why : f.doneWhen).focus();
  updateCoach();
});

// ---- effort points: a size picker, three questions, and your own finished goals as the reference ----
const sized = (level) => level === "Task" || level === "PBI";
const leafGoals = () => state.goals.goals.filter((g) => !(g.children?.length));
let sz = { work: null, unknown: 0, waiting: 0 };

function renderSizePick(v) {
  const f = $("goal-form").elements;
  const pick = $("size-pick");
  const kids = editingGoal?.children?.length || 0;
  const direct = sized(v.level) && !kids;
  pick.hidden = !direct;
  $("size-total").hidden = direct;
  if (!direct) {
    const total = editingGoal?.effortTotal;
    $("size-total").textContent = total
      ? `${total} points, added up from what's underneath. Epics and Features aren't sized directly.`
      : `Worked out from its ${LEVELS[levelIndex(v.level) + 1]?.plural || "children"} once you size those. Bigger goals are too uncertain to size well, so they add up from the pieces.`;
    $("size-feel").textContent = "";
    return;
  }
  const current = Number(f.effort.value) || null;
  $("size-feel").textContent = current ? `· ${SIZES.find((x) => x.pts === current)?.feel || ""}` : "";
  pick.replaceChildren(...SIZES.map((x) => {
    const b = h("button", { type: "button", className: `size-btn${current === x.pts ? " on" : ""}${x.pts === 13 ? " warn" : ""}`, textContent: x.pts, title: x.feel });
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(current === x.pts));
    b.addEventListener("click", () => { f.effort.value = current === x.pts ? "" : x.pts; updateCoach(); });
    return b;
  }));
}

function renderSizer(v) {
  const box = $("sizer");
  box.hidden = !sized(v.level) || (editingGoal?.children?.length || 0) > 0;
  if (box.hidden) return;
  const f = $("goal-form").elements;
  $("sizer-qs").replaceChildren(...Object.entries(SIZE_QUESTIONS).map(([key, q]) =>
    h("div", { className: "sizer-q" }, h("span", { textContent: q.label }),
      h("div", { className: "seg mini" }, q.options.map((o, i) => {
        const b = h("button", { type: "button", textContent: o });
        b.setAttribute("aria-selected", String(sz[key] === i && (key !== "work" || sz.work !== null)));
        b.addEventListener("click", () => { sz[key] = i; updateCoach(); });
        return b;
      })))));
  const s = suggestSize(sz);
  const out = $("sizer-out");
  if (s) {
    const use = h("button", { type: "button", className: "g-act", textContent: `Use ${s.pts}` });
    use.addEventListener("click", () => { f.effort.value = s.pts; updateCoach(); });
    out.replaceChildren(...[h("b", { textContent: `Suggested: ${s.pts}` }), ` (${s.why})`, s.pts === 13 ? h("span", { className: "late", textContent: ". Too big: split it." }) : null, " ", s.pts < 13 ? use : null].filter((x) => x != null));
  } else out.textContent = "Answer the first question for a suggestion.";
  // the reference point: what you've actually finished at this size, and how it felt
  const size = Number(f.effort.value) || s?.pts;
  const mine = size ? leafGoals().filter((g) => isGoalDone(g) && Number(g.effort) === size).sort((a, b) => (b.completed || "").localeCompare(a.completed || "")) : [];
  const felt = mine.filter((g) => g.felt);
  const bigger = felt.filter((g) => g.felt === "Bigger").length, smaller = felt.filter((g) => g.felt === "Smaller").length;
  const starter = SIZES.find((x) => x.pts === size);
  $("sizer-refs").replaceChildren(...(size ? [
    h("span", { className: "cp-label", textContent: mine.length ? `Your ${size}s so far` : `A ${size} looks like` }),
    mine.length
      ? h("ul", { className: "cp-points" }, mine.slice(0, 3).map((g) => h("li", {}, g.title, g.felt && g.felt !== "About right" ? h("em", { textContent: ` (felt ${g.felt.toLowerCase()})` }) : null)))
      : h("p", { className: "cp-hint", textContent: starter?.eg ? `${starter.feel}: ${starter.eg}` : starter?.feel || "" }),
    felt.length >= 3 && bigger > felt.length / 2 ? h("p", { className: "sizer-cal", textContent: `${bigger} of your ${felt.length} finished ${size}s felt bigger. You may be sizing low: try the next size up.` }) : null,
    felt.length >= 3 && smaller > felt.length / 2 ? h("p", { className: "sizer-cal", textContent: `${smaller} of your ${felt.length} finished ${size}s felt smaller. You may be sizing high.` }) : null,
  ] : []).filter(Boolean));
}

// After a sized Task or PBI is done: how big did it really feel? That answer is the reference point.
let feltGoal = null;
function askFelt(g) {
  if (!g || !sized(g.level) || !g.effort || g.children?.length) return;
  feltGoal = g;
  $("felt-title").textContent = `How big did “${g.title}” really feel?`;
  $("felt-note").textContent = `You sized it at ${g.effort} point${g.effort > 1 ? "s" : ""} (${SIZES.find((x) => x.pts === Number(g.effort))?.feel.toLowerCase() || "your guess"}). Your answer teaches your future guesses.`;
  $("felt-dialog").showModal();
}
document.querySelectorAll("[data-felt]").forEach((b) => b.addEventListener("click", async () => {
  const g = feltGoal;
  const felt = b.dataset.felt;
  $("felt-dialog").close();
  if (!g) return;
  try {
    const res = await api(`/api/goals/${g.id}`, { values: { felt } });
    if (res.live) state.goals = await api("/api/goals");
    else g.felt = felt;
    toast(felt === "About right" ? "Nice estimate ✓" : `Noted: felt ${felt.toLowerCase()}. Next time you'll know.`);
  } catch (err) { toast(err.message, true); }
}));
$("felt-skip").addEventListener("click", () => $("felt-dialog").close());

// "From the Epic": the parent's why and done-when beside the form, plus the children it already has,
// so each child is planned against what the parent needs. Ideas from Claude fill gaps.
let ideasFor = null;
function renderCoachParent(v) {
  const box = $("coach-parent");
  const parent = goalById(v.parent);
  if (!parent) { box.hidden = true; ideasFor = null; return; }
  box.hidden = false;
  const kids = state.goals.goals.filter((g) => g.parent === parent.id && g.id !== v.id);
  const pg = GUIDE[parent.level] || GUIDE.Task;
  const points = (parent.doneWhen || "").split("\n").map((l) => l.replace(/^[ \t]*[-•*][ \t]*/, "").trim()).filter(Boolean);
  if (ideasFor === parent.id && box.dataset.for === parent.id) return; // keep ideas showing while typing
  box.dataset.for = parent.id;
  const ideasBtn = state.goals.coach ? h("button", { type: "button", className: "g-act", textContent: `Ideas for missing ${v.level}s` }) : null;
  const ideas = h("div", { className: "coach-ideas" });
  ideasBtn?.addEventListener("click", () => loadIdeas(parent, kids, v.level, ideas, ideasBtn));
  box.replaceChildren(
    h("span", { className: "eyebrow", textContent: `From the ${parent.level}` }),
    h("b", { className: "cp-title", textContent: parent.title }),
    parent.why ? h("p", { className: "cp-why", textContent: parent.why }) : h("p", { className: "cp-missing", textContent: `This ${parent.level} has no why yet.` }),
    points.length
      ? h("div", {}, h("span", { className: "cp-label", textContent: "Done when" }), h("ul", { className: "cp-points" }, points.map((p) => h("li", { textContent: p }))), pg.childHint ? h("p", { className: "cp-hint", textContent: pg.childHint }) : null)
      : h("p", { className: "cp-missing", textContent: `No “done when” on the ${parent.level} yet. Adding one makes it easier to see which ${v.level}s you need.` }),
    h("div", {}, h("span", { className: "cp-label", textContent: `${v.level}s so far (${kids.length})` }),
      kids.length ? h("ul", { className: "cp-kids" }, kids.map((k) => h("li", { className: isGoalDone(k) ? "done" : "", textContent: k.title }))) : h("p", { className: "cp-missing", textContent: "None yet: this is the first." })),
    h("p", { className: "cp-ask", textContent: `If every ${v.level} were done, would “${parent.title}” be done?` }),
    ...[ideasBtn, ideas].filter(Boolean));
}

async function loadIdeas(parent, kids, level, box, btn) {
  btn.disabled = true;
  ideasFor = parent.id;
  box.replaceChildren(h("p", { className: "coach-reply loading", textContent: "Claude is looking for gaps…" }));
  try {
    const r = await api("/api/goals/ideas", {
      parent: { level: parent.level, title: parent.title, why: parent.why, doneWhen: parent.doneWhen, notes: parent.description },
      children: kids.map((k) => k.title), level,
    });
    const f = $("goal-form").elements;
    box.replaceChildren(
      h("p", { className: "cp-gaps", textContent: r.gaps }),
      ...r.ideas.map((idea) => {
        const use = h("button", { type: "button", className: "g-act", textContent: "Use" });
        use.addEventListener("click", () => {
          f.title.value = idea.title;
          if (level !== "Task") f.why.value = idea.why;
          f.doneWhen.value = idea.doneWhen;
          updateCoach();
          use.textContent = "Using ✓";
        });
        return h("div", { className: "cp-idea" }, h("b", { textContent: idea.title }), idea.covers ? h("span", { textContent: `for: ${idea.covers}` }) : null, use);
      }),
      h("p", { className: "coach-small", textContent: "Ideas only. Pick one to fill in the form; nothing saves until you press Save." }));
  } catch (err) {
    box.replaceChildren(h("p", { className: "coach-reply error", textContent: err.message }));
    ideasFor = null;
  } finally {
    btn.disabled = false;
  }
}

$("coach-ask").addEventListener("click", async () => {
  const v = formValues();
  const box = $("coach-reply");
  if (!v.title.trim()) return toast("Give the goal a title first.", true);
  const parent = goalById(v.parent);
  box.hidden = false;
  box.className = "coach-reply loading";
  box.textContent = "Claude is reading your goal…";
  $("coach-ask").disabled = true;
  try {
    const r = await api("/api/goals/coach", { goal: v, parent: parent ? { level: parent.level, title: parent.title, why: parent.why, doneWhen: parent.doneWhen } : null });
    const use = (label, fn) => { const b = h("button", { type: "button", className: "g-act", textContent: label }); b.addEventListener("click", () => { fn(); updateCoach(); b.textContent = "Used ✓"; b.disabled = true; }); return b; };
    const f = $("goal-form").elements;
    box.className = "coach-reply";
    box.replaceChildren(
      h("b", { textContent: r.verdict === "good" ? "Looks good" : "A few tweaks" }),
      h("ul", {}, r.feedback.map((t) => h("li", { textContent: t }))),
      r.title && r.title.trim() !== v.title.trim() ? h("div", { className: "coach-suggest" }, h("span", { textContent: `Title: “${r.title}”` }), use("Use title", () => { f.title.value = r.title; })) : null,
      r.why && r.why.trim() !== v.why.trim() && v.level !== "Task" ? h("div", { className: "coach-suggest" },
        h("pre", { textContent: r.why }), use("Use why", () => { f.why.value = r.why; })) : null,
      r.doneWhen && r.doneWhen.trim() !== v.doneWhen.trim() ? h("div", { className: "coach-suggest" },
        h("pre", { textContent: r.doneWhen }), use("Use done when", () => { f.doneWhen.value = r.doneWhen; })) : null,
      h("p", { className: "coach-small", textContent: "Suggestions only. Nothing is saved until you press Save." }));
  } catch (err) {
    box.className = "coach-reply error";
    box.textContent = err.message;
  } finally {
    $("coach-ask").disabled = false;
  }
});
$("goal-form").elements.progress.addEventListener("input", (e) => { $("goal-form").elements.progressOut.value = `${e.target.value}%`; });
$("goal-add").addEventListener("click", () => openGoal(null, { level: boardView === "kanban" ? boardLevel : "Epic" }));
$("goal-dialog").addEventListener("close", async () => {
  if ($("goal-dialog").returnValue !== "save") return;
  const f = $("goal-form").elements;
  const values = {
    title: f.title.value.trim(), level: f.level.value, parent: f.parent.disabled ? "" : f.parent.value, status: f.status.value,
    priority: f.priority.value, effort: f.effort.value, area: f.area.value, start: f.start.value, due: f.due.value, description: f.description.value.trim(),
    why: f.level.value === "Task" ? "" : f.why.value.trim().replace(/^so that\s*$/i, ""), doneWhen: f.doneWhen.value.trim(),
  };
  const g = editingGoal;
  if (!(g?.children?.length)) values.progress = f.progress.value;
  const wasDone = /^done/i.test(g?.status || "");
  if (values.status === "Done" && !wasDone) values.completed = todayStr();
  else if (wasDone && values.status !== "Done") values.completed = "";
  if (!values.title) return toast("Give the goal a name.", true);
  try {
    const res = await api(g ? `/api/goals/${g.id}` : "/api/goals", { values });
    if (res.live) {
      toast(g ? "Saved to Notion ✓" : `${values.level} added to Notion ✓`);
      state.goals = await api("/api/goals");
      if (!g && res.goal) focusGoal = res.goal.id;
    } else {
      // sample data: change it on this page only
      const local = { ...values, completed: values.completed ?? g?.completed ?? null, priority: values.priority ? Number(values.priority) : null, effort: values.effort ? Number(values.effort) : null, progressSet: values.progress ? Number(values.progress) : null };
      if (g) Object.assign(g, local);
      else state.goals.goals.push({ id: `local-${Date.now()}`, url: null, ...local });
      recalcSample();
      toast("Saved here only (sample goals, so Notion isn't changed)");
    }
    renderBoard();
    if (g && values.status === "Done" && !wasDone) { askFelt(goalById(g.id)); toast(`Done ✓${coinText(g)}`); }
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- weekly review: the Scrum retrospective scaled to one person ----------

const ENERGY = ["Low", "Okay", "Good", "Great"];
const lastReview = () => state.reviews.reviews[0] || null;
// due a week after the last one (or straight away if there's never been one)
function reviewDue() {
  const last = lastReview();
  return !last?.date || daysBetween(last.date, todayStr()) >= 7;
}
const mondayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const sundayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((7 - d.getDay()) % 7));

let rv = null;

// Pace (velocity) and calibration, from finished goals without children (so nothing counts twice).
const pointsOf = (list) => list.reduce((n, g) => n + (Number(g.effort) || 0), 0);
function pace() {
  const today = todayStr();
  const done = leafGoals().filter((g) => isGoalDone(g) && g.completed && Number(g.effort));
  const recent = done.filter((g) => daysBetween(g.completed, today) <= 28);
  const oldest = recent.reduce((m, g) => Math.max(m, daysBetween(g.completed, today)), 0);
  if (oldest < 14) return null; // a couple of weeks before an average means anything
  return Math.round((pointsOf(recent) / Math.max(2, Math.ceil(oldest / 7))) * 10) / 10;
}
function calibration() {
  const felt = leafGoals().filter((g) => g.felt).sort((a, b) => (b.completed || "").localeCompare(a.completed || "")).slice(0, 20);
  if (felt.length < 3) return null;
  const n = (k) => felt.filter((g) => g.felt === k).length;
  const bigger = n("Bigger"), smaller = n("Smaller"), right = n("About right");
  if (bigger - smaller >= 2 && bigger >= right) return `${bigger} of your last ${felt.length} sized goals felt bigger than you guessed. Try sizing up a step.`;
  if (smaller - bigger >= 2 && smaller >= right) return `${smaller} of your last ${felt.length} felt smaller than you guessed. You can size a little lower.`;
  if (right >= felt.length / 2) return `${right} of your last ${felt.length} felt about right. Your sense of size is settling in.`;
  return `Mixed so far (${right} about right, ${bigger} bigger, ${smaller} smaller). Keep noting how they feel: the pattern shows after a few weeks.`;
}
const RV_STEPS = [
  { key: "wins", name: "Wins", title: "What got done?", prompt: "Anything else worth celebrating? Small wins count." },
  { key: "stuck", name: "Stuck", title: "What's stuck or at risk?", prompt: "What's stuck, why, and what would unstick it?" },
  { key: "wip", name: "WIP", title: "Is the limit holding?", prompt: "What will you finish, or park, so less is in progress?" },
  { key: "weekGoal", name: "Plan", title: "Plan this week", prompt: "If I only finish these, the week was worth it because…" },
  { key: "tryNext", name: "Try", title: "One small change", prompt: "One thing to do differently next week." },
];

function openReview() {
  const last = lastReview();
  rv = { step: 0, since: last?.date ? dayOf(last.date) : ymd(new Date(Date.now() - 7 * 86_400_000)), energy: "", wins: "", stuck: "", wip: "", weekGoal: "", tryNext: "" };
  $("review-week").textContent = `Week of ${longDate(mondayOf(new Date()), false)}`;
  $("rv-last").hidden = !last?.tryNext;
  if (last?.tryNext) $("rv-last").textContent = `Last time you said you'd try: “${last.tryNext}”. Did it help?`;
  $("rv-notion").hidden = !state.reviews.notionUrl;
  if (state.reviews.notionUrl) $("rv-notion").href = state.reviews.notionUrl;
  renderReview();
  $("review-dialog").showModal();
}

const goalLine = (g, tag) => h("li", { className: `rv-goal lvl-${(g.level || "task").toLowerCase()}` },
  h("span", { className: "rv-type", textContent: g.level || "Task" }), h("span", { className: "rv-t", textContent: g.title }), tag ? h("span", { className: "rv-tag", textContent: tag }) : null);

function renderReview() {
  const step = RV_STEPS[rv.step];
  const goals = state.goals.goals;
  const today = todayStr();
  const open = goals.filter((g) => !isGoalDone(g));
  const doneSince = goals.filter((g) => isGoalDone(g) && g.completed && dayOf(g.completed) >= rv.since);
  $("rv-steps").replaceChildren(...RV_STEPS.map((s, i) => h("li", { className: i === rv.step ? "on" : i < rv.step ? "past" : "" }, h("span", { textContent: i + 1 }), s.name)));
  let top = [];
  if (step.key === "wins") {
    const pick = h("div", { className: "seg energy", role: "radiogroup", ariaLabel: "Energy this week" }, ENERGY.map((e) => {
      const b = h("button", { type: "button", textContent: e, ariaPressed: String(rv.energy === e) });
      b.setAttribute("aria-selected", String(rv.energy === e));
      b.addEventListener("click", () => { rv.energy = rv.energy === e ? "" : e; renderReview(); });
      return b;
    }));
    const pts = pointsOf(doneSince.filter((g) => !(g.children?.length)));
    const cal = calibration();
    top = [
      doneSince.length
        ? h("ul", { className: "rv-list" }, doneSince.map((g) => goalLine(g, [g.effort && !(g.children?.length) ? `${g.effort} pts` : null, fmtDay(g.completed, { weekday: "short" })].filter(Boolean).join(" · "))))
        : h("p", { className: "rv-empty", textContent: `Nothing marked Done since ${fmtDay(rv.since, { weekday: "long", day: "numeric", month: "short" })}. That's okay: note what moved, even a little.` }),
      pts ? h("p", { className: "rv-pace", textContent: `That's ${pts} point${pts > 1 ? "s" : ""} finished.${pace() ? ` Your usual is about ${pace()} a week.` : ""}` }) : null,
      cal ? h("p", { className: "rv-hint", textContent: cal }) : null,
      h("div", { className: "rv-row" }, h("span", { className: "rv-label", textContent: "Energy this week" }), pick),
    ].filter(Boolean);
  } else if (step.key === "stuck") {
    const risk = open.filter((g) => /at risk/i.test(g.status || ""));
    const late = open.filter((g) => g.due && dayOf(g.due) < today && !risk.includes(g));
    top = [risk.length || late.length
      ? h("ul", { className: "rv-list" }, risk.map((g) => goalLine(g, "At risk")), late.map((g) => goalLine(g, `${daysBetween(g.due, today)} days late`)))
      : h("p", { className: "rv-empty", textContent: "Nothing at risk or overdue. Nice." })];
  } else if (step.key === "wip") {
    top = [h("div", { className: "rv-wip" }, LEVELS.map((l) => {
      const n = goals.filter((g) => g.level === l.name && g.status === "Active").length;
      return h("div", { className: `rv-wip-row${n > WIP_LIMIT ? " over" : ""}` },
        h("span", { textContent: l.plural }),
        h("span", { className: "rv-meter" }, Object.assign(h("i"), { style: `width:${Math.min(100, (n / WIP_LIMIT) * 100)}%` })),
        h("span", { textContent: `${n} active / ${WIP_LIMIT}` }));
    })), h("p", { className: "rv-hint", textContent: "Half-done work costs twice: it takes headspace and goes stale. Finish before you start." })];
  } else if (step.key === "weekGoal") {
    const tasks = open.filter((g) => g.level === "Task").sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
    const pbis = open.filter((g) => g.level === "PBI");
    const title = h("input", { type: "text", placeholder: "Add a task for this week, e.g. “Email the agent”", autocomplete: "off" });
    const parent = h("select", {}, h("option", { value: "", textContent: "Which PBI is it for?" }), pbis.map((p) => h("option", { value: p.id, textContent: p.title })));
    const add = h("button", { type: "button", className: "g-act", textContent: "Add task" });
    add.addEventListener("click", async () => {
      if (!title.value.trim()) return title.focus();
      add.disabled = true;
      const values = { title: title.value.trim(), level: "Task", parent: parent.value, status: "New", due: ymd(sundayOf(new Date())) };
      try {
        const res = await api("/api/goals", { values });
        if (res.live) state.goals = await api("/api/goals");
        else { state.goals.goals.push({ id: `local-${Date.now()}`, url: null, ...values }); recalcSample(); }
        toast(res.live ? "Task added to Notion ✓" : "Task added here only (sample goals)");
        if (onBoard) renderBoard();
        renderReview();
      } catch (err) { toast(err.message, true); add.disabled = false; }
    });
    // planned this week vs your usual pace: the check that stops overcommitting
    const weekEnd = ymd(new Date(Date.now() + 7 * 86_400_000));
    const planned = tasks.filter((g) => !(g.children?.length) && (g.status === "Active" || (g.due && dayOf(g.due) <= weekEnd)));
    const plannedPts = pointsOf(planned), unsized = planned.filter((g) => !Number(g.effort)).length, usual = pace();
    const heavy = usual && plannedPts > usual * 1.25;
    top = [
      tasks.length ? h("ul", { className: "rv-list" }, tasks.map((g) => goalLine(g, [g.effort ? `${g.effort} pts` : null, g.due ? fmtDay(g.due, { weekday: "short", day: "numeric" }) : g.status].filter(Boolean).join(" · ")))) : h("p", { className: "rv-empty", textContent: "No open tasks yet. Pick a few from this month's PBIs." }),
      h("p", { className: `rv-pace${heavy ? " heavy" : ""}`, textContent: [
        `Planned for the next 7 days: ${plannedPts} point${plannedPts === 1 ? "" : "s"}${unsized ? ` (${unsized} not sized yet)` : ""}.`,
        usual ? ` Your usual is about ${usual} a week.` : " Your usual pace will show after a couple of weeks of sized, finished tasks.",
        heavy ? " That's more than usual: consider moving something out." : "",
      ].join("") }),
      h("div", { className: "rv-add" }, title, parent, add),
    ];
  } else {
    const active = goals.filter((g) => g.status === "Active").length;
    top = [h("p", { className: "rv-summary", textContent: `${doneSince.length} done · ${active} active · ${open.filter((g) => /at risk/i.test(g.status || "")).length} at risk${rv.energy ? ` · energy ${rv.energy.toLowerCase()}` : ""}` })];
  }
  const area = h("textarea", { rows: 3, placeholder: "A line or two is plenty", value: rv[step.key] });
  area.addEventListener("input", () => { rv[step.key] = area.value; });
  $("rv-body").replaceChildren(h("h4", { className: "rv-title", textContent: step.title }), ...top, h("label", { className: "rv-label" }, step.prompt, area));
  $("rv-back").hidden = rv.step === 0;
  $("rv-next").textContent = rv.step === RV_STEPS.length - 1 ? (state.reviews.live ? "Save review to Notion" : "Save review") : "Next";
}

$("rv-back").addEventListener("click", () => { rv.step--; renderReview(); });
$("rv-next").addEventListener("click", async () => {
  if (rv.step < RV_STEPS.length - 1) { rv.step++; return renderReview(); }
  const goals = state.goals.goals;
  const doneSince = goals.filter((g) => isGoalDone(g) && g.completed && dayOf(g.completed) >= rv.since);
  const clip = (t) => (t.length > 1900 ? `${t.slice(0, 1900)}…` : t);
  const values = {
    title: `Week of ${mondayOf(new Date()).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`,
    date: todayStr(),
    wins: clip([doneSince.map((g) => `- ${g.level}: ${g.title}`).join("\n"), rv.wins.trim()].filter(Boolean).join("\n\n")),
    stuck: clip(rv.stuck.trim()), wip: clip(rv.wip.trim()), weekGoal: clip(rv.weekGoal.trim()), tryNext: clip(rv.tryNext.trim()),
    done: doneSince.length, active: goals.filter((g) => g.status === "Active").length,
    atRisk: goals.filter((g) => !isGoalDone(g) && /at risk/i.test(g.status || "")).length, energy: rv.energy,
    points: pointsOf(doneSince.filter((g) => !(g.children?.length))),
  };
  $("rv-next").disabled = true;
  try {
    const res = await api("/api/reviews", { values });
    if (res.live) state.reviews = await api("/api/reviews");
    else state.reviews.reviews.unshift({ id: `local-${Date.now()}`, week: values.title, date: values.date, tryNext: values.tryNext, weekGoal: values.weekGoal });
    $("review-dialog").close();
    toast(res.live ? "Review saved to Notion ✓ See you next week." : "Review saved here only (sample data)");
    renderNotes();
    if (onBoard) renderBoard();
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("rv-next").disabled = false;
  }
});
$("review-open").addEventListener("click", openReview);

// ---------- coins, goal jars and the treat shop ----------
// Coins are worked out from finished goals (by level, never by guessed size) minus what you've bought.

const coinsFor = (g) => state.shop.coinsPerLevel?.[g.level] || 0;
const toDollars = (coins) => coins / (state.shop.coinsPerDollar || 10);
const dollars = (coins) => money(toDollars(coins), toDollars(coins) % 1 ? 2 : 0);
const coinText = (g) => (coinsFor(g) ? ` +${coinsFor(g)} coins (${dollars(coinsFor(g))}) in the treat fund.` : "");

function coinTotals() {
  const now = new Date();
  const starts = {
    today: todayStr(),
    week: ymd(mondayOf(now)),
    quarter: ymd(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)),
    year: `${now.getFullYear()}-01-01`,
  };
  const done = state.goals.goals.filter((g) => isGoalDone(g) && g.completed);
  const since = (d) => done.filter((g) => dayOf(g.completed) >= d).reduce((n, g) => n + coinsFor(g), 0);
  const all = done.reduce((n, g) => n + coinsFor(g), 0);
  const items = state.shop.items || [];
  const spent = items.filter((i) => i.type === "Bought").reduce((n, i) => n + (Number(i.coins) || 0), 0);
  const moved = items.filter((i) => i.type === "Moved").reduce((n, i) => n + (Number(i.dollars) || 0), 0);
  return {
    today: since(starts.today), week: since(starts.week), quarter: since(starts.quarter), year: since(starts.year),
    all, spent, balance: all - spent, owed: Math.max(0, Math.round((toDollars(all) - moved) * 100) / 100),
  };
}

// The Epic a goal belongs to, by walking up its parents.
function epicOf(g) {
  const seen = new Set();
  while (g && g.level !== "Epic" && g.parent && !seen.has(g.id)) { seen.add(g.id); g = goalById(g.parent); }
  return g?.level === "Epic" ? g : null;
}

function renderJars() {
  const row = $("jar-row");
  if (!row) return;
  const epics = state.goals.goals.filter((g) => g.level === "Epic" && !isGoalDone(g))
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || (b.progress ?? 0) - (a.progress ?? 0)).slice(0, 4);
  const jar = (title, pct, sub, onClick) => {
    const el = h("button", { type: "button", className: "jar", ariaLabel: `${title}: ${pct}% done` },
      h("img", { src: "assets/obj/jar.png", alt: "" }),
      h("span", { className: "jar-coins", ariaHidden: "true" }),
      h("span", { className: "jar-tag" }, h("span", { className: "jar-name", textContent: title }), h("b", { textContent: sub })));
    el.style.setProperty("--fill", `${Math.max(0, Math.min(100, pct))}%`);
    el.addEventListener("click", onClick);
    return el;
  };
  const t = coinTotals();
  const tin = h("button", { type: "button", className: "tin", ariaLabel: `Treat fund: ${dollars(t.balance)} to spend. Open the shop` },
    h("img", { src: "assets/obj/tin.png", alt: "" }),
    h("span", { className: "jar-tag tin-tag" }, h("span", { className: "jar-name", textContent: `${dollars(t.week)} this week` }), h("b", { textContent: `${dollars(t.balance)} to spend` })));
  tin.addEventListener("click", openShop);
  row.replaceChildren(
    ...(epics.length
      ? epics.map((e) => jar(e.title, e.progress ?? 0, `${e.progress ?? 0}%${e.children?.length ? ` · ${e.childDone}/${e.children.length}` : ""}`, () => {
          showBoard(true);
          focusGoal = e.id;
          renderBoard();
        }))
      : [jar("Your first Epic", 0, "start here", () => { showBoard(true); openGoal(null, { level: "Epic" }); })]),
    tin);
}

// ---- the shop ----
let confirmBuy = null;
function openShop() {
  confirmBuy = null;
  renderShop();
  $("shop-dialog").showModal();
}
function renderShop() {
  const t = coinTotals();
  const shop = state.shop;
  $("shop-title").textContent = `${dollars(t.balance)} to spend`;
  $("shop-sub").textContent = `${t.balance.toLocaleString()} coins · earned by finishing goals${shop.live ? "" : " (sample data)"}`;
  $("shop-periods").replaceChildren(...[["Today", t.today], ["This week", t.week], ["This quarter", t.quarter], ["This year", t.year]].map(([l, c]) =>
    h("div", { className: "shop-period" }, h("b", { textContent: dollars(c) }), h("span", { textContent: l }), h("i", { textContent: `${c.toLocaleString()} coins` }))));
  // real money: what to move into the treat account, by hand (Hanua never moves money)
  const top = $("shop-topup");
  if (t.owed > 0) {
    const moved = h("button", { type: "button", className: "g-act", textContent: `I've moved ${money(t.owed, t.owed % 1 ? 2 : 0)}` });
    moved.addEventListener("click", () => shopWrite({ item: `Moved ${money(t.owed, 2)} to the treat account`, type: "Moved", dollars: t.owed }, `Recorded: ${money(t.owed, 2)} moved ✓`));
    top.replaceChildren(h("span", {}, "Treat account top-up: ", h("b", { textContent: money(t.owed, t.owed % 1 ? 2 : 0) }), ". Move it yourself, then mark it here."), moved);
  } else top.replaceChildren(h("span", { textContent: "Treat account is up to date." }));
  const rewards = (shop.items || []).filter((i) => i.type === "Reward").sort((a, b) => (a.coins || 0) - (b.coins || 0));
  $("shop-list").replaceChildren(...(rewards.length ? rewards.map((r) => {
    const coins = Number(r.coins) || 0;
    const short = coins - t.balance;
    const btn = h("button", { type: "button", className: `g-act${confirmBuy === r.id ? " confirm" : ""}`, textContent: confirmBuy === r.id ? "Confirm" : short > 0 ? `${short.toLocaleString()} to go` : "Buy" });
    btn.disabled = short > 0;
    btn.addEventListener("click", () => {
      if (confirmBuy !== r.id) { confirmBuy = r.id; return renderShop(); }
      confirmBuy = null;
      shopWrite({ item: r.item, type: "Bought", coins }, `Enjoy: ${r.item} ✓`);
    });
    return h("li", { className: "shop-item" },
      h("span", { className: "si-name", textContent: r.item }),
      h("span", { className: "si-price", textContent: `${coins.toLocaleString()} coins · ${dollars(coins)}` }),
      h("span", { className: "si-bar" }, Object.assign(h("i"), { style: `width:${Math.min(100, coins ? (t.balance / coins) * 100 : 0)}%` })),
      btn);
  }) : [h("li", { className: "shop-empty", textContent: "No rewards yet. Add a few in Notion: a name and a coin price (10 coins = $1)." })]));
  const recent = (shop.items || []).filter((i) => i.type !== "Reward").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
  $("shop-recent-h").hidden = !recent.length;
  $("shop-recent").replaceChildren(...recent.map((i) => h("li", {},
    h("span", { textContent: i.item }), h("span", { textContent: [i.type === "Bought" ? `−${(i.coins || 0).toLocaleString()} coins` : money(i.dollars || 0, 2), fmtDay(i.date, { day: "numeric", month: "short" })].join(" · ") }))));
  const per = shop.coinsPerLevel || {};
  $("shop-rules").textContent = `Earn: Task ${per.Task} · PBI ${per.PBI} · Feature ${per.Feature} · Epic ${(per.Epic || 0).toLocaleString()} coins when it's done. ${shop.coinsPerDollar} coins = $1.`;
  $("shop-notion").hidden = !shop.notionUrl;
  if (shop.notionUrl) $("shop-notion").href = shop.notionUrl;
}
async function shopWrite(values, okText) {
  try {
    const res = await api("/api/shop", { values });
    if (res.live) state.shop = { ...state.shop, ...(await api("/api/shop")) };
    else state.shop.items = [...state.shop.items, { id: `local-${Date.now()}`, date: todayStr(), ...values }];
    toast(res.live ? okText : `${okText} (sample data, not saved)`);
    renderShop();
    renderJars();
  } catch (err) { toast(err.message, true); }
}
$("shop-close").addEventListener("click", () => $("shop-dialog").close());

// ---------- record player and music controls (the Music app on this Mac) ----------

// Mel's Canva images (set either to null to fall back to the drawn version)
const RECORD_ART = { shelf: "assets/obj/record-player.png", top: "assets/obj/record-player-top.png" };
let music = { available: false };
let placed = null; // the record on the platter

const PLAY_ICON = "M7 4l13 8-13 8z";
const PAUSE_ICON = "M7 4h4v16H7zM14 4h4v16h-4z";

function renderRecordPlayer() {
  const btn = $("record-player");
  btn.replaceChildren(RECORD_ART.shelf
    ? h("img", { src: RECORD_ART.shelf, alt: "" })
    : h("span", { className: "rp-draw", ariaHidden: "true" }, h("span", { className: "rp-lid" }), h("span", { className: "rp-top" }, h("i")), h("span", { className: "rp-box" }, h("b"), h("b"))));
  if (RECORD_ART.top) {
    $("deck").style.setProperty("--deck-art", `url("${RECORD_ART.top}")`);
    $("deck").classList.add("art");
  }
}

function renderMusic() {
  const playing = music.state === "playing";
  const active = playing || music.state === "paused";
  $("now-playing").hidden = !music.available;
  $("now-playing").classList.toggle("playing", playing);
  $("np-track").textContent = active && music.track ? music.track : "Music";
  $("np-artist").textContent = music.state === "unknown"
    ? "Allow Hanua to control Music"
    : active ? [music.artist, music.playlist].filter(Boolean).join(" · ") : "Pick a record, or press play";
  $("np-icon").setAttribute("d", playing ? PAUSE_ICON : PLAY_ICON);
  $("np-play").ariaLabel = playing ? "Pause" : "Play";
  $("np-prev").disabled = $("np-next").disabled = !active;
  // the record spins only while music is really playing
  const record = state.records.find((r) => r.name === music.playlist) || placed;
  if (playing && record) setVinyl(record);
  $("deck").classList.toggle("spinning", playing);
  $("record-player").classList.toggle("playing", playing);
  $("record-player").title = playing ? `Playing ${music.playlist || music.track}` : "Play some music";
  $("lift-needle").hidden = !playing;
  if (active && record) $("tt-now").textContent = record.name;
}

async function refreshMusic() {
  try { music = await api("/api/music"); } catch { music = { available: false }; }
  renderMusic();
}

async function musicDo(action) {
  try {
    music = await api(`/api/music/${action}`, {});
    renderMusic();
  } catch (err) {
    toast(/not allowed|not authori[sz]ed|-1743/i.test(err.message) ? "Allow Hanua to control Music in System Settings → Privacy & Security → Automation" : err.message, true);
  }
}
$("np-play").addEventListener("click", () => musicDo("playpause"));
$("np-prev").addEventListener("click", () => musicDo("previous"));
$("np-next").addEventListener("click", () => musicDo("next"));

function setVinyl(r) {
  $("vinyl").style.setProperty("--lc", r.color || "#C4602A");
  $("vinyl-label").textContent = r.name;
  $("deck").classList.add("loaded");
}

function renderCrate() {
  $("sleeves").replaceChildren(...state.records.map((r) => {
    const el = h("button", { type: "button", className: `sleeve${placed?.name === r.name ? " on" : ""}` },
      h("span", { className: "sl-art" }, h("i")),
      h("span", { className: "sl-name", textContent: r.name }),
      h("span", { className: "sl-note", textContent: r.note || "" }));
    el.style.setProperty("--lc", r.color || "#C4602A");
    el.addEventListener("click", () => playRecord(r));
    return el;
  }));
}

const embedUrl = (url) => url.replace("://music.apple.com/", "://embed.music.apple.com/");

async function playRecord(r) {
  placed = r;
  setVinyl(r);
  $("deck").classList.remove("drop");
  void $("deck").offsetWidth;
  $("deck").classList.add("drop");
  $("tt-now").textContent = r.name;
  renderCrate();
  if (!music.available) {
    // Not on the Mac (or Music unreachable): fall back to Apple's player inside the page
    $("am-player").replaceChildren(h("iframe", {
      src: embedUrl(r.url), title: `${r.name} on Apple Music`, height: 175, loading: "lazy",
      allow: "autoplay *; encrypted-media *; clipboard-write",
      sandbox: "allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation",
    }));
    return;
  }
  try {
    music = await api("/api/music/record", { name: r.name });
    $("tt-note").textContent = music.via === "opened"
      ? `“${r.name}” isn't in your Music library yet, so it's open in the Music app: press play there, or add it to your library and Hanua can start it next time.`
      : "Playing in the Music app. Use the controls by the greeting to pause or skip.";
    renderMusic();
  } catch (err) {
    toast(err.message, true);
  }
}

$("lift-needle").addEventListener("click", async () => {
  await musicDo("pause");
  placed = null;
  $("deck").classList.remove("loaded", "drop");
  $("vinyl-label").textContent = "";
  $("tt-now").textContent = "Choose a record";
  renderCrate();
});

// Closing only hides the player view; the music carries on in the Music app.
function openTurntable() {
  renderCrate();
  $("turntable").classList.add("open");
  $("turntable").setAttribute("aria-hidden", "false");
  $("turntable").inert = false;
  $("turntable-close").focus({ preventScroll: true });
}
function closeTurntable() {
  $("turntable").classList.remove("open");
  $("turntable").setAttribute("aria-hidden", "true");
  $("turntable").inert = true;
  $("record-player").focus({ preventScroll: true });
}
$("turntable").inert = true;
$("record-player").addEventListener("click", openTurntable);
$("turntable-close").addEventListener("click", closeTurntable);
$("turntable").addEventListener("click", (e) => { if (e.target === $("turntable")) closeTurntable(); });

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

// ---------- to the desk ----------

$("to-desk").addEventListener("click", () => {
  const top = $("desk-edge").getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
});

// ---------- feed ----------

let pendingDraft = null;

$("feed-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("feed-input").value.trim();
  if (!text) return;
  const button = e.submitter;
  button.disabled = true; button.textContent = "…";
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
    button.disabled = false; button.textContent = "ADD";
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
  $("greet").textContent = hr < 12 ? "Good morning." : hr < 18 ? "Good afternoon." : "Good evening.";
  $("today-label").textContent = longDate(now);
  $("arc-date").textContent = longDate(now).toUpperCase().replace(",", " ·");
  const { notion, claude } = state.status;
  const live = state.areas.filter((a) => a.live).length;
  $("status").replaceChildren(
    h("span", { className: `pill${notion && live ? " on" : ""}`, textContent: notion ? `Notion ${live}/${state.areas.length}` : "Notion · sample" }),
    h("span", { className: `pill${state.money?.live ? " on" : ""}`, textContent: state.money?.live ? "Pūtea live" : "Pūtea · sample" }),
    h("span", { className: `pill${claude ? " on" : ""}`, textContent: claude ? "Claude on" : "Claude off" }),
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
  renderJars();
  if (onBoard) renderBoard();
}

async function load() {
  const [areas, moneyData, goals, crate, reviews, shop] = await Promise.allSettled([api("/api/areas"), api("/api/money"), api("/api/goals"), api("/api/records"), api("/api/reviews"), api("/api/shop")]);
  if (areas.status === "fulfilled") Object.assign(state, { areas: areas.value.areas, status: areas.value.status });
  else toast(areas.reason.message, true);
  if (moneyData.status === "fulfilled") state.money = moneyData.value;
  if (goals.status === "fulfilled") state.goals = goals.value;
  if (crate.status === "fulfilled") state.records = crate.value.records;
  if (reviews.status === "fulfilled") state.reviews = reviews.value;
  if (shop.status === "fulfilled") state.shop = { ...state.shop, ...shop.value };
  renderAll();
}

renderLamp();
renderClock();
renderRecordPlayer();
refreshMusic();
// keep the song name current (only while Hanua's tab is showing)
setInterval(() => { if (document.visibilityState === "visible") refreshMusic(); }, 5000);
renderMoneyScreen();
load();
setInterval(renderClock, 1000);
// keep the "now" line, greeting and today's date current
setInterval(() => { renderHeader(); renderAgenda(); }, 60_000);
