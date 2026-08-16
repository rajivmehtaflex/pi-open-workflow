import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTreeRows, isBlocked, blockedBy, renderTreeGrid, clip, STAGE_NAMES, getTestStateBanner } from "./ui-tree.ts";

const task = (id: number, over: Partial<import("./types.ts").WorkflowTask> = {}) =>
  ({ id, text: `t${id}`, status: "idle", ...over }) as import("./types.ts").WorkflowTask;

const theme = { fg: (_c: string, t: string) => t, bg: (_c: string, t: string) => t, bold: (t: string) => t, dim: (t: string) => t };

test("buildTreeRows: groups by stage stamp, default stage 2", () => {
  const rows = buildTreeRows({ currentStage: 0, completedStages: new Set(), tasks: [task(1, { stage: 2 }), task(2, { stage: 3 }), task(3)] });
  assert.equal(rows[1].tasks.length, 2); // stage 2: task 1 + default-stamped task 3
  assert.equal(rows[2].tasks.length, 1); // stage 3: task 2
});

test("buildTreeRows: isCurrent only when currentStage matches and >0", () => {
  const rows = buildTreeRows({ currentStage: 3, completedStages: new Set([1]), tasks: [] });
  assert.equal(rows[2].isCurrent, true);
  assert.equal(rows[0].isCurrent, false);
  assert.equal(rows[0].isCompleted, true);
});

test("isBlocked: false when all deps done; true when a dep inprogress", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "inprogress" }), task(3, { dependsOn: [1] }), task(4, { dependsOn: [2] })];
  assert.equal(isBlocked(task(3, { dependsOn: [1] }), tasks), false);
  assert.equal(isBlocked(task(4, { dependsOn: [2] }), tasks), true);
});

test("blockedBy: only un-done deps, unknown ids ignored", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "idle" })];
  assert.deepEqual(blockedBy(task(5, { dependsOn: [1, 2, 99] }), tasks), [2]);
});

test("renderTreeGrid: empty state → []", () => {
  assert.deepEqual(renderTreeGrid({ currentStage: 0, completedStages: new Set(), tasks: [] }, 100, theme), []);
});

test("renderTreeGrid: connectors, priority chip, blocked suffix", () => {
  const tasks = [
    task(1, { stage: 2, priority: "P0", status: "inprogress" }),
    task(2, { stage: 2, dependsOn: [1] }),
  ];
  const lines = renderTreeGrid({ currentStage: 2, completedStages: new Set(), tasks }, 120, theme);
  const flat = lines.join("\n");
  assert.ok(flat.includes("├─") && flat.includes("└─"), "tree connectors");
  assert.ok(flat.includes("[P0]"), "priority chip");
  assert.ok(flat.includes("(needs #1)"), "blocked suffix");
});

test("renderTreeGrid: completed stage shows ✓ + ratio; current stage bold", () => {
  const tasks = [task(1, { status: "done", stage: 2 })];
  const lines = renderTreeGrid({ currentStage: 2, completedStages: new Set([2]), tasks }, 120, theme);
  const flat = lines.join("\n");
  assert.ok(flat.includes("✓ 2. Plan"), "completed check");
  assert.ok(flat.includes("tasks 1/1"), "task ratio");
});

test("renderTreeGrid: current Verify with no tasks is explicitly pending", () => {
  const lines = renderTreeGrid({ currentStage: 4, completedStages: new Set([2]), tasks: [] }, 120, theme);
  const flat = lines.join("\n");
  assert.ok(flat.includes("▸ 4. Verify"), "Verify is the current stage");
  assert.ok(flat.includes("tasks –"), "empty Verify row explains its task count");
  assert.ok(flat.includes("verification pending"), "empty Verify row explains why it is shown");
});

test("renderTreeGrid: completed Verify (stage 4) shows ✓, not pending", () => {
  const lines = renderTreeGrid({ currentStage: 4, completedStages: new Set([1, 2, 3, 4]), tasks: [] }, 120, theme);
  const flat = lines.join("\n");
  assert.ok(flat.includes("✓ 4. Verify"), "Verify shows the completed check, not the current-stage marker");
  assert.ok(!flat.includes("verification pending"), "completed Verify must not show the pending explanation");
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

test("clip: strips ANSI when measuring, truncates to visible width", () => {
  const ansi = "\x1b[31m" + "x".repeat(50) + "\x1b[0m";
  const out = clip(ansi, 10);
  assert.ok(out.startsWith("\x1b[31m"));
  assert.equal(out.replace(/\x1b\[[0-9;]*m/g, "").length, 10);
});

test("STAGE_NAMES: five stages", () => {
  assert.equal(STAGE_NAMES.length, 5);
});
