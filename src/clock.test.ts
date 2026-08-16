import { strict as assert } from "node:assert";
import { test } from "node:test";

import { countBlocked, formatElapsed } from "./clock.ts";

test("formatElapsed formats zero as [00:00:00]", () => {
  assert.equal(formatElapsed(0), "[00:00:00]");
});

test("formatElapsed formats 1h23m45s as [01:23:45]", () => {
  assert.equal(formatElapsed(((1 * 60 + 23) * 60 + 45) * 1000), "[01:23:45]");
});

test("formatElapsed keeps hours unbounded (100h)", () => {
  assert.equal(formatElapsed(100 * 3600 * 1000), "[100:00:00]");
});

test("countBlocked counts idle tasks with unfinished dependencies", () => {
  const tasks = [
    { id: 1, status: "idle", dependsOn: [2] }, // blocked: task 2 not done
    { id: 2, status: "inprogress" },
    { id: 3, status: "idle", dependsOn: [1] }, // blocked: task 1 not done
    { id: 4, status: "idle" }, // no deps → unblocked
  ];
  assert.equal(countBlocked(tasks), 2);
});
