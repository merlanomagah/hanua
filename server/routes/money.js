// Money from Pūtea's read-only local API (server/money.js), never kept. Split out of server/index.js (F6, 9 Oct 2026).
import { getMoney, getMoneyMonth, isMonthKey } from "../money.js";

export function register({ app }) {
  app.get("/api/money", async (_req, res, next) => {
    try {
      res.json(await getMoney());
    } catch (err) {
      next(err);
    }
  });

  // Another month for the Money book's ‹ › pages (read from Pūtea, never kept).
  app.get("/api/money/:ym", async (req, res, next) => {
    if (!isMonthKey(req.params.ym)) return res.status(400).json({ error: "Months look like 2026-10" });
    try {
      res.json(await getMoneyMonth(req.params.ym));
    } catch (err) {
      next(err);
    }
  });
}
