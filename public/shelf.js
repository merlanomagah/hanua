// ---------- coins, goal jars and the treat shop ----------
// Coins are worked out from finished goals (by level, never by guessed size) minus what you've bought.
import { dayOf, todayStr, ymd } from "./shared/dates.js";
import { isGoalDone, levelIndex } from "./shared/goals.js";
import { $, api, fmtDay, h, money, state, toast } from "./lib.js";
import { goalById, lineage, onBoard } from "./goals/board.js";
import { mondayOf, sundayOf } from "./goals/review.js";

export const coinsFor = (g) => state.shop.coinsPerLevel?.[g.level] || 0;
export const toDollars = (coins) => coins / (state.shop.coinsPerDollar || 10);
export const dollars = (coins) => money(toDollars(coins), toDollars(coins) % 1 ? 2 : 0);
export const coinText = (g) => (coinsFor(g) ? ` +${coinsFor(g)} coins (${dollars(coinsFor(g))}) in the treat fund.` : "");

// Earned = finished in the period. Planned = everything due in the period (done or not) plus anything
// finished in it: the dollar value you set yourself up to earn.
export function periodStarts() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  return {
    today: [todayStr(), todayStr()],
    week: [ymd(mondayOf(now)), ymd(sundayOf(now))],
    month: [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))],
    quarter: [ymd(new Date(y, Math.floor(m / 3) * 3, 1)), ymd(new Date(y, Math.floor(m / 3) * 3 + 3, 0))],
    year: [`${y}-01-01`, `${y}-12-31`],
  };
}
export function coinTotals() {
  const goals = state.goals.goals;
  const inRange = (d, [a, b]) => d && dayOf(d) >= a && dayOf(d) <= b;
  const out = {};
  for (const [key, range] of Object.entries(periodStarts())) {
    const earned = goals.filter((g) => isGoalDone(g) && inRange(g.completed, range));
    const planned = goals.filter((g) => inRange(g.due, range) || (isGoalDone(g) && inRange(g.completed, range)));
    out[key] = earned.reduce((n, g) => n + coinsFor(g), 0);
    out[`${key}Target`] = planned.reduce((n, g) => n + coinsFor(g), 0);
  }
  const all = goals.filter((g) => isGoalDone(g) && g.completed).reduce((n, g) => n + coinsFor(g), 0);
  const items = state.shop.items || [];
  const spent = items.filter((i) => i.type === "Bought").reduce((n, i) => n + (Number(i.coins) || 0), 0);
  const moved = items.filter((i) => i.type === "Moved").reduce((n, i) => n + (Number(i.dollars) || 0), 0);
  return { ...out, all, spent, balance: all - spent, owed: Math.max(0, Math.round((toDollars(all) - moved) * 100) / 100) };
}

// An Epic's target is everything under it plus itself; earned is the part that's done.
export function epicValue(e) {
  const ids = lineage(e.id);
  const tree = state.goals.goals.filter((g) => ids.has(g.id) && (g.id === e.id || levelIndex(g.level) > levelIndex(e.level)));
  return { target: tree.reduce((n, g) => n + coinsFor(g), 0), earned: tree.filter(isGoalDone).reduce((n, g) => n + coinsFor(g), 0) };
}

// The Epic a goal belongs to, by walking up its parents.
export function epicOf(g) {
  const seen = new Set();
  while (g && g.level !== "Epic" && g.parent && !seen.has(g.id)) { seen.add(g.id); g = goalById(g.parent); }
  return g?.level === "Epic" ? g : null;
}

// Flip-clock style digits for dollar amounts (the shelf and the earnings panel share them).
export const flipDigits = (text, size = "ep") => h("span", { className: `${size}-flaps`, ariaHidden: "true" },
  [...text].map((ch) => h("span", { className: /\d/.test(ch) ? `${size}-flap` : `${size}-sym`, textContent: ch })));

// The top shelf: what you've earned today, this week and this month, with what you planned for.
export function renderTopShelf() {
  const box = $("ts-periods");
  if (!box) return;
  const t = coinTotals();
  box.replaceChildren(...[["Today", "today"], ["This week", "week"], ["This month", "month"]].map(([label, k]) =>
    h("span", { className: "ts-period" },
      h("span", { className: "ts-label", textContent: label }),
      h("b", { className: "ts-value", ariaLabel: dollars(t[k]) }, flipDigits(dollars(t[k]), "ts")),
      h("span", { className: "ts-target", textContent: t[`${k}Target`] ? `of ${dollars(t[`${k}Target`])}` : "nothing planned" }))));
  $("ts-earn").title = `${dollars(t.balance)} to spend · open the treat shop`;
  $("ts-goals").classList.toggle("on", onBoard);
  if (!$("ts-panel").hidden) renderEarnings();
}

// ---- the earnings panel: a digital readout dropping down from the shelf ----
export function toggleEarnings(show = $("ts-panel").hidden) {
  $("ts-panel").hidden = !show;
  $("ts-toggle").setAttribute("aria-expanded", String(show));
  $("ts-toggle").classList.toggle("open", show);
  if (show) renderEarnings();
}
export const ring = (earned, target, label) => {
  const pct = target ? Math.min(1, earned / target) : 0;
  const c = 2 * Math.PI * 26;
  return h("div", { className: "ep-ring" },
    Object.assign(document.createElement("div"), { className: "ep-ring-svg", innerHTML:
      `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="track"/><circle cx="32" cy="32" r="26" class="fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>` }),
    h("b", { textContent: dollars(earned) }),
    h("span", { textContent: label }),
    h("i", { textContent: target ? `of ${dollars(target)} · ${Math.round(pct * 100)}%` : "nothing planned" }));
};
export function renderEarnings() {
  const t = coinTotals();
  const goals = state.goals.goals;
  // last 8 weeks of earnings, oldest first
  const monday = mondayOf(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (7 - i) * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const coins = goals.filter((g) => isGoalDone(g) && g.completed && dayOf(g.completed) >= ymd(start) && dayOf(g.completed) <= ymd(end)).reduce((n, g) => n + coinsFor(g), 0);
    return { start, coins };
  });
  const max = Math.max(1, ...weeks.map((w) => w.coins));
  const flaps = (text) => flipDigits(text, "ep");
  const epics = goals.filter((g) => g.level === "Epic" && !isGoalDone(g));
  const open = h("button", { type: "button", className: "ep-btn", textContent: "Open the treat shop" });
  open.addEventListener("click", () => { toggleEarnings(false); openShop(); });
  $("ts-panel").replaceChildren(
    h("div", { className: "ep-top" },
      h("div", {}, h("span", { className: "ep-label", textContent: "To spend" }), flaps(dollars(t.balance)), h("span", { className: "ep-sub", textContent: `${t.balance.toLocaleString()} coins` })),
      h("div", {}, h("span", { className: "ep-label", textContent: "Earned this year" }), flaps(dollars(t.year)), h("span", { className: "ep-sub", textContent: `of ${dollars(t.yearTarget)} planned` })),
      t.owed > 0 ? h("div", { className: "ep-owed" }, h("span", { className: "ep-label", textContent: "Treat account top-up" }), h("b", { textContent: money(t.owed, t.owed % 1 ? 2 : 0) })) : null),
    h("div", { className: "ep-rings" }, ring(t.today, t.todayTarget, "Today"), ring(t.week, t.weekTarget, "This week"), ring(t.month, t.monthTarget, "This month")),
    h("div", { className: "ep-chart" },
      h("span", { className: "ep-label", textContent: "Last 8 weeks" }),
      h("div", { className: "ep-bars" }, weeks.map((w, i) => h("div", { className: `ep-bar${i === 7 ? " now" : ""}`, title: `Week of ${fmtDay(ymd(w.start), { day: "numeric", month: "short" })}: ${dollars(w.coins)}` },
        h("span", { className: "ep-bar-v", textContent: w.coins ? dollars(w.coins) : "" }),
        Object.assign(h("i"), { style: `height:${(w.coins / max) * 100}%` }),
        h("span", { className: "ep-bar-l", textContent: i === 7 ? "now" : fmtDay(ymd(w.start), { day: "numeric", month: "numeric" }) }))))),
    epics.length ? h("div", { className: "ep-epics" }, h("span", { className: "ep-label", textContent: "Epics: earned of target" }),
      epics.map((e) => { const v = epicValue(e); return h("div", { className: "ep-epic" },
        h("span", { textContent: e.title }),
        h("span", { className: "ep-track" }, Object.assign(h("i"), { style: `width:${v.target ? (v.earned / v.target) * 100 : 0}%` })),
        h("b", { textContent: `${dollars(v.earned)} / ${dollars(v.target)}` })); })) : null,
    h("div", { className: "ep-foot" }, h("span", { textContent: `Task ${state.shop.coinsPerLevel.Task} · PBI ${state.shop.coinsPerLevel.PBI} · Feature ${state.shop.coinsPerLevel.Feature} · Epic ${state.shop.coinsPerLevel.Epic.toLocaleString()} coins · ${state.shop.coinsPerDollar} coins = $1` }), open),
  );
}
$("ts-toggle").addEventListener("click", () => toggleEarnings());
document.addEventListener("click", (e) => {
  if (!$("ts-panel").hidden && !e.target.closest("#ts-panel, #ts-toggle")) toggleEarnings(false);
});

// ---- the shop ----
export let confirmBuy = null;
export function openShop() {
  confirmBuy = null;
  renderShop();
  $("shop-dialog").showModal();
}
export function renderShop() {
  const t = coinTotals();
  const shop = state.shop;
  $("shop-title").textContent = `${dollars(t.balance)} to spend`;
  $("shop-sub").textContent = `${t.balance.toLocaleString()} coins · earned by finishing goals${shop.live ? "" : " (sample data)"}`;
  $("shop-periods").replaceChildren(...[["This week", "week"], ["This month", "month"], ["This quarter", "quarter"], ["This year", "year"]].map(([l, k]) =>
    h("div", { className: "shop-period" }, h("b", { textContent: dollars(t[k]) }), h("span", { textContent: l }), h("i", { textContent: `of ${dollars(t[`${k}Target`])} planned` }))));
  // each open Epic: what it's worth in total, and how much of that is already earned
  const epics = state.goals.goals.filter((g) => g.level === "Epic" && !isGoalDone(g));
  $("shop-epics-h").hidden = !epics.length;
  $("shop-epics").replaceChildren(...epics.map((e) => {
    const v = epicValue(e);
    return h("li", { className: "shop-item" },
      h("span", { className: "si-name", textContent: e.title }),
      h("span", { className: "si-price", textContent: `${dollars(v.earned)} of ${dollars(v.target)} earned` }),
      h("span", { className: "si-bar" }, Object.assign(h("i"), { style: `width:${v.target ? (v.earned / v.target) * 100 : 0}%` })));
  }));
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
export async function shopWrite(values, okText) {
  try {
    const res = await api("/api/shop", { values });
    if (res.live) state.shop = { ...state.shop, ...(await api("/api/shop")) };
    else state.shop.items = [...state.shop.items, { id: `local-${Date.now()}`, date: todayStr(), ...values }];
    toast(res.live ? okText : `${okText} (sample data, not saved)`);
    renderShop();
    renderTopShelf();
  } catch (err) { toast(err.message, true); }
}
$("shop-close").addEventListener("click", () => $("shop-dialog").close());
$("ts-earn").addEventListener("click", openShop);
