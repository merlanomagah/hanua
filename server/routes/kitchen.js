// The kitchen: the menu weeks, the household's tastes (from Notion), Claude's meal ideas, and the weather window.
// Split out of server/index.js (F6, 9 Oct 2026).
import path from "node:path";
import { notionEnabled, pageSection } from "../notion.js";
import { claudeEnabled, suggestMeals } from "../claude.js";
import { getWeather } from "../weather.js";
import { MEALS, menuShape } from "../../public/shared/menu.js";
import { weekKey } from "../../public/shared/dates.js";

export function register({ app, config, room, roomDir, roomRoute, baseOf }) {
  // (Before /api/menu/:week, so these aren't taken for a week's name.)
  // The household's tastes: the "Our tastes" section of the Notion Eating well guide (Notion is their home; Hanua
  // only reads them, for Claude's meal ideas). Cached 5 minutes. Sample mode has made-up tastes.
  const SAMPLE_TASTES = ["Dinners are shared; breakfasts and lunches are mostly mine.", "Partner: loves steak; no seafood except snapper; no mushrooms.", "Me: prawns, salmon and white fish are fine; not oysters, crab, mussels or octopus."];
  let tastesCache = null;
  async function readTastes() {
    const url = config.menu?.guideUrl || null;
    if (!notionEnabled()) return { tastes: SAMPLE_TASTES, url, sample: true };
    if (tastesCache && Date.now() - tastesCache.at < 300_000) return tastesCache.value;
    const id = /([0-9a-f]{32})(?:[?#]|$)/i.exec(url || "")?.[1];
    if (!id) return { tastes: [], url, error: "No Eating well guide is set in config/areas.json (menu.guideUrl)." };
    try {
      const value = { tastes: await pageSection(id, "Our tastes"), url };
      tastesCache = { at: Date.now(), value };
      return value;
    } catch (err) {
      const error = err.status === 404 || err.status === 403
        ? "Hanua can't see the Eating well guide yet: in Notion, open it, then ••• → Connections → add Hanua."
        : `Couldn't read your tastes from Notion (${err.message}).`;
      return { tastes: [], url, error };
    }
  }
  app.get("/api/menu/tastes", async (_req, res) => res.json(await readTastes()));
  // The kitchen window: today's and tomorrow's weather (Open-Meteo, cached 30 min; sample weather without WEATHER_PLACE)
  app.get("/api/weather", async (_req, res) => res.json(await getWeather()));
  // Three ideas around a protein, for one meal. Suggestions only: Mel picks, and the board is only changed in the page.
  app.post("/api/menu/ideas", async (req, res, next) => {
    const { meal, day, protein, planned } = req.body ?? {};
    if (!MEALS.includes(meal)) return res.status(400).json({ error: "Which meal?" });
    if (!claudeEnabled()) return res.status(503).json({ error: "Add ANTHROPIC_API_KEY to .env to ask Claude for ideas." });
    try {
      const { tastes } = await readTastes();
      const clip = (v, n) => String(v || "").slice(0, n);
      res.json(await suggestMeals({ meal, day: clip(day, 30), protein: clip(protein, 40), tastes, planned: (Array.isArray(planned) ? planned : []).slice(0, 21).map((p) => clip(p, 120)) }));
    } catch (err) {
      next(err);
    }
  });

  // The menu: one small JSON file per week, named by its Monday, holding what was typed in each box
  const menuDir = path.join(roomDir, "menu");
  app.get("/api/menu/:week", roomRoute(async (req, res) => {
    if (!weekKey(req.params.week)) return res.status(400).json({ error: "Which week?" });
    const { data, rev } = await room.load(path.join(menuDir, `${req.params.week}.json`), {});
    res.set("Cache-Control", "no-store").json({ ...menuShape(data), guideUrl: config.menu?.guideUrl || null, rev });
  }));
  app.put("/api/menu/:week", roomRoute(async (req, res) => {
    if (!weekKey(req.params.week)) return res.status(400).json({ error: "That week's menu couldn't be saved" });
    const { data, rev } = await room.write(path.join(menuDir, `${req.params.week}.json`), menuShape(req.body), { base: baseOf(req.body) });
    res.json({ ...data, rev });
  }));
}
