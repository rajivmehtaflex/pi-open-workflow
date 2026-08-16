import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTaskTable, renderPipelineStrip, renderStatusRows, statusCell } from "./ui-table.ts";
import { displayWidth } from "./width.ts";

const task = (id: number, over: Partial<import("./types.ts").WorkflowTask> = {}) =>
  ({ id, text: `task ${id}`, status: "idle", ...over }) as import("./types.ts").WorkflowTask;

/** Identity theme so assertions measure real glyphs, not ANSI noise. */
const theme = {
  fg: (_c: string, t: string) => t,
  bg: (_c: string, t: string) => t,
  bold: (t: string) => t,
  dim: (t: string) => t,
};

/** Cell offset at which `needle` starts within `line`. */
function offsetOf(line: string, needle: string): number {
  const index = line.indexOf(needle);
  assert.notEqual(index, -1, `expected to find ${JSON.stringify(needle)} in ${JSON.stringify(line)}`);
  return displayWidth(line.slice(0, index));
}

test("renderTaskTable: no tasks produces no output", () => {
  assert.deepEqual(renderTaskTable({ currentStage: 0, completedStages: new Set(), tasks: [] }, 100, theme), []);
});

test("renderTaskTable: emits an uppercase header naming the columns", () => {
  const lines = renderTaskTable({ currentStage: 2, completedStages: new Set(), tasks: [task(1)] }, 120, theme);
  const header = lines[0];
  for (const column of ["#", "PRI", "STATUS", "STAGE", "TASK", "DEPS"]) {
    assert.ok(header.includes(column), `header missing ${column}: ${header}`);
  }
});

test("renderTaskTable: draws no box or rule characters", () => {
  const lines = renderTaskTable(
    { currentStage: 2, completedStages: new Set(), tasks: [task(1), task(2, { status: "done" })] },
    120,
    theme
  );
  for (const line of lines) {
    assert.ok(!/[│┌┐└┘├┤┬┴┼╭╮╰╯═║╔╗╚╝─]/.test(line), `borderless table must not draw rules: ${line}`);
  }
});

test("renderTaskTable: TASK column starts at the same cell on every row despite a wide glyph", () => {
  // ⛔ (blocked) is two cells wide; ✓ (done) is one. Measuring by code units misaligns these.
  const tasks = [
    task(1, { status: "idle", stage: 2, priority: "P1" }),
    task(2, { status: "idle", stage: 2, priority: "P1", dependsOn: [1] }), // blocked: dep #1 isn't done
    task(3, { status: "inprogress", stage: 3, priority: "P0" }),
  ];
  const lines = renderTaskTable({ currentStage: 3, completedStages: new Set(), tasks }, 120, theme);
  const rows = lines.slice(1);

  assert.ok(rows.some((r) => r.includes("⛔")), "one row must be blocked to exercise the wide glyph");

  const offsets = rows.map((row, i) => offsetOf(row, `task ${i + 1}`));
  assert.equal(new Set(offsets).size, 1, `TASK column misaligned across rows: ${JSON.stringify(offsets)}`);
});

test("renderTaskTable: header TASK label aligns with the task text below it", () => {
  const tasks = [task(1, { status: "done", stage: 2 })];
  const lines = renderTaskTable({ currentStage: 2, completedStages: new Set(), tasks }, 120, theme);
  assert.equal(offsetOf(lines[0], "TASK"), offsetOf(lines[1], "task 1"));
});

test("renderTaskTable: no row exceeds the terminal width", () => {
  const tasks = [task(1, { status: "idle", dependsOn: [2], priority: "P2", text: "x".repeat(300) })];
  for (const width of [40, 60, 80, 120]) {
    for (const line of renderTaskTable({ currentStage: 2, completedStages: new Set(), tasks }, width, theme)) {
      assert.ok(displayWidth(line) <= width, `line overflows ${width}: ${displayWidth(line)} cells`);
    }
  }
});

test("renderTaskTable: long task text is truncated with an ellipsis", () => {
  const tasks = [task(1, { text: "Implement animated SVG with aligned geometry and beach environment", stage: 3 })];
  const lines = renderTaskTable({ currentStage: 3, completedStages: new Set(), tasks }, 70, theme);
  assert.ok(lines[1].includes("…"), `expected truncation: ${lines[1]}`);
});

test("renderTaskTable: ids are right-aligned so digits stack", () => {
  const tasks = [task(9, { stage: 2 }), task(112, { stage: 2 })];
  const lines = renderTaskTable({ currentStage: 2, completedStages: new Set(), tasks }, 120, theme);
  assert.equal(offsetOf(lines[1], "9"), offsetOf(lines[2], "112") + 2, "single-digit id must be right-aligned under the wider one");
});

test("renderTaskTable: drops DEPS first, then PRI, then STAGE as width shrinks", () => {
  const tasks = [task(1, { stage: 2, priority: "P1", dependsOn: [2] })];
  const state = { currentStage: 2, completedStages: new Set<number>(), tasks };

  const wide = renderTaskTable(state, 120, theme)[0];
  assert.ok(wide.includes("DEPS") && wide.includes("PRI") && wide.includes("STAGE"));

  const medium = renderTaskTable(state, 62, theme)[0];
  assert.ok(!medium.includes("DEPS"), `DEPS should drop first: ${medium}`);
  assert.ok(medium.includes("PRI"), `PRI should survive longer than DEPS: ${medium}`);

  const narrow = renderTaskTable(state, 50, theme)[0];
  assert.ok(!narrow.includes("DEPS") && !narrow.includes("PRI"), `PRI should drop second: ${narrow}`);

  const tiny = renderTaskTable(state, 34, theme)[0];
  assert.ok(!tiny.includes("STAGE"), `STAGE should drop third: ${tiny}`);
  assert.ok(tiny.includes("TASK") && tiny.includes("STATUS"), `TASK and STATUS are never dropped: ${tiny}`);
});

test("statusCell: pairs a glyph with a text label so it survives NO_COLOR", () => {
  assert.match(statusCell({ status: "done" } as any, false), /^✓ done$/);
  assert.match(statusCell({ status: "inprogress" } as any, false), /^▸ active$/);
  assert.match(statusCell({ status: "idle" } as any, false), /^○ queued$/);
  assert.match(statusCell({ status: "idle" } as any, true), /^⛔ blocked$/);
});

test("renderTaskTable: dependency ids are listed in the DEPS column", () => {
  const tasks = [task(1, { status: "done" }), task(2, { dependsOn: [1] })];
  const lines = renderTaskTable({ currentStage: 2, completedStages: new Set(), tasks }, 120, theme);
  assert.ok(lines[2].includes("#1"), `expected dependency reference: ${lines[2]}`);
});

test("renderPipelineStrip: always shows all five stages, never skipping numbers", () => {
  const line = renderPipelineStrip({ currentStage: 4, completedStages: new Set([2, 4]), tasks: [] }, 120, theme).join("");
  for (const stage of ["Research", "Plan", "Act", "Verify", "Commit"]) {
    assert.ok(line.includes(stage), `pipeline strip must always list ${stage}: ${line}`);
  }
});

test("renderPipelineStrip: marks completed stages done and the current stage active", () => {
  const lines = renderPipelineStrip({ currentStage: 3, completedStages: new Set([1, 2]), tasks: [] }, 120, theme);
  const line = lines.join("");
  assert.ok(line.includes("✓ Research"), `completed stage marker missing: ${line}`);
  assert.ok(line.includes("▸ Act"), `current stage marker missing: ${line}`);
  assert.ok(line.includes("○ Commit"), `pending stage marker missing: ${line}`);
});

test("renderPipelineStrip: reports the task completion ratio", () => {
  const tasks = [task(1, { status: "done" }), task(2, { status: "done" }), task(3)];
  const line = renderPipelineStrip({ currentStage: 3, completedStages: new Set(), tasks }, 120, theme).join("");
  assert.ok(line.includes("2/3"), `expected task ratio: ${line}`);
});

test("renderPipelineStrip: fits within the terminal width", () => {
  for (const width of [30, 50, 80, 120]) {
    for (const line of renderPipelineStrip({ currentStage: 3, completedStages: new Set([1]), tasks: [] }, width, theme)) {
      assert.ok(displayWidth(line) <= width, `pipeline strip overflows ${width}`);
    }
  }
});

test("renderStatusRows: idle test state and no subagents produces no output", () => {
  const lines = renderStatusRows({ status: "idle" }, [], undefined, 120, theme);
  assert.deepEqual(lines, []);
});

test("renderTaskTable: works with the real Pi Theme shape (fg/bg/bold only — no .dim method)", () => {
  // The Pi Theme class exposes dim as a COLOR (theme.fg("dim", ...)), not a method.
  // Regression guard for the live crash: "TypeError: theme.dim is not a function".
  const realShapeTheme = {
    fg: (_c: string, t: string) => t,
    bg: (_c: string, t: string) => t,
    bold: (t: string) => t,
  } as unknown as import("./types.ts").Theme;
  const tasks = [
    task(1, { stage: 2, priority: "P1", status: "done" }),
    task(2, { stage: 3, priority: "P1", dependsOn: [1] }),
  ];
  const lines = renderTaskTable({ currentStage: 3, completedStages: new Set([2]), tasks }, 120, realShapeTheme);
  assert.ok(lines.length >= 3, `expected header + rows: ${JSON.stringify(lines)}`);
});

test("renderStatusRows: renders a TESTS row for a non-idle test state", () => {
  const lines = renderStatusRows({ status: "passed", command: "npm test" }, [], undefined, 120, theme);
  assert.ok(lines.some((l) => l.includes("TESTS") && l.includes("PASSED")), `expected a TESTS row: ${JSON.stringify(lines)}`);
});

test("renderStatusRows: a failed test state adds a detail line", () => {
  const lines = renderStatusRows({ status: "failed", command: "npm test", lastError: "expected 1 got 2" }, [], undefined, 120, theme);
  assert.ok(lines.some((l) => l.includes("expected 1 got 2")), `expected the failure detail: ${JSON.stringify(lines)}`);
});

test("renderStatusRows: renders one AGENT row per running subagent, full text (no hardcoded slice)", () => {
  const longTask = "Perform a final independent audit of every file touched across all six tasks in this branch";
  const lines = renderStatusRows({ status: "idle" }, [{ role: "explore", task: longTask, status: "running", elapsed: 5000 }], undefined, 200, theme);
  assert.ok(lines.some((l) => l.includes("explore") && l.includes("Running")), `expected a running-agent row: ${JSON.stringify(lines)}`);
  // At a width wide enough to hold it, the task text must not be pre-cut to a fixed count of characters.
  assert.ok(lines.some((l) => l.includes(longTask.slice(0, 60))), `expected fuller task text, not a hardcoded short slice: ${JSON.stringify(lines)}`);
});

test("renderStatusRows: renders a done/error AGENT row for the last completed subagent", () => {
  const lines = renderStatusRows({ status: "idle" }, [], { role: "explore", task: "trace a bug", status: "done", elapsed: 108000 }, 120, theme);
  assert.ok(lines.some((l) => l.includes("explore") && l.includes("done") && l.includes("108s")), `expected a last-agent row: ${JSON.stringify(lines)}`);
});

test("renderStatusRows: every row fits within the terminal width even with long task text", () => {
  const longTask = "x".repeat(300);
  const lines = renderStatusRows(
    { status: "failed", command: "npm test", lastError: "y".repeat(300) },
    [{ role: "explore", task: longTask, status: "running", elapsed: 1000 }],
    { role: "plan", task: longTask, status: "done", elapsed: 2000 },
    50,
    theme
  );
  for (const line of lines) {
    assert.ok(displayWidth(line) <= 50, `row overflows width: ${JSON.stringify(line)}`);
  }
});
