// Two guards (desk health check, 6 Oct 2026, brief docs/plans/2026-10-desk-health-check.md, F1 and F3).
//
// 1. Only this Mac's own pages may talk to Hanua. The server listens on 127.0.0.1, but a web page elsewhere can point
//    its own name at 127.0.0.1 ("DNS rebinding") and then read Hanua's data as if it were Hanua's page. Browsers always
//    send the name they asked for (Host), so anything not asked of localhost is refused. Saves (anything but GET) from a
//    browser also carry where the page came from (Origin): it must be Hanua's own page. Scripts on this Mac (curl in
//    scripts/restart.sh) send no Origin and are let through: they can't be a web page.
// 2. A sample server never uses Mel's real room folder. The sample launch configs blank NOTION_TOKEN; .env (read by
//    dotenv for every server started in this folder) names her shared iCloud folder in ROOM_DATA. Inherited from .env
//    by a sample server, that folder is ignored (and so is .env's BACKUP_DIR): the sample's own folder is used and the
//    log says so. A folder given to the sample server itself (sync-a / sync-b's /tmp folder) is used as given.

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
export function roomChoice(env, fileEnv = {}) {
  const sample = env.NOTION_TOKEN === ""; // blanked on purpose: a sample server (every sample launch config)
  const inherited = (k) => sample && env[k] != null && env[k] !== "off" && env[k] === fileEnv[k]; // "off" is always safe
  const ignored = ["ROOM_DATA", "BACKUP_DIR"].filter(inherited);
  return {
    sample,
    room: ignored.includes("ROOM_DATA") ? null : env.ROOM_DATA || null,
    backup: ignored.includes("BACKUP_DIR") ? null : env.BACKUP_DIR || null,
    ignored,
  };
}
