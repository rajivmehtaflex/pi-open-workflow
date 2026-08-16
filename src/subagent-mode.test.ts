import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSubagentMode, readOnlyNotice } from "./subagent-mode.ts";

test("resolveSubagentMode: explore is always read-only, even in Act Mode", () => {
  assert.equal(resolveSubagentMode("explore", "act"), "plan");
  assert.equal(resolveSubagentMode("explore", "plan"), "plan");
});

test("resolveSubagentMode: general inherits the parent session mode", () => {
  assert.equal(resolveSubagentMode("general", "act"), "act");
  assert.equal(resolveSubagentMode("general", "plan"), "plan");
});

test("resolveSubagentMode: bash and plan roles follow the parent mode too", () => {
  assert.equal(resolveSubagentMode("bash", "act"), "act");
  assert.equal(resolveSubagentMode("bash", "plan"), "plan");
  assert.equal(resolveSubagentMode("plan", "act"), "act");
  assert.equal(resolveSubagentMode("plan", "plan"), "plan");
});

test("resolveSubagentMode: unknown roles default to the parent mode (no accidental write in plan)", () => {
  assert.equal(resolveSubagentMode("researcher", "act"), "act");
  assert.equal(resolveSubagentMode("researcher", "plan"), "plan");
});

test("readOnlyNotice: absent when parent is in Act Mode", () => {
  assert.equal(readOnlyNotice("general", "act"), undefined);
  assert.equal(readOnlyNotice("bash", "act"), undefined);
});

test("readOnlyNotice: absent for explore (read-only is expected, not a problem)", () => {
  assert.equal(readOnlyNotice("explore", "plan"), undefined);
});

test("readOnlyNotice: actionable warning when a write-capable role runs read-only under Plan Mode", () => {
  const notice = readOnlyNotice("general", "plan");
  assert.ok(notice, "expected a notice");
  assert.ok(notice.includes("READ-ONLY"), "says it ran read-only");
  assert.ok(notice.includes("/act"), "tells the user the exact remedy");
});
