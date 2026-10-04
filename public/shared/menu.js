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
  { id: "fish", test: FISH, good: (h) => `Fish or seafood: ${where(h)}`, idea: "Room for fish this week? About twice a week is good for your heart: salmon, tinned sardines on toast, a prawn stir fry." },
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

// ---- planning the week: protein first (how Mel and her partner choose), then the meal ----
// Each protein carries the icon it shows with; its name joins the meal's text for the tips, so picking Salmon
// counts as fish even before the meal is written.
export const PROTEINS = [
  { name: "Steak", icon: "steak" }, { name: "Beef", icon: "steak" }, { name: "Lamb", icon: "steak" }, { name: "Pork", icon: "steak" },
  { name: "Chicken", icon: "chicken" }, { name: "Mince", icon: "steak" }, { name: "Sausages", icon: "steak" },
  { name: "Salmon", icon: "fish" }, { name: "Snapper", icon: "fish" }, { name: "White fish", icon: "fish" }, { name: "Prawns", icon: "fish" }, { name: "Tuna", icon: "fish" },
  { name: "Beans or lentils", icon: "leaf" }, { name: "Tofu", icon: "leaf" }, { name: "Eggs", icon: "egg" }, { name: "Yoghurt", icon: "bowl" }, { name: "Oats", icon: "grain" },
  { name: "Leftovers", icon: "bowl" }, { name: "Eat out", icon: "hat" },
];

// ---- a tip a day: short, sourced, one habit at a time, so something new is learned each day ----
const NZ = "NZ Eating and Activity Guidelines", AU = "Australian Dietary Guidelines", HSPH = "Harvard Healthy Eating Plate", HF = "Heart Foundation";
export const DAILY_TIPS = [
  { icon: "leaf", text: "Fill half the plate with vegetables first, then add the rest. It's the simplest balance check there is.", source: HSPH },
  { icon: "fish", text: "Oily fish like salmon, sardines and mackerel bring omega-3 fats. About twice a week is the aim.", source: HF },
  { icon: "grain", text: "Wholegrains keep you fuller for longer than white versions. Try half brown, half white rice to start.", source: NZ },
  { icon: "leaf", text: "Frozen vegetables are picked and frozen fresh, so they count just as much, and they don't go limp in the fridge.", source: AU },
  { icon: "leaf", text: "A tin of chickpeas or lentils stretches mince or a curry further, adds fibre, and costs very little.", source: AU },
  { icon: "steak", text: "Lean red meat is a great source of iron. About three red-meat meals a week is plenty.", source: AU },
  { icon: "steak", text: "Keep processed meats (bacon, ham, salami, sausages) for now and then, rather than every week.", source: NZ },
  { icon: "drop", text: "Water first. Sugary drinks are the easiest added sugar to cut, and the body doesn't count them as food.", source: NZ },
  { icon: "bowl", text: "Cook once, eat twice: double tonight's dinner and lunch tomorrow is already done.", source: "Eating well guide" },
  { icon: "leaf", text: "Eat the rainbow: different coloured vegetables bring different vitamins, so variety beats volume.", source: HSPH },
  { icon: "grain", text: "Porridge or muesli with fruit is a breakfast that keeps you going until lunch.", source: NZ },
  { icon: "egg", text: "Eggs are a quick, cheap protein for any meal: an omelette with leftover veg is a five-minute dinner.", source: AU },
  { icon: "leaf", text: "Nuts and seeds count as protein too. A small handful a day is a good snack.", source: AU },
  { icon: "drop", text: "Cook with olive, canola or avocado oil, and go easy on butter and coconut oil.", source: HF },
  { icon: "leaf", text: "Salt hides in sauces, stock and bread. Taste before adding more, and use herbs, lemon or garlic instead.", source: HF },
  { icon: "fish", text: "Tinned fish counts. Salmon or tuna on wholegrain toast is a quick lunch with good fats.", source: HF },
  { icon: "bowl", text: "A plain yoghurt with fruit is a better snack than a flavoured one: those can hold several teaspoons of sugar.", source: NZ },
  { icon: "leaf", text: "Fruit whole beats fruit juiced: the fibre stays and it fills you up.", source: NZ },
  { icon: "chicken", text: "Chicken thighs are cheaper and harder to dry out than breast. Trim the skin to keep it leaner.", source: "Eating well guide" },
  { icon: "steak", text: "With steak, let the sides do the work: a big salad or roast veg keeps the plate in balance.", source: HSPH },
  { icon: "grain", text: "Check the label: \"wholegrain\" or \"wholemeal\" should be the first ingredient on bread.", source: AU },
  { icon: "hat", text: "Plan dinners first, then breakfasts and lunches around them. Fewer decisions, less waste.", source: "Eating well guide" },
  { icon: "leaf", text: "Soups and curries hide a lot of vegetables. Grate in a carrot or zucchini and nobody notices.", source: "Eating well guide" },
  { icon: "fish", text: "Snapper and other white fish are mild, quick to cook and low in fat: a good start for seafood doubters.", source: HF },
  { icon: "drop", text: "Keep a water bottle on the desk. Thirst is often mistaken for hunger in the afternoon.", source: NZ },
  { icon: "leaf", text: "One meat-free night a week built on beans, lentils or tofu is good for you, your budget and the planet.", source: HSPH },
  { icon: "bowl", text: "Batch-cook a big pot on Sunday: soups, chillies and curries freeze well for busy nights.", source: "Eating well guide" },
  { icon: "grain", text: "Swap a white wrap for a wholemeal one, or rice for quinoa or barley, one meal at a time.", source: AU },
  { icon: "egg", text: "Protein at breakfast (eggs, yoghurt, nut butter) helps you stay full through the morning.", source: HSPH },
  { icon: "hat", text: "Takeaway night? Pick the one with the most vegetables, and keep it to one night a week.", source: NZ },
];
// The tip for a day (YYYY-MM-DD): the same all day, a different one tomorrow, all of them before any repeats
export function dailyTip(day) {
  const [y, m, d] = day.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return DAILY_TIPS[((n % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length];
}
