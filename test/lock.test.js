// The sleep screen's PIN (server/lock.js), on a temp file: never Mel's data/lock.json
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { changePin, checkPin, forgetPin, lockStatus, resetTries, setPin } from "../server/lock.js";

const file = async () => path.join(await mkdtemp(path.join(tmpdir(), "hanua-lock-")), "lock.json");

test("lock: set, check, and a second set is refused", async () => {
  resetTries();
  const f = await file();
  assert.deepEqual(await lockStatus(f), { set: false });
  await setPin(f, "1357");
  assert.deepEqual(await lockStatus(f), { set: true });
  assert.equal((await checkPin(f, "1357")).ok, true);
  assert.equal((await checkPin(f, "0000")).ok, false);
  await assert.rejects(setPin(f, "2468"), { status: 409 });
  await assert.rejects(setPin(await file(), "12a4"), { status: 400 });
});

test("lock: changing the PIN needs the current one; wrong tries count towards the pause", async () => {
  resetTries();
  const f = await file();
  await setPin(f, "1357");
  assert.equal((await changePin(f, "9999", "2468")).ok, false);
  assert.equal((await checkPin(f, "1357")).ok, true); // unchanged
  await assert.rejects(changePin(f, "1357", "24"), { status: 400 });
  assert.equal((await changePin(f, "1357", "2468")).ok, true);
  assert.equal((await checkPin(f, "2468")).ok, true);
  assert.equal((await checkPin(f, "1357")).ok, false);
  resetTries();
  let r;
  for (let i = 0; i < 5; i++) r = await changePin(f, "0000", "1111");
  assert.ok(r.wait > 0); // the fifth wrong try starts the pause
  assert.ok((await checkPin(f, "2468")).wait > 0); // even the right PIN waits
  resetTries();
});

test("lock: forgetting the PIN needs the current one; then a new one is chosen", async () => {
  resetTries();
  const f = await file();
  await setPin(f, "1357");
  assert.equal((await forgetPin(f, "0000")).ok, false);
  assert.deepEqual(await lockStatus(f), { set: true });
  assert.equal((await forgetPin(f, "1357")).ok, true);
  assert.deepEqual(await lockStatus(f), { set: false });
  await setPin(f, "8642");
  assert.equal((await checkPin(f, "8642")).ok, true);
  resetTries();
});
