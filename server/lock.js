// The sleep screen's PIN. Kept only as a salted scrypt hash in a file on this Mac (never committed, never sent to
// the page). It's a curtain against glances, not a vault: Mel locks the Mac itself when she steps away.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const WAIT_AFTER = 5; // wrong tries in a row before a pause
const WAIT_MS = 30_000;
let wrong = 0, waitUntil = 0;

export const validPin = (pin) => typeof pin === "string" && /^\d{4}$/.test(pin);

async function readLock(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; }
}

export async function lockStatus(file) {
  return { set: Boolean((await readLock(file))?.hash) };
}

export async function setPin(file, pin) {
  if (!validPin(pin)) throw Object.assign(new Error("The PIN needs to be 4 digits."), { status: 400 });
  if ((await readLock(file))?.hash) throw Object.assign(new Error("A PIN is already set."), { status: 409 });
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(pin, salt, 32)).toString("hex");
  await writeFile(file, JSON.stringify({ salt, hash }) + "\n", { mode: 0o600 });
}

// { ok } or { ok: false, wait } (seconds to wait after too many wrong tries)
export async function checkPin(file, pin) {
  if (Date.now() < waitUntil) return { ok: false, wait: Math.ceil((waitUntil - Date.now()) / 1000) };
  const lock = await readLock(file);
  if (!lock?.hash) return { ok: true };
  const given = await scrypt(String(pin ?? ""), lock.salt, 32);
  const ok = validPin(pin) && timingSafeEqual(given, Buffer.from(lock.hash, "hex"));
  if (ok) { wrong = 0; return { ok: true }; }
  if (++wrong >= WAIT_AFTER) { wrong = 0; waitUntil = Date.now() + WAIT_MS; return { ok: false, wait: WAIT_MS / 1000 }; }
  return { ok: false };
}

export async function clearPin(file) {
  await unlink(file).catch(() => {});
}

// Hanua Settings → Sleep screen (8 Oct 2026): a new PIN, or none (chosen again when Hanua next sleeps). Both need the
// current PIN, checked here, so wrong tries count towards the pause; Touch ID can't stand in (only the page checks it).
// { ok } or { ok: false, wait? }
export async function changePin(file, current, pin) {
  if (!validPin(pin)) throw Object.assign(new Error("The new PIN needs to be 4 digits."), { status: 400 });
  const check = await checkPin(file, current);
  if (!check.ok) return check;
  await clearPin(file);
  await setPin(file, pin);
  return { ok: true };
}
export async function forgetPin(file, current) {
  const check = await checkPin(file, current);
  if (check.ok) await clearPin(file);
  return check;
}
// tests only: a fresh count of wrong tries
export const resetTries = () => { wrong = 0; waitUntil = 0; };
