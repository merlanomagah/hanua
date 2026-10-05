// Reads spending from Pūtea's read-only local API (it syncs your Akahu
// accounts). Nothing is kept here: every read goes straight to Pūtea.
// Falls back to sample figures when Pūtea isn't open, and says why.
const PUTEA_URL = () => process.env.PUTEA_URL || "http://127.0.0.1:3456";

const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymd = (d) => `${ym(d)}-${String(d.getDate()).padStart(2, "0")}`;
const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const monthDate = (key) => { const [y, m] = key.split("-").map(Number); return new Date(y, m - 1, 1); };
export const isMonthKey = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s));

async function putea(path) {
  const res = await fetch(`${PUTEA_URL()}${path}`, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw new Error(`Pūtea ${res.status}`);
  return res.json();
}

const txPath = (month) =>
  `/api/finance/transactions?f=${encodeURIComponent(JSON.stringify({ month, excludeTransfers: true, limit: 1000 }))}`;

const isSpend = (t) =>
  t.amount < 0 && !t.is_transfer && !/^(income|transfer)/i.test(t.category || "");
const isIncome = (t) => t.amount > 0 && !t.is_transfer && !/^transfer/i.test(t.category || "");
// Pūtea keeps the payee in `other_party` (Akahu's merchant or the other account's name);
// `description` is the bank's raw line ("POS W/D …"), so it's only the fallback.
export const label = (t) => t.other_party || t.description || t.category || "Transaction";
const round2 = (n) => Math.round(n * 100) / 100;
// The TV's Expenses and Income channels and the Money book: newest first, a handful each.
const line = (t) => ({ date: t.date.slice(0, 10), name: label(t), category: t.category || "", amount: round2(Math.abs(t.amount)) });
const newest = (list, n) => [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n).map(line);

// Last 7 days, today included, oldest first.
function lastWeek(now) {
  return Array.from({ length: 7 }, (_, i) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i)));
}

// One month as the room shows it, from Pūtea's month summary and that month's transactions.
export function shapeMonth(key, month, transactions) {
  const spend = transactions.filter(isSpend);
  const income = transactions.filter(isIncome);
  const inTotal = typeof month.income === "number" ? month.income : round2(income.reduce((s, t) => s + t.amount, 0));
  const big = month.biggestTx;
  return {
    ym: key,
    expenses: round2(month.expenses || 0),
    prevExpenses: round2(month.prevExpenses || 0),
    income: round2(inTotal),
    prevIncome: round2(month.prevIncome || 0),
    net: round2(inTotal - (month.expenses || 0)),
    categories: (month.categoryBreakdown || []).slice(0, 8).map((c) => ({ name: c.category || "Other", total: round2(c.total), count: c.count || 0 })),
    places: (month.topMerchants || []).filter((p) => p.name).slice(0, 6).map((p) => ({ name: p.name, total: round2(p.total), count: p.count || 0 })),
    biggest: big ? { name: big.other_party || "One payment", amount: round2(big.amount), date: String(big.date).slice(0, 10), category: big.category || "" } : null,
    expenseCount: spend.length,
    recentExpenses: newest(spend, 8),
    incomes: newest(income, 6),
  };
}

// Pūtea's subscription finder, active ones only, biggest first.
export const shapeSubscriptions = (list) =>
  (list || []).filter((s) => !s.isLikelyInactive).sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 8)
    .map((s) => ({ name: s.name, monthly: round2(s.monthlyAmount), frequency: s.frequency || "", last: String(s.lastCharge || "").slice(0, 10) }));

// The TV's "This pay" channel: Pūtea's GET /api/this-pay (its src/main/services/probes.ts getThisPay),
// trimmed to what one screen can show. Pūtea owns every figure; Hanua keeps nothing.
export function shapeThisPay(p) {
  if (!p || !p.cycle) return null;
  const flex = (p.groups || []).find((g) => g.key === "flexible");
  return {
    hasPlan: !!p.hasPlan,
    practice: !!p.practice,
    day: p.cycle.day, days: p.cycle.days, daysLeft: p.cycle.daysLeft, nextPayday: p.cycle.nextPayday,
    safe: p.safeToSpend ? { pay: round2(p.safeToSpend.pay), perDay: round2(p.safeToSpend.perDay) } : null,
    flexible: flex ? { spent: round2(flex.spent), target: round2(flex.target), status: flex.status } : null,
    owed: p.debts ? round2(p.debts.owed) : null,
    dues: (p.debts?.dueThisPay || []).slice(0, 4).map((d) => ({ name: d.name, date: d.date, amount: round2(d.amount), status: d.status })),
    moves: (p.payday || []).map((m) => ({ label: m.label, amount: round2(m.amount), status: m.status })),
  };
}

async function liveMonth(key) {
  const [month, cur] = await Promise.all([putea(`/api/finance/month/${key}`), putea(txPath(key))]);
  return shapeMonth(key, month, cur.transactions || []);
}

// Why Pūtea couldn't be read, in words for the page.
const why = (err) => (/fetch failed|ECONNREFUSED|abort|timeout/i.test(String(err?.cause?.code || err?.message || err)) ? "closed" : "error");

export async function getMoney(now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  try {
    const [summary, cur, before, subs, sync] = await Promise.all([
      putea(`/api/finance/month/${ym(now)}`),
      putea(txPath(ym(now))),
      putea(txPath(ym(prev))),
      putea("/api/finance/subscriptions").catch(() => []),
      putea("/api/akahu/last-sync").catch(() => ({})),
    ]);
    // Open but not yet connected to the bank: the book says how, instead of showing zeros as if they were real
    const [akahu, accounts, thisPay] = await Promise.all([
      putea("/api/akahu/config").catch(() => ({})),
      putea("/api/finance/accounts").catch(() => []),
      putea("/api/this-pay").catch(() => null), // an older Pūtea has no plan yet: the channel says so
    ]);
    const month = shapeMonth(ym(now), summary, cur.transactions || []);
    const spend = [...(cur.transactions || []), ...(before.transactions || [])].filter(isSpend);
    const days = lastWeek(now).map((date) => ({
      date,
      spent: round2(spend.filter((t) => t.date.slice(0, 10) === date).reduce((s, t) => s - t.amount, 0)),
    }));
    return {
      live: true,
      puteaUrl: PUTEA_URL(),
      lastSync: sync?.lastSync || null,
      setup: { akahu: !!akahu?.configured, accounts: Array.isArray(accounts) ? accounts.length : 0 },
      month,
      subscriptions: shapeSubscriptions(subs),
      thisPay: shapeThisPay(thisPay),
      week: {
        spent: round2(days.reduce((s, d) => s + d.spent, 0)),
        usual: Math.round((month.prevExpenses / daysIn(prev)) * 7),
        days,
      },
    };
  } catch (err) {
    return { ...sampleMoney(now), reason: why(err) };
  }
}

// Another month for the Money book's ‹ › pages.
export async function getMoneyMonth(key, now = new Date()) {
  try {
    return { live: true, month: await liveMonth(key) };
  } catch (err) {
    return { live: false, reason: why(err), month: sampleMonth(key, now) };
  }
}

// ---------- sample figures, shaped like Pūtea's, for the preview and when Pūtea is closed ----------
function sampleMonth(key, now = new Date()) {
  const d = monthDate(key);
  const back = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  const k = [1, 1.29, 0.94, 1.12, 0.87, 1.05][((back % 6) + 6) % 6];
  const thisMonth = back === 0;
  const day = (n) => ymd(new Date(d.getFullYear(), d.getMonth(), thisMonth ? Math.max(1, now.getDate() - n) : Math.max(1, daysIn(d) - n * 3)));
  const cats = [["Housing", 1450], ["Groceries", 212.4], ["Utilities", 112], ["Transport", 58], ["Eating out", 48.5], ["Subscriptions", 41.98], ["Entertainment", 36]];
  const scaled = cats.map(([name, total], i) => ({ name, total: round2(i === 0 ? total : total * k), count: [2, 7, 3, 2, 3, 3, 1][i] }));
  const expenses = round2(scaled.reduce((s, c) => s + c.total, 0));
  const income = back === 0 ? 3240 : 3240 + (back % 2 ? 260 : 0);
  return {
    ym: key,
    expenses,
    prevExpenses: round2(expenses * (back === 0 ? 1.29 : 0.94)),
    income,
    prevIncome: 3240,
    net: round2(income - expenses),
    categories: scaled,
    places: [
      { name: "Rent", total: 1450, count: 2 },
      { name: "Countdown", total: round2(148.2 * k), count: 4 },
      { name: "Contact Energy", total: 112, count: 1 },
      { name: "Z Energy", total: round2(58 * k), count: 2 },
      { name: "Little Bird Café", total: round2(29 * k), count: 2 },
    ],
    biggest: { name: "Rent", amount: 725, date: day(3), category: "Housing" },
    expenseCount: 21,
    recentExpenses: [
      { date: day(0), name: "Countdown", category: "Groceries", amount: 64.2 },
      { date: day(1), name: "Z Energy", category: "Transport", amount: 58 },
      { date: day(1), name: "Little Bird Café", category: "Eating out", amount: 14.5 },
      { date: day(2), name: "Spark", category: "Utilities", amount: 85 },
      { date: day(3), name: "Rent", category: "Housing", amount: 725 },
      { date: day(4), name: "Rialto Cinemas", category: "Entertainment", amount: 36 },
    ],
    incomes: [
      { date: day(2), name: "Salary", category: "Income", amount: 2980 },
      { date: day(3), name: "Bula Collective sale", category: "Income", amount: 260 },
    ],
  };
}

function sampleMoney(now) {
  const pattern = [48, 112, 36, 74, 22, 90, 30];
  const days = lastWeek(now).map((date, i) => ({ date, spent: pattern[i] }));
  return {
    live: false,
    month: sampleMonth(ym(now), now),
    subscriptions: [
      { name: "Apple Music", monthly: 14.08, frequency: "Yearly", last: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 17)) },
      { name: "iCloud+", monthly: 16.99, frequency: "Monthly", last: ymd(new Date(now.getFullYear(), now.getMonth(), 2)) },
      { name: "Disney+", monthly: 12.5, frequency: "Yearly", last: ymd(new Date(now.getFullYear(), now.getMonth() - 4, 9)) },
      { name: "Anthropic", monthly: 36, frequency: "Monthly", last: ymd(new Date(now.getFullYear(), now.getMonth(), 1)) },
    ].sort((a, b) => b.monthly - a.monthly),
    week: { spent: days.reduce((s, d) => s + d.spent, 0), usual: 480, days },
    thisPay: {
      hasPlan: true, practice: false, day: 6, days: 14, daysLeft: 9, nextPayday: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9)),
      safe: { pay: 212, perDay: 23.56 },
      flexible: { spent: 134, target: 346, status: "ok" },
      owed: 8420,
      dues: [
        { name: "Car loan", date: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)), amount: 268.63, status: "due" },
        { name: "Afterpay", date: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5)), amount: 57.5, status: "due" },
      ],
      moves: [{ label: "To Bills", amount: 415, status: "landed" }, { label: "To Emergency Fund", amount: 200, status: "landed" }],
    },
  };
}
