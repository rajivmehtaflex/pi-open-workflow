import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkflowState } from "./types.ts";
import { resetDashboardSession } from "./session-state.ts";

function makeState(mode: "plan" | "act"): WorkflowState {
  return {
    mode,
    permissionMode: "default",
    currentStage: 3,
    stageStartTime: 1,
    completedStages: new Set([1, 2]),
    sessionStartTime: 1,
    tasks: [{ id: 1, text: "old task", status: "done" }],
    nextTaskId: 2,
    safetyRules: { bashToolPatterns: ["old"], zeroAccessPaths: [], readOnlyPaths: [], noDeletePaths: [] },
    activeSubagents: new Map([["old", { role: "general", task: "old", status: "running", elapsed: 1 }]]),
    lastSubagent: { role: "general", task: "old", status: "done", elapsed: 1 },
    testState: { status: "passed", command: "npm test" },
    workflowPhase: "execute",
  };
}

test("resetDashboardSession clears transient state while preserving inherited Act Mode", () => {
  const state = makeState("act");
  resetDashboardSession(state, "act");

  assert.equal(state.mode, "act");
  assert.equal(state.currentStage, 0);
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.completedStages, new Set());
  assert.equal(state.activeSubagents.size, 0);
  assert.equal(state.lastSubagent, undefined);
  assert.deepEqual(state.testState, { status: "idle" });
  assert.equal(state.workflowPhase, "idle");
  assert.equal(state.permissionMode, "default");
});

test("resetDashboardSession keeps a top-level session in its initial Plan Mode", () => {
  const state = makeState("plan");
  resetDashboardSession(state, "plan");
  assert.equal(state.mode, "plan");
});
