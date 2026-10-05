// The Money book and TV read Pūtea's local API. These replies are shaped like
// Pūtea's own (src/main/services/finance.ts: getMonthData, listTransactions, getSubscriptions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { label, shapeMonth, shapeSubscriptions, shapeThisPay, shapeToday, shapeSavings, isMonthKey, getMoney } from "../server/money.js";

const month = {
  income: 3240, expenses: 1868.4, net: 1371.6, prevIncome: 3000, prevExpenses: 2410.75,
  categoryBreakdown: [{ category: "Housing", count: 2, total: 1450 }, { category: "Groceries", count: 5, total: 212.4 }],
  topMerchants: [{ name: "Rent", total: 1450, count: 2 }, { name: null, total: 9, count: 1 }, { name: "Countdown", total: 148.2, count: 4 }],
  biggestTx: { other_party: "Rent", amount: 725, date: "2026-10-01T00:00:00", category: "Housing" },
};
const tx = (o) => ({ is_transfer: 0, category: "Groceries", description: "POS W/D COUNTDOWN-4471", ...o });
const transactions = [
  tx({ date: "2026-10-04", amount: -64.2, other_party: "Countdown" }),
  tx({ date: "2026-10-03", amount: -12, other_party: null }),
  tx({ date: "2026-10-02", amount: 2980, other_party: "Employer Ltd", category: "Income" }),
  tx({ date: "2026-10-02", amount: -500, other_party: "Savings", category: "Transfer", is_transfer: 1 }),
];

test("a payment is named by Pūtea's payee, not the bank's raw line", () => {
  assert.equal(label({ other_party: "Countdown", description: "POS W/D COUNTDOWN-4471" }), "Countdown");
  assert.equal(label({ other_party: "", description: "POS W/D COUNTDOWN-4471" }), "POS W/D COUNTDOWN-4471");
  assert.equal(label({ category: "Groceries" }), "Groceries");
});

test("a month keeps Pūtea's totals and leaves transfers out", () => {
  const m = shapeMonth("2026-10", month, transactions);
  assert.equal(m.income, 3240);
  assert.equal(m.net, 1371.6);
  assert.equal(m.prevIncome, 3000);
  assert.equal(m.expenseCount, 2);
  assert.deepEqual(m.recentExpenses.map((t) => t.name), ["Countdown", "POS W/D COUNTDOWN-4471"]);
  assert.deepEqual(m.incomes.map((t) => t.name), ["Employer Ltd"]);
  assert.deepEqual(m.places.map((p) => p.name), ["Rent", "Countdown"]);
  assert.deepEqual(m.biggest, { name: "Rent", amount: 725, date: "2026-10-01", category: "Housing" });
});

test("a month with nothing in it still has a shape", () => {
  const m = shapeMonth("2026-01", { income: 0, expenses: 0 }, []);
  assert.deepEqual([m.net, m.categories.length, m.places.length, m.biggest], [0, 0, 0, null]);
});

test("subscriptions: active ones, biggest first", () => {
  const s = shapeSubscriptions([
    { name: "iCloud+", monthlyAmount: 16.99, frequency: "Monthly", lastCharge: "2026-10-02", isLikelyInactive: false },
    { name: "Old gym", monthlyAmount: 60, frequency: "Monthly", lastCharge: "2026-03-01", isLikelyInactive: true },
    { name: "Anthropic", monthlyAmount: 36, frequency: "Monthly", lastCharge: "2026-10-01", isLikelyInactive: false },
  ]);
  assert.deepEqual(s.map((x) => x.name), ["Anthropic", "iCloud+"]);
});

test("month names are checked", () => {
  assert.ok(isMonthKey("2026-10"));
  assert.ok(!isMonthKey("2026-13"));
  assert.ok(!isMonthKey("../etc"));
});

test("with Pūtea closed, the room gets sample money and is told why", async () => {
  const before = process.env.PUTEA_URL;
  process.env.PUTEA_URL = "http://127.0.0.1:1";
  try {
    const m = await getMoney(new Date(2026, 9, 6));
    assert.equal(m.live, false);
    assert.equal(m.reason, "closed");
    assert.equal(m.week.days.length, 7);
    assert.ok(m.month.categories.length > 0);
  } finally {
    if (before === undefined) delete process.env.PUTEA_URL; else process.env.PUTEA_URL = before;
  }
});

// Shaped like Pūtea's GET /api/this-pay (src/main/services/probes.ts getThisPay)
test("this pay keeps Pūtea's figures and trims to what one screen shows", () => {
  const p = shapeThisPay({
    hasPlan: true, practice: true,
    cycle: { start: "2026-09-23", end: "2026-10-06", day: 13, days: 14, daysLeft: 2, nextPayday: "2026-10-07" },
    safeToSpend: { pay: 0, perDay: 0, week: 0, weekNumber: 2 },
    groups: [{ key: "essentials", spent: 2108, target: 2068, status: "mindful" }, { key: "flexible", spent: 462.4, target: 346.15, status: "over" }],
    debts: { owed: 21296.32, dueThisPay: [1, 2, 3, 4, 5].map((i) => ({ name: `Debt ${i}`, date: "2026-10-0" + i, amount: 50.86, status: "due" })) },
    payday: [{ label: "To Expenses", amount: 415, status: "landed" }],
  });
  assert.equal(p.day, 13);
  assert.equal(p.nextPayday, "2026-10-07");
  assert.deepEqual(p.safe, { pay: 0, perDay: 0 });
  assert.deepEqual(p.flexible, { spent: 462.4, target: 346.15, status: "over" });
  assert.equal(p.owed, 21296.32);
  assert.equal(p.dues.length, 4); // one screen: the next four
  assert.equal(p.dues[0].amount, 50.86);
  assert.deepEqual(p.moves, [{ label: "To Expenses", amount: 415, status: "landed" }]);
});

test("an older Pūtea without plans gives no This pay rather than made-up figures", () => {
  assert.equal(shapeThisPay(null), null);
  assert.equal(shapeThisPay({}), null);
});

test("today's spend comes from Pūtea's habits: today's day only", () => {
  const habits = { mindful: { days: [
    { date: "2026-10-04", weekday: "Sunday", typical: 33.22, spent: 0, today: false },
    { date: "2026-10-05", weekday: "Monday", typical: 10.5607, spent: 40, today: true, mindful: false },
  ] } };
  assert.deepEqual(shapeToday(habits), { date: "2026-10-05", weekday: "Monday", spent: 40, usual: 10.56, mindful: false, payday: false });
  assert.equal(shapeToday(null), null);
  assert.equal(shapeToday({ mindful: { days: [] } }), null);
});

test("savings goals: soonest date first, then undated, then past, then finished; balance beats current_amount", () => {
  const list = [
    { id: 2, name: "Emergency fund", target_amount: 18000, current_amount: 0, account_balance: 1301.5, target_date: null },
    { id: 6, name: "Belgium Trip", target_amount: 6000, current_amount: 0, target_date: "2026-08-01" },
    { id: 3, name: "Move to Sydney", target_amount: 3500, current_amount: 0, target_date: "2026-12-31" },
    { id: 5, name: "Queenstown Marathon", target_amount: 1000, current_amount: 300, target_date: "2026-11-13" },
    { id: 7, name: "Done one", target_amount: 100, current_amount: 100, target_date: "2026-10-30" },
  ];
  const out = shapeSavings(list, "2026-10-05");
  assert.deepEqual(out.map((g) => g.id), [5, 3, 2, 6, 7]);
  assert.equal(out.find((g) => g.id === 2).saved, 1301.5);
  assert.equal(out.at(-1).done, true);
  assert.deepEqual(shapeSavings(null), []);
});
