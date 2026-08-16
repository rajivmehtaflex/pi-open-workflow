import { strict as assert } from "node:assert";
import { test } from "node:test";

import { advanceWorkflowPhase } from "./workflow-phase.ts";
import type { WorkflowPhase, WorkflowTask, TestExecutionState } from "./types.ts";

type PhaseInput = {
  phase: WorkflowPhase;
  action: "start" | "advance" | "reset";
  tasks?: WorkflowTask[];
  testStatus?: TestExecutionState["status"];
};

function transition(overrides: Partial<PhaseInput> = {}) {
  return advanceWorkflowPhase({
    phase: "idle",
    action: "start",
    tasks: [],
    testStatus: "idle",
    ...overrides,
  });
}

function task(id: number, status: WorkflowTask["status"]): WorkflowTask {
  return { id, text: `task ${id}`, status };
}

test("start advances idle to clarify", () => {
  assert.deepEqual(transition(), { ok: true, phase: "clarify" });
});

test("advance walks through every legal workflow phase", () => {
  let phase: WorkflowPhase = "clarify";
  for (const expected of ["research-plan", "decompose"] as const) {
    const result = transition({ phase, action: "advance" });
    assert.deepEqual(result, { ok: true, phase: expected });
    phase = expected;
  }

  let result = transition({ phase, action: "advance", tasks: [task(1, "idle")] });
  assert.deepEqual(result, { ok: true, phase: "execute" });
  result = transition({ phase: "execute", action: "advance", tasks: [task(1, "done")] });
  assert.deepEqual(result, { ok: true, phase: "verify" });
  result = transition({ phase: "verify", action: "advance", testStatus: "passed" });
  assert.deepEqual(result, { ok: true, phase: "complete" });
});

test("decompose refuses to advance without tasks", () => {
  const result = transition({ phase: "decompose", action: "advance", tasks: [] });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "decompose");
  assert.match(result.reason ?? "", /task/i);
});

test("execute refuses to advance until every task is done", () => {
  const result = transition({
    phase: "execute",
    action: "advance",
    tasks: [task(1, "done"), task(2, "inprogress")],
  });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "execute");
  assert.match(result.reason ?? "", /done/i);
});

test("verify refuses no-tests, failed, and not-configured results", () => {
  for (const testStatus of ["no-tests", "failed", "not-configured"] as const) {
    const result = transition({ phase: "verify", action: "advance", testStatus });
    assert.equal(result.ok, false);
    assert.equal(result.phase, "verify");
    assert.match(result.reason ?? "", /passed/i);
  }
});

test("illegal transitions are refused without changing phase", () => {
  const result = transition({ phase: "idle", action: "advance" });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "idle");
});

test("reset returns every phase to idle", () => {
  for (const phase of ["idle", "clarify", "research-plan", "decompose", "execute", "verify", "complete"] as const) {
    assert.deepEqual(transition({ phase, action: "reset" }), { ok: true, phase: "idle" });
  }
});
