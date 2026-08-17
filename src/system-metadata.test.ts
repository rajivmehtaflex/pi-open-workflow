import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

import {
  detectToolchains,
  detectSystemInformation,
  formatSystemMetadataBlock,
} from "./system-metadata.ts";
import type { WorkflowState } from "./types.ts";

test("detectToolchains identifies Python uv and Node npm projects", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "meta-test-"));
  try {
    fs.writeFileSync(path.join(tempDir, "uv.lock"), "");
    fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
    fs.mkdirSync(path.join(tempDir, ".venv"));

    const detected = detectToolchains(tempDir);
    assert.ok(detected.includes("Python (uv)"));
    assert.ok(detected.includes("Active .venv"));
    assert.ok(detected.includes("Node.js"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("detectToolchains identifies Rust and Go projects", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "meta-test-rust-"));
  try {
    fs.writeFileSync(path.join(tempDir, "Cargo.toml"), "");
    fs.writeFileSync(path.join(tempDir, "go.mod"), "");

    const detected = detectToolchains(tempDir);
    assert.ok(detected.includes("Rust (cargo)"));
    assert.ok(detected.includes("Go"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("detectSystemInformation populates complete environment context", () => {
  const fixedDate = new Date("2026-08-17T07:40:00.000Z");
  const mockState: WorkflowState = {
    mode: "act",
    permissionMode: "default",
    currentStage: 1,
    stageStartTime: Date.now(),
    completedStages: new Set(),
    sessionStartTime: Date.now(),
    tasks: [],
    nextTaskId: 1,
    safetyRules: { bashToolPatterns: [], zeroAccessPaths: [], readOnlyPaths: [], noDeletePaths: [] },
    activeSubagents: new Map(),
    testState: { status: "idle" },
    workflowPhase: "idle",
  };

  const info = detectSystemInformation(process.cwd(), mockState, fixedDate);
  assert.equal(info.currentDate, "2026-08-17");
  assert.equal(info.currentYear, 2026);
  assert.ok(info.os);
  assert.ok(info.arch);
  assert.ok(info.shell);
  assert.ok(info.userPrivilege);
  assert.equal(info.workflowMode, "Act Mode (Full Execution)");
});

test("formatSystemMetadataBlock produces complete markdown block", () => {
  const info = {
    currentDate: "2026-08-17",
    currentIsoTime: "2026-08-17T07:40:00.000Z",
    currentYear: 2026,
    timezone: "UTC",
    os: "linux",
    arch: "x86_64",
    shell: "/bin/bash",
    userPrivilege: "root (uid 0)",
    cwd: "/workspace/my-app",
    git: {
      branch: "main",
      commit: "abc1234",
      isClean: true,
      remoteUrl: "https://github.com/org/repo.git",
    },
    detectedToolchains: ["Python (uv)", "Active .venv"],
    workflowMode: "Act Mode (Full Execution)",
  };

  const formatted = formatSystemMetadataBlock(info);
  assert.ok(formatted.includes("## Environment & Runtime Metadata"));
  assert.ok(formatted.includes("Today's Date is **2026-08-17**"));
  assert.ok(formatted.includes("Branch: `main`"));
  assert.ok(formatted.includes("Python (uv), Active .venv"));
  assert.ok(formatted.includes("Act Mode (Full Execution)"));
  assert.ok(formatted.includes("## External Knowledge & Internet Search Guidelines"));
});
