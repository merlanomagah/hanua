// The sleep screen. Hanua opens asleep, and falls asleep after 15 minutes without use, or on ⌃L / the moon button.
// It wakes with the 4-digit PIN (checked by the server, which keeps only a hash) or Touch ID. A curtain against
// glances, not a vault: Mel locks the Mac itself when she steps away (her choice, 4 Oct 2026).
import { $, api, h, store, toast } from "./lib.js";

// ?idle=20 (seconds) makes testing quicker; normally 15 minutes
const IDLE_MS = (Number(new URLSearchParams(location.search).get("idle")) || 15 * 60) * 1000;
const TOUCH_KEY = "room-touchid"; // the Touch ID credential's id (not a secret)
const OFFERS_KEY = "room-touchid-offers"; // how often Touch ID has been offered (at most three times)

const lock = $("lock");
let mode = "check"; // "setup" (choose a PIN), "confirm" (type it again) or "check"
let entered = "", firstPin = "", waitTimer = null, clockTimer = null;
let lastActive = Date.now();
export let asleep = true;

const say = (title, msg = "") => { $("lock-title").textContent = title; $("lock-msg").textContent = msg; };
const dots = () => [...$("lock-dots").children].forEach((d, i) => d.classList.toggle("on", i < entered.length));
function shake() {
  const d = $("lock-dots");
  d.classList.remove("shake");
  void d.offsetWidth;
  d.classList.add("shake");
}

function tick() {
  const now = new Date();
  $("lock-time").textContent = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  $("lock-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

// ---- Touch ID (WebAuthn on this Mac). Optional: the PIN always works ----
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
async function touchAvailable() {
  try { return Boolean(window.PublicKeyCredential) && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}
async function setUpTouch() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      rp: { name: "Hanua", id: location.hostname },
      user: { id: random(16), name: "hanua", displayName: "Hanua" },
      challenge: random(32),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    } });
    store(TOUCH_KEY, b64(cred.rawId));
    toast("Touch ID is set. Next time, touch the sensor to wake Hanua.");
  } catch (err) {
    if (err?.name !== "NotAllowedError") store(OFFERS_KEY, "3");
    toast(err?.name === "NotAllowedError" ? "Touch ID wasn't set up. Your PIN still works." : "Touch ID isn't available here. Your PIN still works.", err?.name !== "NotAllowedError");
  }
}
async function touchWake() {
  const id = store(TOUCH_KEY);
  if (!id) return;
  try {
    await navigator.credentials.get({ publicKey: {
      challenge: random(32), rpId: location.hostname, userVerification: "required", timeout: 60_000,
      allowCredentials: [{ type: "public-key", id: unb64(id) }],
    } });
    wake();
  } catch { say("Hanua is asleep", "Touch ID didn't work. Use your PIN."); }
}
async function offerTouch() {
  const offers = Number(store(OFFERS_KEY)) || 0;
  if (store(TOUCH_KEY) || offers >= 3 || !(await touchAvailable())) return;
  store(OFFERS_KEY, String(offers + 1));
  toast("Wake Hanua with Touch ID next time?", false, { label: "Use Touch ID", run: setUpTouch });
}

// ---- the keypad ----
function press(key) {
  if (!asleep || waitTimer) return;
  if (key === "back") entered = entered.slice(0, -1);
  else if (entered.length < 4) entered += key;
  dots();
  if (entered.length === 4) setTimeout(submit, 120);
}

async function submit() {
  const pin = entered;
  entered = "";
  if (mode === "setup") {
    firstPin = pin; mode = "confirm"; dots();
    return say("Type it once more", "So we know it's right.");
  }
  if (mode === "confirm") {
    if (pin !== firstPin) { mode = "setup"; shake(); dots(); return say("Choose a 4-digit PIN", "Those didn't match. Start again."); }
    try {
      await api("/api/lock/setup", { pin });
      wake();
      toast("PIN set. Forgot it one day? Double-click “Reset Hanua PIN” in the Hanua folder.", false);
      setTimeout(offerTouch, 4000);
    } catch (err) { mode = "setup"; dots(); say("Choose a 4-digit PIN", err.message); }
    return;
  }
  try {
    const res = await api("/api/lock/check", { pin });
    if (res.ok) { wake(); return offerTouch(); }
    shake(); dots();
    if (res.wait) return pause(res.wait);
    say("Hanua is asleep", "Not quite. Try again.");
  } catch (err) { dots(); say("Hanua is asleep", err.message); }
}

function pause(seconds) {
  let left = seconds;
  const show = () => say("Hanua is asleep", `Too many tries. Try again in ${left} seconds.`);
  show();
  waitTimer = setInterval(() => {
    if (--left > 0) return show();
    clearInterval(waitTimer); waitTimer = null;
    say("Hanua is asleep", "Type your PIN.");
  }, 1000);
}

function buildPad() {
  const key = (label, value, aria) => {
    const b = h("button", { type: "button", className: "lock-key", textContent: label, ariaLabel: aria || label });
    b.addEventListener("click", () => press(value));
    return b;
  };
  const touch = h("button", { type: "button", className: "lock-key lock-touch", ariaLabel: "Wake with Touch ID", hidden: true,
    innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11a5 5 0 0 1 10 0v2"/><path d="M12 11v4a6 6 0 0 1-1 3"/><path d="M9.5 13.5a10 10 0 0 1-.5 4.5"/><path d="M14.5 12v2a11 11 0 0 1-.7 4"/><path d="M4.5 9a8 8 0 0 1 15 0"/></svg>' });
  touch.addEventListener("click", touchWake);
  $("lock-pad").replaceChildren(
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => key(n, n)),
    touch, key("0", "0"), key("⌫", "back", "Delete the last digit"));
  return touch;
}
const touchKey = buildPad();

// ---- falling asleep and waking ----
export async function sleep() {
  asleep = true;
  entered = ""; dots();
  document.documentElement.classList.add("asleep");
  // anything open (a dialog, a toast) stays put underneath; the lock sits above it
  if (lock.open) lock.close();
  lock.showModal();
  tick();
  clearInterval(clockTimer);
  clockTimer = setInterval(tick, 10_000);
  touchKey.hidden = !store(TOUCH_KEY);
  try {
    const { set } = await api("/api/lock");
    mode = set ? "check" : "setup";
  } catch { mode = "check"; }
  if (mode === "setup") say("Choose a 4-digit PIN", "Hanua asks for it when it opens and after 15 minutes without use.");
  else say("Hanua is asleep", touchKey.hidden ? "Type your PIN." : "Touch ID or your PIN.");
}

export function wake() {
  asleep = false;
  lastActive = Date.now();
  clearInterval(clockTimer);
  lock.close();
  document.documentElement.classList.remove("asleep");
}

lock.addEventListener("cancel", (e) => e.preventDefault()); // Esc doesn't wake it
document.addEventListener("keydown", (e) => {
  if (asleep) {
    e.stopPropagation(); // nothing behind the curtain hears keys (no ⌘S Feed, no ⌃F)
    if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
    else if (e.metaKey || e.ctrlKey) e.preventDefault();
    return;
  }
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); sleep(); }
}, true);

// 15 minutes without a touch, a key or a scroll, and Hanua sleeps (also checked when its tab comes back)
for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"]) {
  addEventListener(ev, () => { if (!asleep) lastActive = Date.now(); }, { passive: true, capture: true });
}
const checkIdle = () => { if (!asleep && Date.now() - lastActive > IDLE_MS) sleep(); };
setInterval(checkIdle, Math.min(15_000, IDLE_MS / 2));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkIdle(); });
$("ts-sleep").addEventListener("click", sleep);

sleep();
