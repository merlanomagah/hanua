// Reads spending from Pūtea's read-only local API (it syncs your Akahu
// accounts). Falls back to sample figures when Pūtea isn't running.
const PUTEA_URL = () => process.env.PUTEA_URL || "http://127.0.0.1:3456";

const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymd = (d) => `${ym(d)}-${String(d.getDate()).padStart(2, "0")}`;
const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

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
const label = (t) => t.description || t.merchant || t.payee || t.name || t.category || "Transaction";
const round2 = (n) => Math.round(n * 100) / 100;
// The TV's Expenses and Income channels: newest first, a handful each.
const line = (t) => ({ date: t.date.slice(0, 10), name: label(t), category: t.category || "", amount: round2(Math.abs(t.amount)) });
const newest = (list, n) => [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n).map(line);

// Last 7 days, today included, oldest first.
function lastWeek(now) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
    return ymd(d);
  });
}

export async function getMoney(now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  try {
    const [month, cur, before] = await Promise.all([
      putea(`/api/finance/month/${ym(now)}`),
      putea(txPath(ym(now))),
      putea(txPath(ym(prev))),
    ]);
    const spend = [...cur.transactions, ...before.transactions].filter(isSpend);
    const monthSpend = cur.transactions.filter(isSpend);
    const monthIncome = cur.transactions.filter(isIncome);
    const days = lastWeek(now).map((date) => ({
      date,
      spent: Math.round(spend.filter((t) => t.date.slice(0, 10) === date).reduce((s, t) => s - t.amount, 0) * 100) / 100,
    }));
    return {
      live: true,
      month: {
        ym: ym(now),
        expenses: month.expenses,
        prevExpenses: month.prevExpenses,
        categories: (month.categoryBreakdown || []).slice(0, 5).map((c) => ({ name: c.category, total: c.total })),
        income: typeof month.income === "number" ? month.income : round2(monthIncome.reduce((s, t) => s + t.amount, 0)),
        expenseCount: monthSpend.length,
        recentExpenses: newest(monthSpend, 6),
        incomes: newest(monthIncome, 6),
      },
      week: {
        spent: Math.round(days.reduce((s, d) => s + d.spent, 0) * 100) / 100,
        usual: Math.round((month.prevExpenses / daysIn(prev)) * 7),
        days,
      },
    };
  } catch {
    return sampleMoney(now);
  }
}

function sampleMoney(now) {
  const pattern = [48, 112, 36, 74, 22, 90, 30];
  const week = lastWeek(now);
  const days = week.map((date, i) => ({ date, spent: pattern[i] }));
  const day = (n) => ymd(new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - n)));
  return {
    live: false,
    month: {
      ym: ym(now),
      expenses: 1868.4,
      prevExpenses: 2410.75,
      categories: [
        { name: "Housing", total: 1450 },
        { name: "Food", total: 212.4 },
        { name: "Bills", total: 112 },
        { name: "Transport", total: 58 },
        { name: "Fun", total: 36 },
      ],
      income: 3240,
      expenseCount: 23,
      recentExpenses: [
        { date: day(0), name: "Countdown", category: "Food", amount: 64.2 },
        { date: day(1), name: "Z Energy", category: "Transport", amount: 58 },
        { date: day(1), name: "Little Bird Café", category: "Food", amount: 14.5 },
        { date: day(2), name: "Spark", category: "Bills", amount: 85 },
        { date: day(3), name: "Rent", category: "Housing", amount: 725 },
        { date: day(4), name: "Rialto Cinemas", category: "Fun", amount: 36 },
      ],
      incomes: [
        { date: day(2), name: "Salary", category: "Income", amount: 2980 },
        { date: day(3), name: "Bula Collective sale", category: "Income", amount: 260 },
      ],
    },
    week: { spent: days.reduce((s, d) => s + d.spent, 0), usual: 480, days },
  };
}
