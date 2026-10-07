// The room's small rules: the weather window, the wall clocks and the greeting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, dayParts, nowAcross, showsTomorrow, todayLine, summarisePart } from "../public/shared/weather.js";
import { greetingsAt, timeOfDay, GREETINGS } from "../public/shared/greetings.js";
import { timeIn, aheadText } from "../public/shared/dates.js";

test("weather codes sort into what the window can draw", () => {
  assert.equal(kindOf(0), "clear");
  assert.equal(kindOf(2), "partly");
  assert.equal(kindOf(3), "cloudy");
  assert.equal(kindOf(45), "fog");
  assert.equal(kindOf(53), "drizzle");
  assert.equal(kindOf(63), "rain");
  assert.equal(kindOf(81), "showers");
  assert.equal(kindOf(73), "snow");
  assert.equal(kindOf(95), "storm");
});

test("the day splits into morning, midday and evening by the hour", () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, temp: hour, code: hour < 11 ? 0 : hour < 15 ? 3 : 61, rain: hour >= 15 ? 80 : 0, cloud: 0 }));
  const [m, d, e] = dayParts(hours);
  assert.deepEqual([m.id, m.kind, m.temp], ["morning", "clear", 8]); // 6..10
  assert.deepEqual([d.id, d.kind, d.temp], ["midday", "cloudy", 13]); // 11..14
  assert.deepEqual([e.id, e.kind, e.temp, e.rain], ["evening", "rain", 18, 80]); // 15..20
});

test("a tie goes to the wetter weather", () => {
  assert.equal(summarisePart([{ temp: 10, code: 0 }, { temp: 12, code: 61 }]).kind, "rain");
  assert.equal(summarisePart([]), null);
});

test("now sits across the window between 6 am and 9 pm, then the window shows tomorrow", () => {
  assert.equal(nowAcross(5, 59), null);
  assert.equal(nowAcross(6), 0);
  assert.equal(nowAcross(13, 30), 0.5);
  assert.equal(nowAcross(21), null);
  assert.equal(showsTomorrow(20), false);
  assert.equal(showsTomorrow(21), true);
});

test("the lamp's line says the weather, now and the high", () => {
  assert.equal(todayLine({ kind: "partly", max: 19.4 }, 16.6), "⛅ 17° · PARTLY CLOUDY · HIGH 19°");
  assert.equal(todayLine({ kind: "rain", max: 12 }), "🌧️ RAIN · HIGH 12°");
  assert.equal(todayLine(null), "");
});

test("the greeting follows the lights' hours and every language has every time of day", () => {
  assert.equal(timeOfDay(4), "morning");
  assert.equal(timeOfDay(12), "afternoon");
  assert.equal(timeOfDay(18), "evening");
  assert.equal(timeOfDay(21), "night");
  assert.equal(timeOfDay(3), "night");
  for (const g of GREETINGS) for (const k of ["morning", "afternoon", "evening", "night"]) assert.ok(g[k], `${g.name} ${k}`);
  const now = greetingsAt(8);
  assert.equal(now[0].text, "Good morning");
  assert.equal(now.find((g) => g.lang === "mi").text, "Mōrena");
  assert.equal(new Set(GREETINGS.map((g) => g.lang)).size, GREETINGS.length);
});

test("wall clocks: Sydney and Suva against Auckland, across daylight saving", () => {
  // 6 Oct 2026 09:00 in Auckland (NZDT, +13); Sydney is on AEDT (+11), Fiji has no daylight saving (+12)
  const at = new Date("2026-10-05T20:00:00Z");
  const syd = timeIn("Australia/Sydney", at), suva = timeIn("Pacific/Fiji", at);
  assert.deepEqual([syd.hour, syd.minute], [7, 0]);
  assert.deepEqual([suva.hour, suva.minute], [8, 0]);
  const la = timeIn("America/Los_Angeles", at); // PDT, -7: still Monday 5 Oct there
  assert.deepEqual([la.hour, la.weekday, la.day, la.month], [13, "MON", 5, "OCT"]);
  const akl = timeIn("Pacific/Auckland", at);
  assert.equal(syd.ahead - akl.ahead, -2);
  assert.equal(suva.ahead - akl.ahead, -1);
  assert.equal(aheadText(-2), "−2 h");
  assert.equal(aheadText(1), "+1 h");
  assert.equal(aheadText(-3.5), "−3½ h");
  assert.equal(aheadText(0), "same time");
});

test("the plant counts days watered in a row, still alive until today's watering is missed", async () => {
  const { plantState } = await import("../public/shared/plant.js");
  const w = ["2026-10-01", "2026-10-03", "2026-10-04"];
  assert.equal(plantState(w, "2026-10-04").streak, 2);
  assert.equal(plantState(w, "2026-10-05").streak, 2); // not yet watered today: yesterday's run still counts
  assert.equal(plantState(w, "2026-10-06").streak, 0); // a day missed
  assert.equal(plantState([], "2026-10-06").streak, 0);
});

test("greeting: follows Mel's lights hours and leaves out languages she turned off (8 Oct 2026)", () => {
  assert.equal(timeOfDay(21, 22, 6), "evening");
  assert.equal(timeOfDay(22, 22, 6), "night");
  assert.equal(timeOfDay(5, 22, 6), "night");
  assert.equal(timeOfDay(23, 1, 6), "evening"); // off after midnight
  assert.equal(timeOfDay(2, 1, 6), "night");
  const some = greetingsAt(9, { greetOff: ["fr", "de"] });
  assert.equal(some.length, GREETINGS.length - 2);
  assert.ok(!some.some((g) => g.lang === "fr" || g.lang === "de"));
  // all left out: English stays, so there's always a greeting
  assert.deepEqual(greetingsAt(9, { greetOff: GREETINGS.map((g) => g.lang) }).map((g) => g.lang), ["en"]);
});
