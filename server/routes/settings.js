// Settings Mel changes herself (Desk Settings and Hanua Settings; public/shared/settings.js), kept in the room folder,
// and what the server itself takes from them. Split out of server/index.js (F6, 9 Oct 2026).
// Returns { current, reload }: the desk's routes read the current settings; the folder watch reloads them.
import path from "node:path";
import { SETTINGS_VERSION, defaults as settingDefaults, settingsShape } from "../../public/shared/settings.js";
import { setCalendarChoice, setListNames } from "../calendar.js";
import { setWeatherPlace } from "../weather.js";
import { fileTooNew } from "../../public/shared/sync.js";

export async function register({ app, config, room, roomDir, roomRoute, baseOf, readJson }) {
  // Settings Mel changes herself (the desk's Settings window; public/shared/settings.js): on this Mac beside the days,
  // so the nightly backup has them. Unset ones fall back to config/areas.json, .env and the code.
  const settingsFile = path.join(roomDir, "settings.json");
  const settingBase = () => settingDefaults(config.planner?.fixedSections || []);
  let settings = settingsShape(await readJson(settingsFile, {}), settingBase()), settingsRev = (await room.read(settingsFile)).rev ?? null;
  // what the server itself uses: the Reminders lists, which calendars show and count as Work, the weather's town
  function useSettings() {
    setListNames(settings.lists);
    setCalendarChoice(settings.calendars);
    setWeatherPlace(settings.weather.place);
  }
  useSettings();
  // the other Mac changed Settings (or they arrived from iCloud): use them here too
  async function reloadSettings() {
    const r = await room.read(settingsFile);
    if (r.state !== "ok" && r.state !== "missing") return;
    settings = settingsShape(r.data || {}, settingBase()); settingsRev = r.rev;
    useSettings();
  }
  app.get("/api/settings", roomRoute(async (_req, res) => { await reloadSettings(); res.set("Cache-Control", "no-store").json({ settings, defaults: settingBase(), rev: settingsRev }); }));
  app.put("/api/settings", async (req, res, next) => {
    try {
      // only the groups this page changed are written over what's there (8 Oct 2026), so a change on one Mac never
      // undoes another group changed on the other meanwhile; a page that doesn't say (an older one) still saves whole,
      // refused if the file changed since. A file from a newer Hanua is never saved over (it would drop its groups).
      const mine = settingsShape(req.body, settingBase());
      const changed = Array.isArray(req.body?.changed) ? req.body.changed.filter((k) => Object.hasOwn(mine, k)) : null;
      const guard = (cur) => { if (fileTooNew(cur?.v, SETTINGS_VERSION)) throw Object.assign(new Error("Settings were saved by a newer Hanua on your other Mac"), { status: 409, newer: true }); };
      const merge = changed ? (cur) => ({ ...settingsShape(cur || {}, settingBase()), ...Object.fromEntries(changed.map((k) => [k, mine[k]])), v: SETTINGS_VERSION }) : undefined;
      const { data, rev } = await room.write(settingsFile, { ...mine, v: SETTINGS_VERSION }, { base: baseOf(req.body), merge, guard });
      settings = settingsShape(data, settingBase()); settingsRev = rev;
      useSettings();
      res.json({ settings, defaults: settingBase(), rev });
    } catch (err) {
      if (err.status === 409) { await reloadSettings(); return res.status(409).json({ error: err.message, conflict: err.conflict, newer: Boolean(err.newer), settings, defaults: settingBase(), rev: settingsRev }); }
      if (err.status === 503) return res.status(503).json({ error: err.message, pending: true });
      next(err);
    }
  });
  return { current: () => settings, reload: reloadSettings };
}
