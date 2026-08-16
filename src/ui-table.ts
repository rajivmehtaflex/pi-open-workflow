/**
 * Borderless tabular dashboard renderer: a flat task table plus a pipeline strip.
 * Replaces the nested tree-grid (ui-tree.ts) — see docs/superpowers/specs for the
 * design rationale (borderless over boxed, glyph+text status, column drop order).
 *
 * Zero runtime imports (import type only, plus the pure width.ts helpers) — runnable
 * under node --test.
 */
import type { WorkflowTask, Theme, TestExecutionState } from "./types.ts";
import { displayWidth, padTo, truncateToWidth } from "./width.ts";
import { blockedBy, isBlocked, getTestStateBanner } from "./ui-tree.ts";

export const STAGE_NAMES: readonly string[] = ["Research", "Plan", "Act", "Verify", "Commit"];

export { getTestStateBanner };

interface TableState {
  currentStage: number;
  completedStages: Set<number>;
  tasks: WorkflowTask[];
}

/** Glyph + text label for a task's status — survives NO_COLOR and colorblind viewing. */
export function statusCell(task: Pick<WorkflowTask, "status">, blocked: boolean): string {
  if (blocked) return "⛔ blocked";
  if (task.status === "done") return "✓ done";
  if (task.status === "inprogress") return "▸ active";
  return "○ queued";
}

const GUTTER = "  ";

interface Column {
  key: "id" | "pri" | "status" | "stage" | "task" | "deps";
  header: string;
  align: "left" | "right";
  minWidth: number;
}

// Priority order for dropping columns as width shrinks: DEPS first, then PRI, then STAGE.
// TASK and STATUS never drop — the table degrades to id/status/task at minimum.
const ALL_COLUMNS: Column[] = [
  { key: "id", header: "#", align: "right", minWidth: 1 },
  { key: "pri", header: "PRI", align: "left", minWidth: 3 },
  { key: "status", header: "STATUS", align: "left", minWidth: 9 }, // "⛔ blocked" is 9 cells
  { key: "stage", header: "STAGE", align: "left", minWidth: 5 },
  { key: "task", header: "TASK", align: "left", minWidth: 12 },
  { key: "deps", header: "DEPS", align: "left", minWidth: 4 },
];

function cellValue(col: Column, task: WorkflowTask, tasks: WorkflowTask[]): string {
  switch (col.key) {
    case "id":
      return `#${task.id}`;
    case "pri":
      return task.priority ?? "";
    case "status":
      return statusCell(task, isBlocked(task, tasks) && task.status === "idle");
    case "stage":
      return STAGE_NAMES[(task.stage ?? 2) - 1] ?? "";
    case "task":
      return task.text;
    case "deps": {
      const deps = blockedBy(task, tasks);
      const stamped = (task.dependsOn ?? []).length > 0 ? task.dependsOn! : deps;
      return stamped.length > 0 ? stamped.map((d) => `#${d}`).join(",") : "–";
    }
  }
}

/** Fixed-width columns this table needs at minimum, given the gutters between them. */
function fixedWidth(columns: Column[]): number {
  const widths = columns.filter((c) => c.key !== "task").reduce((sum, c) => sum + c.minWidth, 0);
  return widths + GUTTER.length * columns.length;
}

// TASK is the column that matters — keep dropping lower-priority columns until it
// would have at least this many cells of comfortable room, or until nothing is left
// to drop.
const TASK_COMFORTABLE_WIDTH = 30;

/** Pick which columns fit, dropping DEPS, then PRI, then STAGE as width shrinks. */
function selectColumns(width: number): Column[] {
  let columns = ALL_COLUMNS;
  const dropOrder: Column["key"][] = ["deps", "pri", "stage"];
  for (const key of dropOrder) {
    if (width >= fixedWidth(columns) + TASK_COMFORTABLE_WIDTH) break;
    columns = columns.filter((c) => c.key !== key);
  }
  return columns;
}

export function renderTaskTable(state: TableState, width: number, theme: Theme): string[] {
  if (state.tasks.length === 0) return [];

  const columns = selectColumns(width);

  // Column widths grow to fit their widest content (header included) — e.g. the id
  // column widens from its 1-cell minimum once a 3-digit id appears — everything but
  // TASK, which instead takes whatever room is left after the others are sized.
  const colWidths = new Map<Column["key"], number>();
  for (const col of columns) {
    if (col.key === "task") continue;
    const widest = state.tasks.reduce((max, task) => Math.max(max, displayWidth(cellValue(col, task, state.tasks))), displayWidth(col.header));
    colWidths.set(col.key, Math.max(col.minWidth, widest));
  }

  const otherFixedWidth = columns.filter((c) => c.key !== "task").reduce((sum, c) => sum + colWidths.get(c.key)!, 0) + GUTTER.length * columns.length;
  const taskCol = columns.find((c) => c.key === "task")!;
  const taskWidth = Math.max(taskCol.minWidth, width - otherFixedWidth);
  colWidths.set("task", taskWidth);

  const rows = state.tasks.map((task) => {
    return columns.map((col) => {
      const raw = cellValue(col, task, state.tasks);
      return col.key === "task" ? truncateToWidth(raw, taskWidth) : raw;
    });
  });

  function formatRow(cells: string[], isHeader: boolean): string {
    const parts = cells.map((cell, i) => {
      const col = columns[i];
      const targetWidth = colWidths.get(col.key)!;
      return col.align === "right" ? padStart(cell, targetWidth) : padTo(cell, targetWidth);
    });
    const line = GUTTER + parts.join(GUTTER);
    return isHeader ? theme.fg("dim", theme.bold(line)) : line;
  }

  const header = formatRow(
    columns.map((c) => c.header),
    true
  );

  const body = rows.map((cells, idx) => {
    const task = state.tasks[idx];
    const line = formatRow(cells, false);
    return task.status === "done" ? theme.fg("dim", line) : line;
  });

  return [truncateToWidth(header, width), ...body.map((l) => truncateToWidth(l, width))];
}

function padStart(str: string, width: number): string {
  const deficit = width - displayWidth(str);
  return deficit > 0 ? " ".repeat(deficit) + str : str;
}

export function renderPipelineStrip(state: TableState, width: number, theme: Theme): string[] {
  const doneTasks = state.tasks.filter((t) => t.status === "done").length;
  const totalTasks = state.tasks.length;
  const ratio = totalTasks > 0 ? `${doneTasks}/${totalTasks} tasks` : "";

  const stageParts = STAGE_NAMES.map((name, idx) => {
    const stage = idx + 1;
    const icon = state.completedStages.has(stage) ? "✓" : state.currentStage === stage ? "▸" : "○";
    const label = `${icon} ${name}`;
    if (state.currentStage === stage && !state.completedStages.has(stage)) return theme.bold(theme.fg("accent", label));
    if (state.completedStages.has(stage)) return theme.fg("success", label);
    return theme.fg("dim", label);
  });

  const left = "PIPELINE  " + stageParts.join("  ");
  const line = ratio ? `${left}       ${theme.fg("dim", ratio)}` : left;

  return [truncateToWidth(line, width)];
}

interface RunningSubagent {
  role: string;
  task: string;
  status: "running" | "done" | "error";
  elapsed: number;
}

/**
 * Test-loop and subagent banners rendered as fixed-label rows beneath the table.
 * Task text is truncated to the actual terminal width, not a hardcoded character count.
 */
export function renderStatusRows(
  testState: TestExecutionState,
  runningSubagents: RunningSubagent[],
  lastSubagent: RunningSubagent | undefined,
  width: number,
  theme: Theme
): string[] {
  const lines: string[] = [];
  const LABEL = "          "; // 10-cell gutter matching "TESTS     " / "AGENT     "

  if (testState.status !== "idle") {
    const banner = getTestStateBanner(testState);
    if (banner) {
      const color = testState.status === "passed" ? "success" : testState.status === "failed" ? "error" : testState.status === "running" ? "accent" : "warning";
      const command = banner.command ? ` ${theme.fg("dim", `(${banner.command})`)}` : "";
      lines.push(truncateToWidth(`TESTS     ${theme.fg(color, banner.label)}${command}`, width));
      if (banner.detail) {
        lines.push(truncateToWidth(`${LABEL}${theme.fg(testState.status === "failed" ? "error" : "warning", banner.detail)}`, width));
      }
    }
  }

  for (const agent of runningSubagents) {
    lines.push(truncateToWidth(`AGENT     ${theme.fg("warning", `▸ ${agent.role} · Running`)}`, width));
    lines.push(truncateToWidth(`${LABEL}${theme.fg("dim", agent.task)}`, width));
  }

  if (lastSubagent) {
    const icon = lastSubagent.status === "done" ? theme.fg("success", "✓") : theme.fg("error", "✗");
    lines.push(truncateToWidth(`AGENT     ${icon} ${lastSubagent.role} · ${lastSubagent.status} · ${Math.round(lastSubagent.elapsed / 1000)}s`, width));
    lines.push(truncateToWidth(`${LABEL}${theme.fg("dim", lastSubagent.task)}`, width));
  }

  return lines;
}
