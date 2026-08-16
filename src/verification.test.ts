import { strict as assert } from "node:assert";
import { test } from "node:test";

import { evaluateManualVerification } from "./verification-core.ts";

test("refuses when no tasks exist", () => {
  const result = evaluateManualVerification({ tasks: [], passed: true, summary: "counted rows" });
  assert.equal(result.ok, false);
});

test("refuses when a task is not done", () => {
  const result = evaluateManualVerification({
    tasks: [{ status: "done" }, { status: "inprogress" }],
    passed: true,
    summary: "counted rows",
  });
  assert.equal(result.ok, false);
});

test("refuses an empty summary", () => {
  const result = evaluateManualVerification({ tasks: [{ status: "done" }], passed: true, summary: "   " });
  assert.equal(result.ok, false);
});

test("records a passing manual verification", () => {
  const result = evaluateManualVerification({ tasks: [{ status: "done" }], passed: true, summary: "row counts match" });
  assert.deepEqual(result, { ok: true, status: "passed", command: "manual verification" });
});

test("records a failing manual verification with the summary as lastError", () => {
  const result = evaluateManualVerification({
    tasks: [{ status: "done" }],
    passed: false,
    summary: "found 3 orphaned enrollments",
  });
  assert.deepEqual(result, {
    ok: true,
    status: "failed",
    command: "manual verification",
    lastError: "found 3 orphaned enrollments",
  });
});
