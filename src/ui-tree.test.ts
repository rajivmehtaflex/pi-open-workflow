import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlocked, blockedBy, getTestStateBanner } from "./ui-tree.ts";

const task = (id: number, over: Partial<import("./types.ts").WorkflowTask> = {}) =>
  ({ id, text: `t${id}`, status: "idle", ...over }) as import("./types.ts").WorkflowTask;

test("isBlocked: false when all deps done; true when a dep inprogress", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "inprogress" }), task(3, { dependsOn: [1] }), task(4, { dependsOn: [2] })];
  assert.equal(isBlocked(task(3, { dependsOn: [1] }), tasks), false);
  assert.equal(isBlocked(task(4, { dependsOn: [2] }), tasks), true);
});

test("blockedBy: only un-done deps, unknown ids ignored", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "idle" })];
  assert.deepEqual(blockedBy(task(5, { dependsOn: [1, 2, 99] }), tasks), [2]);
});

test("blockedBy: empty when the dependency is done, regardless of own status", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "idle", dependsOn: [1] })];
  // blockedBy reports unfinished deps regardless of own status — gating callers check status
  assert.deepEqual(blockedBy(task(2, { dependsOn: [1] }), tasks), []);
});

test("getTestStateBanner: idle returns undefined", () => {
  assert.equal(getTestStateBanner({ status: "idle" }), undefined);
});

test("getTestStateBanner: no-tests is a warning, not a regression", () => {
  const banner = getTestStateBanner({ status: "no-tests", command: "npm test", lastError: "\nno tests ran in 0.01s" });
  assert.equal(banner?.label, "🧪 Test Loop: ⚠ NO TESTS COLLECTED");
  assert.equal(banner?.command, "npm test");
  assert.equal(banner?.detail, "no tests ran in 0.01s");
  assert.ok(!banner?.label.includes("REGRESSION"));
});

test("getTestStateBanner: not-configured is an explicit warning", () => {
  assert.deepEqual(getTestStateBanner({ status: "not-configured" }), {
    label: "🧪 Test Loop: ⚠ TEST COMMAND NOT CONFIGURED",
  });
});

test("getTestStateBanner: passed and running carry the command", () => {
  assert.deepEqual(getTestStateBanner({ status: "passed", command: "npm test" }), {
    label: "🧪 Test Loop: ✓ PASSED",
    command: "npm test",
  });
  assert.deepEqual(getTestStateBanner({ status: "running", command: "uv run pytest -q" }), {
    label: "🧪 Test Loop: Running",
    command: "uv run pytest -q",
  });
});

test("getTestStateBanner: failed surfaces the first useful line of the error", () => {
  const banner = getTestStateBanner({ status: "failed", command: "npm test", lastError: "\n\n  AssertionError: expected 1 to equal 2\n      at Test.run" });
  assert.equal(banner?.label, "🧪 Test Loop: ❌ REGRESSION DETECTED");
  assert.equal(banner?.detail, "AssertionError: expected 1 to equal 2");
});
