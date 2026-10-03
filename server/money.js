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
  const days = lastWeek(now).map((date, i) => ({ date, spent: pattern[i] }));
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
    },
    week: { spent: days.reduce((s, d) => s + d.spent, 0), usual: 480, days },
  };
}
