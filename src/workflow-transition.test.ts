import { strict as assert } from "node:assert";
import { test } from "node:test";

import { advanceAfterTaskUpdate } from "./workflow-transition.ts";
import type { PipelineStage, TestExecutionState, WorkflowTask } from "./types.ts";

type TransitionInput = {
  currentStage: PipelineStage;
  completedStages: Set<number>;
  tasks: WorkflowTask[];
  testStatus: TestExecutionState["status"];
};

function task(id: number, stage: number, status: WorkflowTask["status"] = "done"): WorkflowTask {
  return { id, text: `task ${id}`, stage, status };
}

function transition(overrides: Partial<TransitionInput> = {}) {
  return advanceAfterTaskUpdate({
    currentStage: 3,
    completedStages: new Set<number>(),
    tasks: [task(1, 2), task(2, 2)],
    testStatus: "passed",
    ...overrides,
  });
}

test("completed stage-2 tasks move stage 3 to Verify", () => {
  const result = transition();

  assert.equal(result.currentStage, 4);
  assert.equal(result.completedStages.has(2), true);
});

test("unstamped tasks use the Plan stage default", () => {
  const result = transition({
    tasks: [
      { ...task(1, 2), stage: undefined },
      { ...task(2, 2), stage: undefined },
    ],
  });

  assert.equal(result.currentStage, 4);
  assert.equal(result.completedStages.has(2), true);
});

test("completed tasks do not auto-move past Verify to Commit", () => {
  const result = transition({ currentStage: 4 });

  assert.equal(result.currentStage, 4);
});

test("no-tests does not complete Verify", () => {
  const result = transition({
    currentStage: 4,
    tasks: [task(1, 4)],
    testStatus: "no-tests",
  });

  assert.equal(result.currentStage, 4);
  assert.equal(result.completedStages.has(4), false);
});

test("failed tests do not move Verify to Commit", () => {
  const result = transition({
    currentStage: 4,
    tasks: [task(1, 4)],
    testStatus: "failed",
  });

  assert.equal(result.currentStage, 4);
  assert.equal(result.completedStages.has(4), false);
});

test("tasks that are not all done do not advance", () => {
  const result = transition({ tasks: [task(1, 2), task(2, 2, "inprogress")] });

  assert.equal(result.currentStage, 3);
  assert.equal(result.completedStages.has(2), false);
});

test("no tasks do not advance", () => {
  const result = transition({ tasks: [] });

  assert.equal(result.currentStage, 3);
  assert.deepEqual(result.completedStages, new Set<number>());
});
