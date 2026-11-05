import test from "node:test";
import assert from "node:assert/strict";
import { makeRefreshRunner } from "../src/lib/refresh";

test("overlapping polls reuse a slow request instead of discarding its result", async () => {
  let finish!: () => void;
  let started = 0;
  let applied = 0;
  const refresh = makeRefreshRunner(async () => {
    started++;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    applied++;
  });
  const first = refresh();
  const second = refresh();
  const third = refresh();
  assert.equal(started, 1);
  finish();
  await Promise.all([first, second, third]);
  assert.equal(applied, 1);
});
test("a mutation during a read queues one fresh snapshot after it finishes", async () => {
  const finishes: (() => void)[] = [];
  let reads = 0;
  const applied: number[] = [];
  const refresh = makeRefreshRunner(async () => {
    const i = ++reads;
    await new Promise<void>((resolve) => finishes.push(resolve));
    applied.push(i);
  });
  const first = refresh();
  const forced = refresh(true);
  refresh(true);
  assert.equal(reads, 1);
  finishes[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  finishes[1]();
  await Promise.all([first, forced]);
  assert.deepEqual(applied, [1, 2]);
});
