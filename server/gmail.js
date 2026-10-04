// Key emails from Gmail, read-only (gmail.readonly, never anything more). Mel signs in once per account
// from Hanua (/api/mail/connect); the refresh token stays on this Mac in data/gmail-tokens.json (gitignored).
// Only the slice Gmail's own filters mark Key, plus starred, from the last 14 days; subjects and senders are
// held in memory for 5 minutes and never written anywhere. Notion only ever gets an email's link, on a row
// Mel has confirmed. Without Google keys the room gets sample emails.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mailItem, KEY_QUERY } from "../public/shared/mail.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = path.join(root, "data", "gmail-tokens.json");
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const mailEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = () => `http://127.0.0.1:${Number(process.env.PORT) || 3000}/api/mail/callback`;

async function readTokens() {
  try { return JSON.parse(await fs.readFile(TOKENS, "utf8")); } catch { return {}; }
}
async function writeTokens(t) {
  await fs.mkdir(path.dirname(TOKENS), { recursive: true });
  await fs.writeFile(TOKENS, JSON.stringify(t, null, 2), { mode: 0o600 });
}

// ---- signing in: Google's page, then back to /api/mail/callback ----
const pending = new Map(); // state → PKCE verifier, for 10 minutes
export function connectUrl() {
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  pending.set(state, verifier);
  setTimeout(() => pending.delete(state), 600_000).unref();
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", state,
    code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(body) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google: ${json.error_description || json.error || res.status}`);
  return json;
}

export async function finishConnect(code, state) {
  const verifier = pending.get(state);
  if (!verifier) throw new Error("That sign-in has expired. Try Connect Gmail again.");
  pending.delete(state);
  const t = await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri() });
  if (!String(t.scope || "").split(" ").every((s) => s === SCOPE)) throw new Error("Google gave more access than read-only; not kept.");
  const profile = await gmail("/profile", t.access_token);
  const all = await readTokens();
  all[profile.emailAddress] = { refresh: t.refresh_token || all[profile.emailAddress]?.refresh };
  await writeTokens(all);
  cache = null;
  return profile.emailAddress;
}

const access = new Map(); // account → { token, until }
async function accessToken(account, refresh) {
  const hit = access.get(account);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const t = await token({ grant_type: "refresh_token", refresh_token: refresh });
  access.set(account, { token: t.access_token, until: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function gmail(p, accessTok) {
  const res = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${accessTok}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Gmail ${res.status}`);
  return res.json();
}

// ---- the key emails, newest first ----
let cache = null; // { at, value }
export async function getMail({ fresh = false } = {}) {
  if (!mailEnabled()) return { live: false, reason: "off", accounts: [], items: sampleMail() };
  if (!fresh && cache && Date.now() - cache.at < 300_000) return cache.value;
  const tokens = await readTokens();
  const accounts = Object.keys(tokens);
  if (!accounts.length) return { live: false, reason: "connect", accounts, items: [] };
  const items = [];
  let failed = false;
  for (const account of accounts) {
    try {
      const tok = await accessToken(account, tokens[account].refresh);
      const list = await gmail(`/messages?${new URLSearchParams({ q: KEY_QUERY, maxResults: "20" })}`, tok);
      const metas = await Promise.all((list.messages || []).map((m) =>
        gmail(`/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, tok)));
      items.push(...metas.map((m) => mailItem(m, account)));
    } catch (err) {
      console.error("[gmail]", account, err.message);
      failed = true;
    }
  }
  items.sort((a, b) => b.at - a.at);
  const value = { live: true, reason: failed ? "partly" : "", accounts, items: items.slice(0, 30) };
  cache = { at: Date.now(), value };
  return value;
}

// One email's text, only when Mel asks to find its dates (then dropped)
export async function mailText(account, id) {
  if (!/^[0-9a-f]{6,32}$/i.test(id)) throw Object.assign(new Error("Unknown email"), { status: 400 });
  const tokens = await readTokens();
  if (!tokens[account]) throw Object.assign(new Error("That Gmail account isn't connected"), { status: 400 });
  const m = await gmail(`/messages/${id}?format=full`, await accessToken(account, tokens[account].refresh));
  const header = (n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || "";
  const parts = [];
  const walk = (p) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) parts.push(Buffer.from(p.body.data, "base64url").toString("utf8"));
    (p.parts || []).forEach(walk);
  };
  walk(m.payload);
  const text = (parts.join("\n") || m.snippet || "").slice(0, 12_000);
  return { subject: header("subject"), from: header("from"), date: header("date"), text };
}

function sampleMail() {
  const ago = (h) => Date.now() - h * 3_600_000;
  const m = (id, from, subject, h, starred, key) => ({ id, threadId: id, account: "you@example.com", from, subject, at: ago(h), starred, key, sample: true,
    link: `https://mail.google.com/mail/?authuser=you@example.com#all/${id}` });
  return [
    m("s1a", "Property manager", "Booking your rental walkthrough", 5, false, true),
    m("s2b", "Recruiter", "Next steps: interview on Thursday", 26, true, true),
    m("s3c", "Airline", "Your flight to Sydney is confirmed", 70, true, false),
  ];
}
