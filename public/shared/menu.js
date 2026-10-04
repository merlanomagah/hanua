// The week's menu and its eating-well tips. Shared so the server stores the same shape the page shows,
// and so the tips' rules are tested. Soft ideas only, never a score: what's typed is matched against a few
// habits from the NZ Eating and Activity Guidelines, the Australian Dietary Guidelines and Harvard's Healthy
// Eating Plate. The longer reasons and sources live in the Notion page "Eating well guide".

export const MEALS = ["Breakfast", "Lunch", "Dinner"];
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX = 120; // characters per box: a meal, not a recipe

// Anything sent or saved -> { mon: { Breakfast: "", Lunch: "", Dinner: "" }, … }, nothing else kept
export function menuShape(input) {
  const src = input && typeof input === "object" ? input : {};
  return Object.fromEntries(DAYS.map((d) => [d, Object.fromEntries(MEALS.map((m) => {
    const v = src[d]?.[m];
    return [m, typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX) : ""];
  }))]));
}

export const filledMeals = (menu) => DAYS.flatMap((d, i) => MEALS.map((m) => ({ day: i, meal: m, text: menu?.[d]?.[m] || "" }))).filter((x) => x.text);

// The plate, shown before anything is typed (and above the ideas once it is)
export const PLATE = [
  { part: "Half", what: "vegetables and fruit, as many colours as you can" },
  { part: "A quarter", what: "protein: fish, chicken, eggs, beans, lentils, tofu, a little red meat" },
  { part: "A quarter", what: "wholegrains: oats, brown rice, wholemeal bread or pasta, quinoa" },
  { part: "To drink", what: "water first; healthy oils (olive, canola, avocado) in small amounts" },
];

const words = (list) => new RegExp(`\\b(${list.join("|")})`, "i");
const FISH = words(["fish", "salmon", "tuna", "sardine", "mackerel", "snapper", "terakihi", "tarakihi", "hoki", "gurnard", "cod", "trout", "prawn", "shrimp", "mussel", "seafood", "sushi", "poke", "fishcake", "kahawai"]);
const LEGUMES = words(["bean", "lentil", "chickpea", "dahl", "dal\\b", "hummus", "houmous", "tofu", "tempeh", "edamame", "falafel", "split pea"]);
const WHOLEGRAIN = words(["oat", "porridge", "muesli", "bircher", "brown rice", "wholemeal", "wholegrain", "whole grain", "wholewheat", "quinoa", "barley", "freekeh", "bulgur", "rye", "buckwheat"]);
const LEFTOVER = words(["leftover", "left over", "left-over"]);
const RED_MEAT = words(["beef", "steak", "lamb", "pork", "mince", "burger", "bacon", "ham\\b", "sausage", "salami", "chorizo", "pepperoni", "venison", "meatball", "bolognese", "lasagne", "lasagna"]);
const VEG = words(["salad", "veg", "stir fry", "stir-fry", "broccoli", "spinach", "kale", "carrot", "pumpkin", "kumara", "capsicum", "zucchini", "courgette", "silverbeet", "cabbage", "slaw", "greens", "peas", "beans", "tomato", "mushroom", "cauli", "soup", "curry"]);

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const where = (hits) => hits.slice(0, 3).map((x) => `${DAY_NAMES[x.day]} ${x.meal.toLowerCase()}`).join(", ");

// Each habit: what it looks for, the warm line when it's there, and the idea when it isn't
const HABITS = [
  { id: "fish", test: FISH, good: (h) => `Fish or seafood: ${where(h)}`, idea: "Room for fish this week? Once or twice a week is good for your heart: salmon, tinned sardines on toast, a prawn stir fry." },
  { id: "legumes", test: LEGUMES, good: (h) => `Beans, lentils or tofu: ${where(h)}`, idea: "Try one meal built on beans, lentils or tofu: a dahl, chickpea curry or bean chilli. Cheap, filling and full of fibre." },
  { id: "wholegrain", test: WHOLEGRAIN, good: (h) => `Wholegrains: ${where(h)}`, idea: "Swap in a wholegrain somewhere: porridge or muesli for breakfast, brown rice or wholemeal wraps later on." },
  { id: "veg", test: VEG, min: 5, good: (h) => `Veg showing up in ${h.length} meals`, idea: "Half the plate as veg is the easiest win: add a salad, a side of greens or frozen veg to a few more meals." },
  { id: "leftovers", test: LEFTOVER, meals: ["Lunch"], good: (h) => `Leftovers planned: ${where(h)}`, idea: "Cook once, eat twice: make a dinner big enough to be the next day's lunch, and write \"leftovers\" in that box." },
];

// The tips for a week: wins (habits already there) and up to `max` ideas. Quiet until a few meals are typed.
export function menuTips(menu, { minMeals = 3, max = 2 } = {}) {
  const filled = filledMeals(menu);
  if (filled.length < minMeals) return { ready: false, wins: [], ideas: [], note: null };
  const wins = [], ideas = [];
  for (const h of HABITS) {
    const hits = filled.filter((x) => (!h.meals || h.meals.includes(x.meal)) && h.test.test(x.text));
    if (hits.length >= (h.min || 1)) wins.push({ id: h.id, text: h.good(hits) });
    else ideas.push({ id: h.id, text: h.idea });
  }
  // red and processed meat: a gentle note only past about three meals a week (the guidelines' weekly limit)
  const red = filled.filter((x) => RED_MEAT.test(x.text));
  const note = red.length > 3 ? { id: "red-meat", text: `Red or processed meat in ${red.length} meals. About three a week is plenty; a fish or bean night could swap in for one.` } : null;
  return { ready: true, wins, ideas: ideas.slice(0, max), note };
}
