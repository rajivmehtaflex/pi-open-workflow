import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  classifyTestResult,
  detectTestCommand,
  resolveProjectRoot,
} from "./test-loop-core.ts";

test("nearest nested package root wins over the parent workspace manifest", () => {
  const workspace = mkdtempSync(join(tmpdir(), "test-loop-core-nested-"));
  try {
    writeFileSync(join(workspace, "pyproject.toml"), "[project]\nname = 'workspace'\n");
    const nested = join(workspace, "nested-pkg");
    mkdirSync(nested);
    writeFileSync(join(nested, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
    mkdirSync(join(nested, "src"));

    const root = resolveProjectRoot(join(nested, "src", "task-store.js"));
    assert.equal(root, nested);
    assert.equal(resolveProjectRoot(join(nested, "src")), root);
    assert.deepEqual(detectTestCommand(root), {
      command: "npm test",
      cwd: nested,
      framework: "node",
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("npm test descriptor does not append --silent", () => {
  const fixture = mkdtempSync(join(tmpdir(), "test-loop-core-node-"));
  try {
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
    const descriptor = detectTestCommand(fixture);
    assert.deepEqual(descriptor, { command: "npm test", cwd: fixture, framework: "node" });
    assert.ok(!descriptor?.command.includes("--silent"));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("pyproject resolves to the standard pytest descriptor", () => {
  const fixture = mkdtempSync(join(tmpdir(), "test-loop-core-python-"));
  try {
    writeFileSync(join(fixture, "pyproject.toml"), "[project]\nname = 'fixture'\n");
    assert.deepEqual(detectTestCommand(fixture), {
      command: "uv run pytest -q --tb=short",
      cwd: fixture,
      framework: "python",
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("unsupported project or placeholder npm script is not configured", () => {
  const fixture = mkdtempSync(join(tmpdir(), "test-loop-core-unsupported-"));
  try {
    writeFileSync(join(fixture, "package.json"), JSON.stringify({}));
    assert.equal(detectTestCommand(fixture), null);
    assert.equal(resolveProjectRoot(join(fixture, "missing.js")), fixture);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("classifies a successful command as passed", () => {
  const command = { command: "npm test", cwd: "/tmp/project", framework: "node" as const };
  assert.deepEqual(classifyTestResult(command, { exitCode: 0, stdout: "3 tests passed", stderr: "" }), {
    outcome: "passed",
    exitCode: 0,
    output: "3 tests passed",
  });
});

test("classifies a real nonzero assertion result as failed", () => {
  const command = { command: "npm test", cwd: "/tmp/project", framework: "node" as const };
  assert.deepEqual(classifyTestResult(command, { exitCode: 1, stdout: "not ok 1 - assertion", stderr: "AssertionError" }), {
    outcome: "failed",
    exitCode: 1,
    output: "not ok 1 - assertion\nAssertionError",
  });
});

test("classifies pytest exit code 5 as no-tests", () => {
  const command = { command: "uv run pytest -q --tb=short", cwd: "/tmp/project", framework: "python" as const };
  assert.deepEqual(classifyTestResult(command, { exitCode: 5, stdout: "no tests ran in 0.01s", stderr: "" }), {
    outcome: "no-tests",
    exitCode: 5,
    output: "no tests ran in 0.01s",
  });
});

test("classifies no-tests output even without pytest exit code 5", () => {
  const command = { command: "npm test", cwd: "/tmp/project", framework: "node" as const };
  assert.equal(classifyTestResult(command, { exitCode: 1, stdout: "collected 0 items", stderr: "" }).outcome, "no-tests");
  assert.equal(classifyTestResult(command, { exitCode: 1, stdout: "no tests found", stderr: "" }).outcome, "no-tests");
});

test("classifies a null command as not-configured", () => {
  assert.deepEqual(classifyTestResult(null, { exitCode: 1, stdout: "", stderr: "" }), {
    outcome: "not-configured",
    exitCode: null,
    output: "",
  });
});
