import "./lock.js"; // the sleep screen goes up before anything else
import { aheadText, dayOf, daysBetween, lastLightSwitch, pad, parseDay, timeIn, timeOf, todayStr, ymd } from "./shared/dates.js";
import { GREET_EVERY_MS, GREET_NAME, greetingsAt, timeOfDay } from "./shared/greetings.js";
import { onCalendar } from "./shared/goals.js";
import { $, ago, api, area, fmtDay, focus, focusGoals, h, hiddenInFocus, isDone, isNarrow, longDate, money, num, records, reducedMotion, state, store, toast, updatedLine } from "./lib.js";
import { onBoard, renderBoard, showBoard } from "./goals/board.js";
import { openGoal } from "./goals/form.js";
import { openReview, reviewDue } from "./goals/review.js";
import { renderTopShelf, toggleEarnings } from "./shelf.js";
import { loadPlant } from "./plant.js";
import { loadWhiteboard, renderWhiteboard } from "./whiteboard.js";
import "./menu-plan.js"; // Plan the week ✦ on the menu board
import { onKitchen, renderMealSlip, showKitchen } from "./kitchen.js"; // swipe left: the weather window and the menu
import { weatherLine } from "./weather-window.js";
import "./bird.js"; // the canary: just for life
import { loadDesk, loadStickies, renderAgenda, renderStickies, renderTodo, showDesk } from "./planner.js"; // the desk: monitor, planner, stickies, agenda

// Which Notion area plays which part on the page (ids from config/areas.json)
export const ROLE = { tasks: "work", events: "calendar", notes: "learning", people: "relationships" };
export const MONEY_BOOK = { id: "money", label: "Money", icon: "$", color: "#2e5e4e", money: true };
// Spine artwork per book (assets/shelf/book-*.png); books without one get a plain cloth spine
export const SPINES = { work: "work", calendar: "calendar", money: "money", health: "health", learning: "learning", relationships: "people" };
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];


// ---------- bookcase ----------

export let activeBook = null;

export function shelfBooks() {
  const list = state.areas.map((a) => ({ ...a }));
  const at = Math.max(0, list.findIndex((a) => a.id === ROLE.events) + 1);
  list.splice(at, 0, { ...MONEY_BOOK, live: state.money?.live });
  return list;
}

export function renderShelf() {
  const books = shelfBooks();
  const groups = [books.slice(0, 3), books.slice(3)].filter((g) => g.length);
  $("books").replaceChildren(...groups.map((group) => h("div", { className: "shelf-row" },
    h("div", { className: "shelf-books" }, group.map((b) => {
      const spine = SPINES[b.id];
      const away = hiddenInFocus(b.id);
      const badge = away ? "" : badgeFor(b);
      const el = h("button", { className: `book${spine ? "" : " plain"}${b.id === activeBook ? " active" : ""}${away ? " away" : ""}`, type: "button", title: away ? `${b.label} · put away while you're at work` : [b.label, b.money ? "" : updatedLine(b.id)].filter(Boolean).join(" · "), ariaLabel: away ? `${b.label}, put away while you're at work` : `Open ${b.label}` },
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

export function badgeFor(b) {
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

export const bookEl = (id) => document.querySelector(`.book[data-id="${id}"]`);

// ---------- wall: lamp and clock ----------

export let lampOn = store("room-lamp") !== "off";

// One switch for the whole room: every lamp and every pull cord turns all the lights on or off together.
export function renderLamp() {
  $("app").classList.toggle("lamp-off", !lampOn);
  document.querySelectorAll(".lamp").forEach((b) => {
    b.title = lampOn ? "Switch the lights off" : "Switch the lights on";
    b.setAttribute("aria-pressed", String(lampOn));
  });
  document.querySelectorAll(".pull-cord").forEach((c) => {
    c.setAttribute("aria-pressed", String(lampOn));
    c.ariaLabel = lampOn ? "Pull to switch all the lights off" : "Pull to switch all the lights on";
    c.title = lampOn ? "Pull: lights off" : "Pull: lights on";
  });
}
export function toggleLights() {
  lampOn = !lampOn;
  store("room-lamp", lampOn ? "on" : "off");
  renderLamp();
}
document.querySelectorAll(".lamp").forEach((b) => b.addEventListener("click", toggleLights));

// Off at 9 pm, on at 4 am, by themselves. Each switch happens once (remembered as room-lamp-auto),
// so pulling the cord afterwards wins until the next one. Checked on load and every minute.
export function autoLights() {
  const { key, on } = lastLightSwitch();
  if (store("room-lamp-auto") === key) return;
  store("room-lamp-auto", key);
  if (lampOn === on) return;
  lampOn = on;
  store("room-lamp", on ? "on" : "off");
  renderLamp();
}

// The pull cord: click it, or drag the bead down and let go. It springs back either way.
document.querySelectorAll(".pull-cord").forEach((cord) => {
  let startY = null, pulled = 0, dragged = false;
  const spring = () => {
    cord.style.setProperty("--pull", "0px");
    cord.classList.remove("held");
    if (!reducedMotion) { cord.classList.remove("tug"); void cord.offsetWidth; cord.classList.add("tug"); }
  };
  cord.addEventListener("pointerdown", (e) => {
    startY = e.clientY; pulled = 0; dragged = false;
    cord.setPointerCapture(e.pointerId);
    cord.classList.add("held");
  });
  cord.addEventListener("pointermove", (e) => {
    if (startY == null) return;
    pulled = Math.max(0, Math.min(26, e.clientY - startY));
    if (pulled > 3) dragged = true;
    cord.style.setProperty("--pull", `${pulled}px`);
  });
  cord.addEventListener("pointerup", () => {
    if (startY == null) return;
    startY = null;
    if (dragged && pulled >= 10) toggleLights();
    if (dragged) spring();
    cord.dataset.skipClick = dragged ? "1" : "";
  });
  cord.addEventListener("pointercancel", () => { startY = null; spring(); });
  cord.addEventListener("click", () => {
    if (cord.dataset.skipClick === "1") { cord.dataset.skipClick = ""; return; } // a drag already decided
    toggleLights();
    spring();
  });
});

// Retro flip clock: each digit is a card; when it changes, the top half flips down to show the new one.
export const clockShown = [];
export function flipTo(card, digit, animate) {
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

// The clocks for elsewhere (Sydney, Suva, Los Angeles: white) get the same flip cards as the one for here (black):
// the time, and the day and date there underneath.
for (const c of document.querySelectorAll(".wall-clock.away")) {
  const pair = () => h("span", { className: "flip-pair" }, h("span", { className: "flip" }), h("span", { className: "flip" }));
  c.append(h("div", { className: "flip-face" }, pair(), pair()),
    h("div", { className: "flip-date" }, h("span", { className: "flip word" }), h("span", { className: "flip num" }), h("span", { className: "flip word" })),
    h("span", { className: "flip-ampm" }), h("span", { className: "wc-city" }));
}
const hereZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
const hereCity = (hereZone.split("/").pop() || "Here").replace(/_/g, " ");
const awayShown = new WeakMap();
function renderAwayClocks() {
  const others = [];
  for (const c of document.querySelectorAll(".wall-clock.away")) {
    const t = timeIn(c.dataset.zone);
    const digits = `${pad(t.hour % 12 || 12)}${pad(t.minute)}`;
    const shown = awayShown.get(c) || [];
    c.querySelectorAll(".flip-face .flip").forEach((card, i) => {
      if (shown[i] !== digits[i]) flipTo(card, i === 0 && digits[0] === "0" ? "" : digits[i], shown[i] !== undefined);
    });
    const date = [t.weekday, pad(t.day), t.month];
    c.querySelectorAll(".flip-date .flip").forEach((card, i) => {
      if (shown[4 + i] !== date[i]) flipTo(card, date[i], shown[4 + i] !== undefined);
    });
    awayShown.set(c, [...digits, ...date]);
    c.querySelector(".flip-ampm").textContent = t.hour < 12 ? "AM" : "PM";
    others.push(`${c.dataset.city} ${t.hour % 12 || 12}:${pad(t.minute)} ${t.hour < 12 ? "am" : "pm"}`);
    const behind = aheadText(t.ahead);
    c.querySelector(".wc-city").textContent = `${c.dataset.city} ${behind}`.toUpperCase();
    c.ariaLabel = `${c.dataset.city}: ${t.hour % 12 || 12}:${pad(t.minute)} ${t.hour < 12 ? "am" : "pm"}${t.ahead ? `, ${Math.abs(t.ahead)} ${Math.abs(t.ahead) === 1 ? "hour" : "hours"} ${t.ahead < 0 ? "behind" : "ahead"}` : ""}`;
  }
  return others;
}

export function renderClock() {
  $("wc-others").textContent = renderAwayClocks().join("  ·  ").toUpperCase();
  const t = new Date();
  const hr12 = t.getHours() % 12 || 12;
  const digits = `${pad(hr12)}${pad(t.getMinutes())}`;
  for (let i = 0; i < 4; i++) {
    if (clockShown[i] !== digits[i]) flipTo($(`fd${i}`), i === 0 && digits[0] === "0" ? "" : digits[i], clockShown[i] !== undefined);
    clockShown[i] = digits[i];
  }
  $("flip-ampm").textContent = t.getHours() < 12 ? "AM" : "PM";
  // the day and date flip over at midnight, like the time
  const date = [t.toLocaleDateString("en-NZ", { weekday: "short" }).toUpperCase(), pad(t.getDate()), t.toLocaleDateString("en-NZ", { month: "short" }).toUpperCase()];
  ["fdd", "fdn", "fdm"].forEach((id, i) => {
    if (clockShown[4 + i] !== date[i]) flipTo($(id), date[i], clockShown[4 + i] !== undefined);
    clockShown[4 + i] = date[i];
  });
  $("wc-here").textContent = hereCity.toUpperCase();
  $("clock").ariaLabel = `${hereCity}: clock showing ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}, ${t.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`;
}

// ---------- wall: money monitor and its remote ----------

// The remote's power hides every money view (screen, desk receipt, Money book); the screen's own button only the screen.
export let moneyHidden = store("room-money") === "hidden";
// At work (Focus) money is always hidden and the TV is off, whatever the remote was last set to
export const moneyOff = () => moneyHidden || focus.on;
export const CHANNELS = ["Overview", "Expenses", "Income"];
export let channel = Math.min(CHANNELS.length - 1, Math.max(0, Number(store("room-channel")) || 0));

export const row = (name, mid, amt, cls = "") =>
  h("span", { className: `cat ${cls}` }, h("span", { className: "name", textContent: name }), mid, h("span", { className: "amt", textContent: amt }));

export function renderMoneyScreen() {
  const m = state.money;
  const el = $("screen");
  if (focus.on) return el.replaceChildren();
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
export let screenOn = store("room-screen") !== "off";
export const screenShows = () => screenOn && !focus.on;
const atWork = () => toast("Money stays hidden while you're at work. Flip the sign to At home to show it.");
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
export function applyScreen(animate) {
  const screenOn = screenShows();
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
export function setScreen(on, animate = true) {
  if (on === screenOn) return;
  screenOn = on;
  store("room-screen", screenOn ? "on" : "off");
  applyScreen(animate);
}
$("screen-power").addEventListener("click", () => (focus.on ? atWork() : setScreen(!screenOn)));

export function blinkRemote() {
  const ir = $("remote-ir");
  ir.classList.remove("blink");
  void ir.offsetWidth;
  ir.classList.add("blink");
}

export function applyRemote() {
  const p = $("remote-power");
  p.setAttribute("aria-pressed", String(moneyOff()));
  p.title = moneyOff() ? "Show money views again" : "Hide all money views";
  p.ariaLabel = moneyOff() ? "Show all money views" : "Hide all money views";
  $("app").classList.toggle("money-hidden", moneyOff());
}

$("remote-power").addEventListener("click", () => {
  blinkRemote();
  if (focus.on) return atWork();
  moneyHidden = !moneyHidden;
  store("room-money", moneyHidden ? "hidden" : "shown");
  setScreen(!moneyHidden);
  applyRemote();
  if (activeBook === "money") closeBook();
});

export function changeChannel(step) {
  blinkRemote();
  if (!screenShows()) return; // like a real set: channels need the screen on
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

export const TYPE_COLORS = { work: "#2b3f6b", personal: "#3B6B5A", family: "#C4602A", social: "#9a5530", busy: "#8a8178" };
export let selectedDay = todayStr();

// Goal levels' colours, matching the cards on the goals board
export const LEVEL_COLORS = { Epic: "#C4602A", Feature: "#5a4372", PBI: "#2b3f6b", Task: "#C9962F" };
export let calOffset = 0; // months away from this one

export function calendarItems() {
  const ev = records(ROLE.events).filter((r) => r.date).map((r) => ({ ...r, kind: r.status || "Event", color: TYPE_COLORS[(r.status || "").toLowerCase()] || "#3B6B5A" }));
  const due = records(ROLE.tasks).filter((r) => r.date && !isDone(r)).map((r) => ({ ...r, kind: "Due", color: "#C4602A" }));
  // Tasks and PBIs land on their due date automatically, in their level's colour (Epics and Features don't: onCalendar)
  const goals = focusGoals(state.goals?.goals || []).filter(onCalendar).map((g) => ({ id: g.id, url: g.url, title: g.title, date: g.due, status: g.status, kind: g.level || "Task", color: LEVEL_COLORS[g.level] || "#C9962F", goal: g }));
  return [...ev, ...due, ...goals];
}

export function renderCalendar() {
  const real = new Date();
  const now = new Date(real.getFullYear(), real.getMonth() + calOffset, 1);
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
          ? sortByTime(dayItems).slice(0, 4).map((x) => h("span", { style: `--dot:${x.color}` }, h("em", { className: timeOf(x.date) ? "time" : "kind", textContent: timeOf(x.date) || (x.goal ? x.kind : x.kind === "Due" ? "Due" : "All day") }), x.title))
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
    // zoomed: a ✕ in the calendar's top-right corner, where anyone looks for it (Mel, 5 Oct 2026)
    calWide ? (() => { const b = h("button", { type: "button", className: "cal-close", textContent: "✕", ariaLabel: "Back to the wall", title: "Back to the wall (Esc)" }); b.addEventListener("click", () => zoomCalendar(false)); return b; })() : "",
    // the month in the middle with the year small underneath, the arrows at the calendar's sides (Mel, 5 Oct 2026)
    h("div", { className: "cal-head" },
      calNav("‹", "Previous month", -1),
      h("div", { className: "cal-title" },
      h("h2", {}, (() => {
        // the month's name zooms the calendar out over the wall, and back (Mel, 5 Oct 2026)
        const b = h("button", { type: "button", className: "cal-month", id: "cal-month", textContent: now.toLocaleDateString(undefined, { month: "long" }),
          title: calWide ? "Back to the wall" : "See the month bigger" });
        b.setAttribute("aria-expanded", String(calWide));
        b.addEventListener("click", () => zoomCalendar());
        return b;
      })()),
      h("span", { className: "cal-year" }, String(now.getFullYear()),
        calOffset ? (() => { const b = h("button", { type: "button", className: "cal-today", textContent: "Today" }); b.addEventListener("click", () => { calOffset = 0; selectedDay = todayStr(); renderCalendar(); }); return b; })() : null)),
      calNav("›", "Next month", 1)),
    h("div", { className: "dow", ariaHidden: "true" }, ["M", "T", "W", "T", "F", "S", "S"].map((d) => h("span", { textContent: d }))),
    grid,
    h("div", { className: "cal-foot" },
      // today needs no heading: the clocks already say the date (Mel, 5 Oct 2026); another day picked says which
      selectedDay === today ? null : h("span", { className: "sel-label", textContent: longDate(parseDay(selectedDay), false) }),
      list.length ? null : h("span", { className: "none", textContent: selectedDay === today ? "Nothing coming up." : "Nothing on this day." })),
    list.length
      ? h("ul", { className: "upcoming" }, list.map((x) => h("li", {},
          h("time", { textContent: dayOf(x.date) === today ? (timeOf(x.date) || "Today") : fmtDay(x.date, { weekday: "short", day: "numeric" }) }),
          h("span", { className: "t", textContent: x.kind === "Due" ? `Due: ${x.title}` : x.title }),
          h("span", { className: "tag", textContent: x.kind }))))
      : "",
  );
}

// ---------- wall: the calendar zoomed out over the wall ----------
// The left column (greeting shelf down to the TV and the menu) slides off to the left, and the calendar grows
// from where it hung to the wall's width, with each day's titles written in its square. Click the month again,
// ✕ or Esc to put it back. When the wall is stacked in one column (narrower screens) the squares just grow.
export let calWide = false;
let zooming = false;
const phone = () => matchMedia("(max-width: 600px)").matches; // the calendar is the screen's width already
const wallRow = () => $("calendar").closest(".wall-row");
const sideBySide = () => { const l = wallRow().querySelector(".wall-left").getBoundingClientRect(), r = wallRow().querySelector(".wall-right").getBoundingClientRect(); return l.width > 0 && r.left > l.right - 1; };
// an animation's end, or its duration if the page isn't drawing (a hidden window can stall animations)
const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 80))]);
// One movement each way (Mel, 5 Oct 2026): opening, the left column glides off to the left as the calendar widens
// into its space; closing, the calendar narrows back and the column glides in behind it. The calendar's real width
// grows (not a stretched picture), so its text stays crisp and the squares grow with it (CSS transitions on .day).
const ZOOM = { ms: 800, ease: "cubic-bezier(.33,.1,.25,1)" };
export async function zoomCalendar(on = !calWide) {
  if (on === calWide || zooming || (on && phone())) return;
  zooming = true;
  const row = wallRow(), left = row.querySelector(".wall-left"), right = row.querySelector(".wall-right");
  const slide = on ? sideBySide() : row.classList.contains("cal-slide");
  const animate = slide && !reducedMotion;
  const box = (el) => el.getBoundingClientRect();
  const r0 = box(row), right0 = box(right), h0 = r0.height;
  // the calendar redraws first (✕, the month button), then the class changes, so the squares' growth is a transition
  calWide = on;
  renderCalendar();
  void row.offsetWidth;
  const pin = (L) => Object.assign(left.style, { position: "absolute", left: `${L.left - r0.left}px`, top: `${L.top - r0.top}px`, width: `${L.width}px`, margin: "0" });
  const unpin = () => { left.removeAttribute("style"); right.style.removeProperty("max-width"); right.style.removeProperty("margin-left"); row.style.removeProperty("position"); row.style.removeProperty("min-height"); };
  let pinned = null;
  let hEnd = 0;
  if (on) {
    if (animate) {
      pinned = box(left); row.style.position = "relative"; pin(pinned);
      // the row's height once the squares have grown, measured with their growth switched off for a moment
      row.classList.add("cal-measure", "cal-wide");
      hEnd = box(row).height;
      row.classList.remove("cal-wide");
      void row.offsetWidth;
      row.classList.remove("cal-measure");
      void row.offsetWidth;
      row.classList.add("cal-growing"); // the titles wait until the squares have grown
    }
    row.classList.add("cal-wide");
    if (!animate) row.classList.toggle("cal-slide", slide);
  } else {
    row.classList.remove("cal-wide", "cal-slide");
    if (animate) { pinned = box(left); row.style.position = "relative"; row.classList.add("cal-growing"); }
  }
  left.inert = on && slide;
  $("cal-month").focus({ preventScroll: true });
  if (animate) {
    // where the calendar ends up and how tall the row becomes, measured in the final layout (column pinned out of
    // the row when opening; back in the row when closing, then pinned again for its glide)
    const r1 = box(right), h1 = box(row).height;
    const target = { left: r1.left - r0.left, width: r1.width };
    if (!on) pin(pinned);
    const moves = [
      right.animate([{ maxWidth: `${right0.width}px`, marginLeft: `${right0.left - r0.left}px` }, { maxWidth: `${target.width}px`, marginLeft: `${target.left}px` }],
        { duration: ZOOM.ms, delay: on ? 140 : 0, easing: ZOOM.ease, fill: "both" }),
      row.animate([{ minHeight: `${h0}px` }, { minHeight: `${on ? hEnd : h1}px` }], { duration: ZOOM.ms, delay: on ? 140 : 0, easing: ZOOM.ease, fill: "both" }),
      left.animate(on ? [{ transform: "none", opacity: 1 }, { transform: "translateX(-112%)", opacity: 0 }] : [{ transform: "translateX(-112%)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: ZOOM.ms - 80, delay: on ? 0 : 220, easing: ZOOM.ease, fill: "both" }),
    ];
    await settle(moves[0], ZOOM.ms + 220);
    if (on) row.classList.add("cal-slide");
    row.classList.remove("cal-growing");
    unpin();
    moves.forEach((m) => m.cancel());
    if (!on) row.querySelector(".player-shelf")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
  }
  window.dispatchEvent(new Event("resize")); // the canary leaves anything that just went away
  zooming = false;
}
// a window made narrow enough to stack the wall puts the calendar back
addEventListener("resize", () => { if (calWide && !zooming && wallRow().classList.contains("cal-slide") && isNarrow()) zoomCalendar(false); });

export const sortByTime = (list) => [...list].sort((a, b) => (timeOf(a.date) || "00:00").localeCompare(timeOf(b.date) || "00:00"));

// The day window: everything on one day, each linking back to its Notion page.
export let dialogDay = null;
export function openDay(key) {
  dialogDay = key;
  const items = calendarItems().filter((x) => dayOf(x.date) === key);
  const goalsDue = items.filter((x) => x.goal);
  const events = sortByTime(items.filter((x) => x.kind !== "Due" && !x.goal));
  const due = items.filter((x) => x.kind === "Due");
  const d = parseDay(key);
  const rel = daysBetween(todayStr(), key);
  $("day-eyebrow").textContent = rel === 0 ? "Today" : rel === 1 ? "Tomorrow" : rel === -1 ? "Yesterday" : rel > 0 ? `In ${rel} days` : `${-rel} days ago`;
  $("day-title").textContent = longDate(d, false);
  const line = (x, label) => {
    const openGoalBtn = x.goal ? h("button", { type: "button", className: "link-btn", textContent: "Open goal" }) : null;
    openGoalBtn?.addEventListener("click", () => { $("day-dialog").close(); openGoal(x.goal); });
    return h("li", { className: "entry" },
      h("span", { className: "t", textContent: x.title }),
      h("span", { className: "v", textContent: label }),
      h("span", { className: "m" }, x.kind, openGoalBtn ? h("span", {}, " · ", openGoalBtn) : null, x.url ? h("span", {}, " · ", h("a", { href: x.url, target: "_blank", rel: "noopener", textContent: "Open in Notion ↗" })) : null));
  };
  $("day-body").replaceChildren(...[
    events.length ? h("div", {}, h("h4", { textContent: `${events.length} event${events.length > 1 ? "s" : ""}` }),
      h("ul", { className: "entries" }, events.map((x) => line(x, timeOf(x.date) || "All day")))) : null,
    due.length ? h("div", {}, h("h4", { textContent: `${due.length} task${due.length > 1 ? "s" : ""} due` }),
      h("ul", { className: "entries" }, due.map((x) => line({ ...x, kind: "Work" }, x.status || "To do")))) : null,
    goalsDue.length ? h("div", {}, h("h4", { textContent: `${goalsDue.length} goal${goalsDue.length > 1 ? "s" : ""} due` }),
      h("ul", { className: "entries" }, goalsDue.map((x) => line(x, x.status || "New")))) : null,
    items.length ? null : h("p", { className: "empty", textContent: "Nothing scheduled. “Add to this day” drafts something with the Feed bar." }),
  ].filter(Boolean));
  const cal = area(ROLE.events);
  $("day-notion").hidden = !cal?.notionUrl;
  if (cal?.notionUrl) $("day-notion").href = cal.notionUrl;
  if (!$("day-dialog").open) $("day-dialog").showModal();
}
export const shiftDay = (key, n) => { const d = parseDay(key); return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
$("day-prev").addEventListener("click", () => openDay(shiftDay(dialogDay, -1)));
$("day-next").addEventListener("click", () => openDay(shiftDay(dialogDay, 1)));
$("day-close").addEventListener("click", () => $("day-dialog").close());
$("day-dialog").addEventListener("click", (e) => { if (e.target === $("day-dialog")) $("day-dialog").close(); });
$("day-add").addEventListener("click", () => {
  $("day-dialog").close();
  openSpotlight(`${fmtDay(dialogDay, { weekday: "short", day: "numeric", month: "short" })}: `);
});

export function calNav(label, aria, step) {
  const b = h("button", { type: "button", className: "cal-nav", textContent: label, ariaLabel: aria, title: aria });
  b.addEventListener("click", () => {
    calOffset += step;
    const real = new Date();
    selectedDay = calOffset ? ymd(new Date(real.getFullYear(), real.getMonth() + calOffset, 1)) : todayStr();
    renderCalendar();
  });
  return b;
}

// ---------- wall: pinned notes ----------

export const NOTE_COLORS = ["#F5DDD0", "#D8EDE8", "#EDE5D4", "#D0E8F0"];
export const NOTE_TILTS = ["-2deg", "1.5deg", "-0.8deg", "2.4deg", "-1.6deg"];

export function renderNotes() {
  const today = todayStr();
  const notes = [];
  for (const r of records(ROLE.notes).slice(0, 4)) {
    notes.push({ text: r.title, meta: `Learning · ${fmtDay(r.date, { day: "numeric", month: "short" })}`, book: ROLE.notes, rid: r.id });
  }
  for (const r of records(ROLE.people)) {
    const gap = r.date ? daysBetween(r.date, today) : null;
    if (gap !== null && gap >= 21) notes.push({ text: `Catch up with ${r.title}`, meta: `${gap} days since you spoke`, book: ROLE.people, rid: r.id });
  }
  for (const r of records(ROLE.tasks)) {
    if (/blocked/i.test(r.status || "")) notes.push({ text: `${r.title} is blocked`, meta: "Work · needs a nudge", book: ROLE.tasks, rid: r.id });
  }
  if (reviewDue() && !focus.on) notes.unshift({ text: "Weekly review due", meta: "Goals · ten minutes", run: () => { showBoard(true); openReview(); } });
  const box = $("notes");
  if (!notes.length) {
    return box.replaceChildren(h("div", { className: "notes-empty" },
      h("div", { className: "placeholder", ariaHidden: "true" }),
      h("span", { textContent: "Your notes will pin here." })));
  }
  box.replaceChildren(...notes.slice(0, 8).map((n, i) => {
    const el = h("button", { type: "button", className: "note", title: n.run ? "" : "Open in its book" },
      h("span", { className: "meta", textContent: n.meta }),
      h("span", { className: "text", textContent: n.text }));
    el.style.cssText = `--nc:${NOTE_COLORS[i % NOTE_COLORS.length]};--r:${NOTE_TILTS[i % NOTE_TILTS.length]}`;
    el.addEventListener("click", () => (n.run ? n.run() : openBook(n.book, bookEl(n.book), n.rid)));
    return el;
  }));
}

// ---------- desk: ticking a Work book task (the notebook lives in planner.js) ----------

export async function toggleTask(r, li) {
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

// ---------- the open book ----------

export let openEl = null;

export function bookPages(id) {
  if (id === "money") return moneyPages();
  const a = { ...area(id), records: records(id) };
  const today = todayStr();
  const recent = a.records.filter((r) => r.date && Math.abs(daysBetween(r.date, today)) <= 30).length;
  const open = a.records.filter((r) => r.status && !isDone(r)).length;
  const left = [
    h("p", { className: "eyebrow", textContent: a.live ? "Live from Notion" : "Sample data" }),
    h("h2", { id: "book-title", textContent: a.label }),
    h("p", { className: "sub", textContent: a.error || [`${a.records.length} entries`, updatedLine(id)].filter(Boolean).join(" · ") }),
    h("div", { className: "stats" },
      [[a.records.length, "entries"], [recent, "within 30 days"], [open, "still open"], [a.records[0]?.date ? fmtDay(a.records[0].date, { day: "numeric", month: "short" }) : "—", "latest"]]
        .map(([v, l]) => h("div", { className: "stat" }, h("b", { textContent: v }), h("span", { textContent: l })))),
    askForm(id, a.label),
  ];
  const right = [
    h("h3", { textContent: "Entries" }),
    a.records.length
      ? h("ul", { className: "entries" }, a.records.map((r) => {
          const li = h("li", { className: "entry" },
            h("span", { className: "t", textContent: r.title }),
            typeof r.amount === "number" ? h("span", { className: `v ${r.amount < 0 ? "neg" : ""}`, textContent: r.amount.toLocaleString() }) : h("span"),
            h("span", { className: "m" }, [r.date ? fmtDay(r.date) + (timeOf(r.date) ? " " + timeOf(r.date) : "") : null, r.status].filter(Boolean).join(" · "),
              r.url ? h("span", {}, " · ", h("a", { href: r.url, target: "_blank", rel: "noopener", textContent: "Open in Notion ↗" })) : null));
          li.dataset.rid = r.id;
          return li;
        }))
      : h("p", { className: "empty", textContent: "Blank pages. Use the Feed bar to write the first entry." }),
  ];
  return { left, right };
}

export function moneyPages() {
  const m = state.money;
  if (moneyOff()) {
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

export function askForm(areaId, label) {
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

export function setActive(id) {
  activeBook = id;
  document.querySelectorAll(".book").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}

// focusId: a record to scroll to and mark, e.g. from a pinned note or the agenda
export async function openBook(id, fromEl, focusId = null) {
  if (openEl || !(id === "money" ? state.money : area(id))) return;
  if (hiddenInFocus(id)) return toast("That book is put away while you're at work.");
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
  // marked before the opening animation, so it never waits on it
  const entry = focusId && [...ob.querySelectorAll(".entry")].find((li) => li.dataset.rid === focusId);
  if (entry) {
    entry.classList.add("focus");
    entry.scrollIntoView({ block: "center" });
  }

  if (fromEl && !reducedMotion) {
    // grow the open book out of the spine you clicked
    const from = fromEl.getBoundingClientRect();
    const to = ob.getBoundingClientRect();
    await ob.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.6 },
      { transform: "none", opacity: 1 },
    ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }).finished;
  }
  (entry?.querySelector("a") || $("reader-close")).focus({ preventScroll: true });
}

export async function closeBook() {
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
$("money-screen").addEventListener("click", () => { if (screenShows()) openBook("money", bookEl("money")); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (!$("reader").hidden) closeBook();
  else if (!$("library").hidden) closeLibrary();
  else if ($("turntable").classList.contains("open")) closeTurntable();
  else if (calWide) zoomCalendar(false);
  else if (!$("ts-panel").hidden) toggleEarnings(false);
  else if (onBoard) showBoard(false);
  else if (onKitchen) showKitchen(false);
});

// ---------- library view: the bookcase across the middle of the screen ----------

export const LIB_HEIGHTS = [100, 92, 97, 88, 95, 90, 98, 86];

export function bookSummary(b) {
  if (b.id === "money") {
    if (moneyOff()) return focus.on ? "Put away while you're at work" : "Hidden with the remote";
    return state.money ? `${money(state.money.month.expenses)} spent this month · ${state.money.live ? "live from Pūtea" : "sample"}` : "Loading";
  }
  const a = area(b.id);
  if (!a) return "";
  if (hiddenInFocus(b.id)) return "Put away while you're at work";
  if (a.error) return "Couldn't reach Notion";
  const n = a.records.length;
  return [n ? `${n} entr${n === 1 ? "y" : "ies"}` : "No entries yet", a.live ? "live from Notion" : "sample", updatedLine(b.id)].filter(Boolean).join(" · ");
}

export function renderLibrary() {
  const books = shelfBooks();
  const caption = $("lib-caption");
  const show = (b, i) => caption.replaceChildren(
    h("span", { className: "lc-vol", textContent: `Vol. ${ROMAN[i] ?? i + 1}` }),
    h("span", { className: "lc-title", textContent: b.label }),
    h("span", { className: "lc-sum", textContent: bookSummary(b) }));
  caption.replaceChildren(h("span", { className: "lc-sum", textContent: `${books.length} books · choose one to take it down` }));
  $("lib-books").replaceChildren(...books.map((b, i) => {
    const spine = SPINES[b.id];
    const el = h("button", { type: "button", className: `lib-book${spine ? "" : " plain"}${hiddenInFocus(b.id) ? " away" : ""}`, ariaLabel: hiddenInFocus(b.id) ? `${b.label}, put away while you're at work` : `Take down ${b.label}` },
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

export async function takeDown(b, el) {
  if (openEl || el.classList.contains("out")) return;
  if (hiddenInFocus(b.id)) return toast("That book is put away while you're at work.");
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

export async function putBack(el) {
  const lifted = el.getAnimations();
  if (lifted.length && !reducedMotion) {
    await el.animate([{ transform: "translateY(-46%) scale(1.12) rotate(-3deg)" }, { transform: "none" }], { duration: 360, easing: "cubic-bezier(.4,0,.2,1)" }).finished;
  }
  lifted.forEach((a) => a.cancel());
  el.classList.remove("out");
  $("lib-books").classList.remove("picking");
}

export let libraryFrom = null;
export function openLibrary() {
  renderLibrary();
  libraryFrom = document.activeElement;
  $("library").hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => $("library").classList.add("in"));
  $("library-close").focus({ preventScroll: true });
}
export function closeLibrary() {
  $("library").classList.remove("in");
  setTimeout(() => { $("library").hidden = true; }, reducedMotion ? 0 : 280);
  document.body.style.overflow = "";
  libraryFrom?.focus?.({ preventScroll: true });
}
$("library-open").addEventListener("click", openLibrary);
$("library-close").addEventListener("click", closeLibrary);
$("library").addEventListener("click", (e) => { if (e.target === $("library")) closeLibrary(); });

// ---- top shelf quick actions ----
export function closeOverlays() {
  if (!$("reader").hidden) closeBook();
  if (!$("library").hidden) closeLibrary();
  if ($("turntable").classList.contains("open")) closeTurntable();
}
$("ts-home").addEventListener("click", () => { closeOverlays(); showBoard(false); showKitchen(false); showDesk(false); window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }); });

// ---- Focus: the "At home / At work" sign on the top shelf ----
// At work only work things are on screen (see focus in lib.js). Remembered between visits.
export function applyFocus() {
  const sign = $("ts-focus");
  // a switch: on = at work (its label stays "At work"; the tip says what that means)
  sign.setAttribute("aria-checked", String(focus.on));
  sign.dataset.tip = focus.on ? "At work: only work things show (⌃F)" : "At home: everything shows (⌃F for work)";
  $("app").classList.toggle("focus", focus.on);
}
export function setFocus(on) {
  if (on === focus.on) return;
  focus.on = on;
  store("room-focus", on ? "work" : "home");
  if (on && activeBook && hiddenInFocus(activeBook)) closeBook();
  if (on && !$("library").hidden) renderLibrary();
  if (on && !$("ts-panel").hidden) toggleEarnings(false);
  if (on) document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  applyFocus();
  applyScreen(false);
  applyRemote();
  renderAll();
}
$("ts-focus").addEventListener("click", () => setFocus(!focus.on));
const typing = (t) => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || "");
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f" && !typing(e.target)) { e.preventDefault(); setFocus(!focus.on); }
});
applyFocus();

// ---------- record player and music controls (the Music app on this Mac) ----------

// Mel's Canva images (set either to null to fall back to the drawn version)
export const RECORD_ART = { shelf: "assets/obj/record-player.png", top: "assets/obj/record-player-top.png" };
export let music = { available: false };
export let placed = null; // the record on the platter

export const PLAY_ICON = "M7 4l13 8-13 8z";
export const PAUSE_ICON = "M7 4h4v16H7zM14 4h4v16h-4z";

export function renderRecordPlayer() {
  const btn = $("record-player");
  btn.replaceChildren(RECORD_ART.shelf
    ? h("img", { src: RECORD_ART.shelf, alt: "" })
    : h("span", { className: "rp-draw", ariaHidden: "true" }, h("span", { className: "rp-lid" }), h("span", { className: "rp-top" }, h("i")), h("span", { className: "rp-box" }, h("b"), h("b"))));
  if (RECORD_ART.top) {
    $("deck").style.setProperty("--deck-art", `url("${RECORD_ART.top}")`);
    $("deck").classList.add("art");
  }
}

export function renderMusic() {
  const playing = music.state === "playing";
  const active = playing || music.state === "paused";
  $("now-playing").hidden = !music.available;
  $("now-playing").classList.toggle("playing", playing);
  $("app").dataset.music = playing ? "playing" : ""; // the canary bobs along
  $("np-track").textContent = active && music.track ? music.track : "Music";
  $("np-artist").textContent = music.state === "unknown"
    ? "Allow Hanua to control Music"
    : active ? [music.artist, music.playlist].filter(Boolean).join(" · ") : "Pick a record, or press play";
  // the strip keeps one width, so a long title ends in …; the whole thing shows on hover
  $("now-playing").querySelector(".np-text").title = `${$("np-track").textContent} — ${$("np-artist").textContent}`;
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

export async function refreshMusic() {
  try { music = await api("/api/music"); } catch { music = { available: false }; }
  renderMusic();
}

export async function musicDo(action) {
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

export function setVinyl(r) {
  $("vinyl").style.setProperty("--lc", r.color || "#C4602A");
  $("vinyl-label").textContent = r.name;
  $("deck").classList.add("loaded");
}

export function renderCrate() {
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

export const embedUrl = (url) => url.replace("://music.apple.com/", "://embed.music.apple.com/");

export async function playRecord(r) {
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
export function openTurntable() {
  renderCrate();
  $("turntable").classList.add("open");
  $("turntable").setAttribute("aria-hidden", "false");
  $("turntable").inert = false;
  $("turntable-close").focus({ preventScroll: true });
}
export function closeTurntable() {
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

const askInput = $("ask-input"), answer = $("ask-answer");
const askShow = () => { $("ask-clear").hidden = !askInput.value && answer.hidden; };
function askSay(kind, text) {
  answer.hidden = false; answer.className = `answer ${kind}`.trim(); $("ask-text").textContent = text; askShow();
}
async function askNow() {
  const question = askInput.value.trim();
  if (!question) return;
  askSay("loading", "Claude is reading your wall…");
  try {
    const res = await api("/api/ask", { question });
    askSay("", res.answer);
  } catch (err) {
    askSay("error", err.message);
  }
}
$("ask-form").addEventListener("submit", (e) => { e.preventDefault(); askNow(); });
// clear: the ✕ in the field (or Esc) empties the question and puts the answer away; the answer's own ✕ just closes it
function askClear() { stopListening(); askInput.value = ""; answer.hidden = true; askShow(); askInput.focus(); }
$("ask-clear").addEventListener("click", askClear);
$("ask-close").addEventListener("click", () => { answer.hidden = true; askShow(); askInput.focus(); });
askInput.addEventListener("input", askShow);
askInput.addEventListener("keydown", (e) => { if (e.key === "Escape" && (askInput.value || !answer.hidden)) { e.preventDefault(); askClear(); } });

// speak a question: the browser's own speech-to-text (Safari sends it to Apple, like Mac Dictation). Asks when you stop talking
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
let listener = null;
function stopListening() { listener?.stop(); }
if (Speech) {
  const mic = $("ask-mic");
  mic.hidden = false;
  mic.addEventListener("click", () => {
    if (listener) return stopListening();
    const rec = new Speech();
    rec.lang = navigator.language || "en-NZ"; rec.interimResults = true; rec.continuous = false;
    let heard = "";
    rec.onresult = (e) => { heard = [...e.results].map((r) => r[0].transcript).join(""); askInput.value = heard; askShow(); };
    rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Hanua needs the microphone: allow it in Safari's settings for this site."); };
    rec.onend = () => {
      listener = null; mic.classList.remove("on"); mic.setAttribute("aria-pressed", "false"); mic.dataset.tip = "Speak";
      if (heard.trim()) askNow();
    };
    listener = rec;
    mic.classList.add("on"); mic.setAttribute("aria-pressed", "true"); mic.dataset.tip = "Listening… click to stop";
    rec.start();
  });
}

// ---------- feed ----------

export let pendingDraft = null;

// Hanua spotlight: ⌘S (or Ctrl+S) from anywhere opens the Feed.
export function openSpotlight(prefill) {
  if (prefill != null) $("feed-input").value = prefill;
  if (!$("spotlight").open) $("spotlight").showModal();
  const input = $("feed-input");
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (!document.querySelector("dialog[open]:not(#spotlight)")) openSpotlight();
  }
});
$("spotlight").addEventListener("click", (e) => { if (e.target === $("spotlight")) $("spotlight").close(); });

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
    $("spotlight").close();
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

// ISO week number (weeks start Monday; week 1 holds the year's first Thursday)
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
};
// Southern Hemisphere seasons (Aotearoa and Sydney)
const season = (d) => ["SUMMER", "AUTUMN", "WINTER", "SPRING"][Math.floor(((d.getMonth() + 1) % 12) / 3)];

// The greeting: a different language every 10 seconds, the words fading into each other; ", Mel." never moves.
// Every greeting for the hour sits in the same spot (CSS grid) as wide as the longest, each lined up to end at the
// comma, so only the words change: long ones reach back towards the lamp, short ones sit by the name.
let greetWhen = "", greetIndex = 0;
function renderGreeting(hour) {
  const when = timeOfDay(hour);
  const english = greetingsAt(hour)[0].text;
  $("greet").ariaLabel = `${english}, ${GREET_NAME}.`;
  if (when === greetWhen) return;
  greetWhen = when;
  const list = greetingsAt(hour);
  greetIndex %= list.length;
  $("greet-word").ariaHidden = "true";
  $("greet-word").replaceChildren(...list.map((g, i) => h("span", { lang: g.lang, title: g.name, textContent: g.text, className: i === greetIndex ? "on" : "" })));
  fitGreeting();
}
function nextGreeting() {
  const words = $("greet-word").children;
  if (words.length < 2 || document.visibilityState !== "visible") return;
  words[greetIndex].classList.remove("on");
  greetIndex = (greetIndex + 1) % words.length;
  words[greetIndex].classList.add("on");
}
// keep the line on one row: if the longest greeting is too wide for the gap, the whole line gets a little smaller
// the line is sized so the longest greeting and ", Mel." fit the gap with a little room to spare
function fitGreeting() {
  const h1 = $("greet");
  h1.style.fontSize = "";
  if (getComputedStyle(h1).whiteSpace !== "nowrap") return;
  const box = h1.parentElement, pad = getComputedStyle(box);
  const room = (box.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)) * 0.94, need = h1.scrollWidth;
  if (need > room && room > 0) h1.style.fontSize = `${parseFloat(getComputedStyle(h1).fontSize) * (room / need)}px`;
}
setInterval(nextGreeting, GREET_EVERY_MS);
addEventListener("resize", fitGreeting);

// The words round the lamp go slowly round its dome like a ticker: they rise from behind the lamp on the right, cross
// over the top (readable, never upside down) and sink behind it on the left; near the horizon they soften (two copies of
// the text: a sharp one masked to the top, a blurred one masked to the band by the horizon). Still with reduced motion.
const RING_LOOPS = 4, RING_SPEED = 55; // viewBox units a second: about 11 px a second on screen
let ringC = 0, ringLen = 0, ringOff = 0, ringLast = 0, ringWords = "";
function setRingWords(text) {
  const words = `${text} · `;
  if (words === ringWords) return;
  ringWords = words;
  const ring = $("dome-ring");
  if (!ringC) {
    ring.setAttribute("d", `M -40 236 ${"A 282 270 0 0 1 524 236 A 282 270 0 0 1 -40 236 ".repeat(RING_LOOPS)}`);
    ringC = ring.getTotalLength() / RING_LOOPS;
  }
  document.querySelectorAll(".ring-words").forEach((t) => { t.textContent = words; });
  ringLen = $("arc-date").parentNode.getComputedTextLength?.() || words.length * 33;
  // start (and, with reduced motion, stay) with the words centred over the top of the dome
  ringOff = ringC + (((ringC * 0.25 - ringLen / 2) % ringC) + ringC) % ringC;
  placeRing();
}
function placeRing() { document.querySelectorAll(".ring-words").forEach((t) => t.setAttribute("startOffset", ringOff)); }
function turnRing(now) {
  requestAnimationFrame(turnRing);
  const dt = Math.min(0.1, (now - (ringLast || now)) / 1000);
  ringLast = now;
  if (!ringC || reducedMotion || $("wall-in").inert) return;
  ringOff -= RING_SPEED * dt;
  if (ringOff < ringC) ringOff += ringC;
  placeRing();
}
requestAnimationFrame(turnRing);
document.addEventListener("hanua:weather", () => renderHeader());

export function renderHeader() {
  const now = new Date();
  const hr = now.getHours();
  renderGreeting(hr);
  $("today-label").textContent = longDate(now);
  // the clock shows the day and date, so the curve over the lamp shows the week of the year and the season
  setRingWords([`WEEK ${isoWeek(now)}`, season(now), weatherLine()].filter(Boolean).join(" · "));
  const { notion, claude } = state.status;
  const live = state.areas.filter((a) => a.live).length;
  $("status").replaceChildren(
    h("span", { className: `pill${notion && live ? " on" : ""}`, textContent: notion ? `Notion ${live}/${state.areas.length}` : "Notion · sample" }),
    h("span", { className: `pill${state.money?.live ? " on" : ""}`, textContent: state.money?.live ? "Pūtea live" : "Pūtea · sample" }),
    h("span", { className: `pill${claude ? " on" : ""}`, textContent: claude ? "Claude on" : "Claude off" }),
  );
}

export function renderAll() {
  renderHeader();
  renderShelf();
  renderMoneyScreen();
  renderCalendar();
  renderNotes();
  renderTodo();
  renderAgenda();
  renderStickies();
  renderTopShelf();
  renderWhiteboard();
  renderMealSlip();
  if (onBoard) renderBoard();
}

export async function load() {
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
autoLights();
renderClock();
renderRecordPlayer();
refreshMusic();
// keep the song name current (only while Hanua's tab is showing)
setInterval(() => { if (document.visibilityState === "visible") refreshMusic(); }, 5000);
renderMoneyScreen();
load();
loadPlant();
loadDesk();
loadStickies();
loadWhiteboard();
setInterval(renderClock, 1000);
// keep the "now" line, greeting and today's date current
setInterval(() => { renderHeader(); renderAgenda(); autoLights(); }, 60_000);
