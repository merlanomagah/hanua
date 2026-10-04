// The week's menu (public/shared/menu.js): the saved shape and the eating-well tips.
import { test } from "node:test";
import assert from "node:assert/strict";
import { menuShape, menuTips, dailyTip, DAILY_TIPS, DAYS, MEALS } from "../public/shared/menu.js";

const menu = (cells) => {
  const m = menuShape({});
  for (const [day, meal, text] of cells) m[day][meal] = text;
  return m;
};

test("only the 21 boxes are kept, trimmed and capped", () => {
  const m = menuShape({ mon: { Breakfast: "  Porridge   with  fruit ", Snack: "x" }, evil: { Dinner: "y" }, tue: { Lunch: 5 } });
  assert.deepEqual(Object.keys(m), DAYS);
  assert.deepEqual(Object.keys(m.mon), MEALS);
  assert.equal(m.mon.Breakfast, "Porridge with fruit");
  assert.equal(m.tue.Lunch, "");
  assert.equal(menuShape({ wed: { Dinner: "a".repeat(500) } }).wed.Dinner.length, 120);
  assert.equal(menuShape(null).sun.Dinner, "");
});

test("tips stay quiet until a few meals are typed", () => {
  assert.equal(menuTips(menu([["mon", "Dinner", "Salmon"]])).ready, false);
  assert.equal(menuTips(menuShape({})).ready, false);
});

test("habits already there show as wins, missing ones as at most two ideas", () => {
  const t = menuTips(menu([["mon", "Breakfast", "Porridge"], ["mon", "Dinner", "Baked SALMON and greens"], ["tue", "Dinner", "Chicken wraps"]]));
  assert.equal(t.ready, true);
  assert.ok(t.wins.some((w) => w.id === "fish" && /Mon dinner/.test(w.text)));
  assert.ok(t.wins.some((w) => w.id === "wholegrain"));
  assert.ok(!t.ideas.some((i) => i.id === "fish"));
  assert.ok(t.ideas.length <= 2);
});

test("leftovers only count at lunch", () => {
  const atDinner = menuTips(menu([["mon", "Dinner", "Leftovers"], ["tue", "Dinner", "Soup"], ["wed", "Dinner", "Tacos"]]), { max: 9 });
  assert.ok(atDinner.ideas.some((i) => i.id === "leftovers"));
  const atLunch = menuTips(menu([["mon", "Lunch", "leftover curry"], ["tue", "Dinner", "Soup"], ["wed", "Dinner", "Tacos"]]));
  assert.ok(atLunch.wins.some((w) => w.id === "leftovers"));
});

test("a red-meat note only past three meals", () => {
  const three = menu([["mon", "Dinner", "Steak"], ["tue", "Dinner", "Lamb"], ["wed", "Dinner", "Beef mince"]]);
  assert.equal(menuTips(three).note, null);
  three.thu.Dinner = "Sausages";
  assert.equal(menuTips(three).note.id, "red-meat");
});

test("a different tip each day, the same all day, every tip before a repeat", () => {
  assert.equal(dailyTip("2026-10-05"), dailyTip("2026-10-05"));
  assert.notEqual(dailyTip("2026-10-05"), dailyTip("2026-10-06"));
  const days = Array.from({ length: DAILY_TIPS.length }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10));
  assert.equal(new Set(days.map(dailyTip)).size, DAILY_TIPS.length);
  for (const t of DAILY_TIPS) assert.ok(t.icon && t.text && t.source);
});
