const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNarrow = () => matchMedia("(max-width: 900px)").matches;

// Which Notion area plays which part on the page (ids from config/areas.json)
const ROLE = { tasks: "work", events: "calendar", notes: "learning", people: "relationships" };
const MONEY_BOOK = { id: "money", label: "Money", icon: "$", color: "#2e5e4e", money: true };
// Spine artwork per book (assets/shelf/book-*.png); books without one get a plain cloth spine
const SPINES = { work: "work", calendar: "calendar", money: "money", health: "health", learning: "learning", relationships: "people" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

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

function toast(msg, bad = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("bad", bad);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
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

function renderClock() {
  const t = new Date();
  const s = t.getSeconds(), m = t.getMinutes() + s / 60, hr = (t.getHours() % 12) + m / 60;
  $("hand-h").style.transform = `rotate(${hr * 30}deg)`;
  $("hand-m").style.transform = `rotate(${m * 6}deg)`;
  $("hand-s").style.transform = `rotate(${s * 6}deg)`;
  $("clock").ariaLabel = `Clock showing ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// ---------- wall: money monitor ----------

function renderMoneyScreen() {
  const m = state.money;
  const el = $("screen");
  if (!m) return el.replaceChildren(h("span", { className: "screen-title", textContent: "Loading Pūtea…" }));
  const month = parseDay(`${m.month.ym}-01`).toLocaleDateString(undefined, { month: "long" });
  const change = m.month.prevExpenses ? (m.month.expenses - m.month.prevExpenses) / m.month.prevExpenses : 0;
  const max = Math.max(...m.month.categories.map((c) => c.total), 1);
  el.replaceChildren(
    h("span", { className: "screen-top" },
      h("span", { className: "screen-title", textContent: `${month} spending` }),
      m.month.prevExpenses
        ? h("span", { className: `delta${change > 0 ? " up" : ""}`, textContent: `${change <= 0 ? "↓" : "↑"} ${Math.abs(change * 100).toFixed(0)}% vs last month` })
        : null),
    h("span", { className: "total" },
      h("span", { className: "cur", textContent: "$" }),
      h("span", { className: "num", textContent: num(m.month.expenses) })),
    h("span", { className: "cats" }, m.month.categories.map((c) =>
      h("span", { className: "cat" },
        h("span", { className: "name", textContent: c.name }),
        h("span", { className: "track" }, Object.assign(h("span", { className: "fill" }), { style: `width:${(c.total / max) * 100}%` })),
        h("span", { className: "amt", textContent: money(c.total) })))),
    h("span", { className: "screen-foot" },
      h("span", { textContent: m.live ? "Pūtea · live" : "Sample · Pūtea isn't running" }),
      h("span", { textContent: `Last month ${money(m.month.prevExpenses)}` })),
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
$("screen-power").addEventListener("click", () => {
  screenOn = !screenOn;
  store("room-screen", screenOn ? "on" : "off");
  applyScreen(true);
});
applyScreen(false);

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
    const cell = h("button", {
      type: "button",
      className: `day${inMonth ? "" : " other"}${key === today ? " today" : ""}${inMonth && key === selectedDay && key !== today ? " sel" : ""}`,
      title: dayItems.map((x) => `${timeOf(x.date) ? timeOf(x.date) + " " : ""}${x.title}`).join("\n"),
      tabIndex: inMonth ? 0 : -1,
      ariaLabel: `${longDate(d, false)}${dayItems.length ? `, ${dayItems.length} item${dayItems.length > 1 ? "s" : ""}` : ""}`,
    },
      h("span", { className: "n", textContent: d.getDate() }),
      dayItems.length ? h("span", { className: "dots" }, dayItems.slice(0, 3).map((x) => Object.assign(h("i"), { style: `--dot:${x.color}` }))) : null,
    );
    if (inMonth) cell.addEventListener("click", () => { selectedDay = key; renderCalendar(); });
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
    el.addEventListener("click", () => openBook(n.book, bookEl(n.book)));
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
  document.body.style.overflow = "";
  openEl = null;
  setActive(null);
  fromEl?.focus({ preventScroll: true });
}

$("reader-close").addEventListener("click", closeBook);
$("reader").addEventListener("click", (e) => { if (e.target === $("reader")) closeBook(); });
$("money-screen").addEventListener("click", () => { if (screenOn) openBook("money", bookEl("money")); });
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
}

async function load() {
  const [areas, moneyData] = await Promise.allSettled([api("/api/areas"), api("/api/money")]);
  if (areas.status === "fulfilled") Object.assign(state, { areas: areas.value.areas, status: areas.value.status });
  else toast(areas.reason.message, true);
  if (moneyData.status === "fulfilled") state.money = moneyData.value;
  renderAll();
}

renderLamp();
renderClock();
renderMoneyScreen();
load();
setInterval(renderClock, 1000);
// keep the "now" line, greeting and today's date current
setInterval(() => { renderHeader(); renderAgenda(); }, 60_000);
