// Two guards (desk health check, 6 Oct 2026, brief docs/plans/2026-10-desk-health-check.md, F1 and F3).
//
// 1. Only this Mac's own pages may talk to Hanua. The server listens on 127.0.0.1, but a web page elsewhere can point
//    its own name at 127.0.0.1 ("DNS rebinding") and then read Hanua's data as if it were Hanua's page. Browsers always
//    send the name they asked for (Host), so anything not asked of localhost is refused. Saves (anything but GET) from a
//    browser also carry where the page came from (Origin): it must be Hanua's own page. Scripts on this Mac (curl in
//    scripts/restart.sh) send no Origin and are let through: they can't be a web page.
// 2. A sample server never uses Mel's real room folder, and the real Hanua never loses it. Which one this is comes
//    from how it was started, never from a missing key (8 Oct 2026: the Mac mini's .env had a blank NOTION_TOKEN, so
//    the real Hanua took itself for a sample and quietly kept that day in data/room-sample):
//    - scripts/start.sh starts the real Hanua with HANUA_MAIN=1 (kept through every self-restart): never a sample;
//    - the sample launch configs say HANUA_SAMPLE=1 (and blank NOTION_TOKEN, which still counts, for older configs).
//    A sample server ignores the ROOM_DATA / BACKUP_DIR it inherits from .env, and never uses an iCloud Drive folder
//    even when given one; a folder of its own (sync-a / sync-b's /tmp folder) is used as given. The room folder
//    no longer depends on the Notion key: a real Hanua without one keeps Mel's folder and says the key is missing.

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

// "localhost:3000" → { name: "localhost", port: "3000" }; "[::1]:3000" → { name: "[::1]", port: "3000" }
function splitHost(host) {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(String(host || "").trim().toLowerCase());
  return m ? { name: m[1], port: m[2] || "80" } : null;
}
export function hostAllowed(host, port) {
  const h = splitHost(host);
  return Boolean(h && LOCAL.has(h.name) && h.port === String(port));
}
export function originAllowed(origin, port) {
  if (origin == null || origin === "") return true; // not a browser page (curl, Shortcuts)
  try {
    const u = new URL(origin);
    return u.protocol === "http:" && hostAllowed(u.host, port);
  } catch { return false; } // includes "null" (a sandboxed frame or a file)
}
// the rule as one answer: null = fine, else why it was refused
export function refusal({ method, host, origin }, port) {
  if (!hostAllowed(host, port)) return "host";
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !originAllowed(origin, port)) return "origin";
  return null;
}
export function localOnly(port) {
  return (req, res, next) => {
    const why = refusal({ method: req.method, host: req.get("host"), origin: req.get("origin") }, port);
    if (!why) return next();
    res.status(403).json({ error: why === "host" ? "Hanua only answers its own pages on this Mac" : "Saves only come from Hanua's own page" });
  };
}

// Which room folder and backup folder a server uses, before paths are resolved.
// env: process.env after dotenv; fileEnv: what .env itself says (dotenv.parse), {} if there's none.
// dir: the room folder to use (never empty); why: what Mel should be told about it (null when all is well).
const ICLOUD = /Mobile Documents/;
export function roomChoice(env, fileEnv = {}) {
  const main = env.HANUA_MAIN === "1";
  const sample = !main && (env.HANUA_SAMPLE === "1" || env.NOTION_TOKEN === "");
  if (!sample) {
    const room = env.ROOM_DATA || null;
    const why = !env.NOTION_TOKEN ? "This Mac has no Notion key in .env (copy the line from your other Mac's .env), so the books show sample data"
      : null;
    return { sample, main, room, backup: env.BACKUP_DIR || null, ignored: [], dir: room || "data/room", why };
  }
  const inherited = (k) => env[k] != null && env[k] !== "off" && (env[k] === fileEnv[k] || (k === "ROOM_DATA" && ICLOUD.test(env[k]))); // "off" is always safe
  const ignored = ["ROOM_DATA", "BACKUP_DIR"].filter(inherited);
  const room = ignored.includes("ROOM_DATA") ? null : env.ROOM_DATA || null;
  return { sample, main, room, backup: ignored.includes("BACKUP_DIR") ? null : env.BACKUP_DIR || null, ignored, dir: room || "data/room-sample", why: null };
}
