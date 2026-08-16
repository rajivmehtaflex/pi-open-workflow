/**
 * Pure tree-grid renderer: stages as parent rows, tasks nested underneath.
 * Zero runtime imports (import type only) — runnable under node --test.
 */
import type { WorkflowTask, Theme, TestExecutionState } from "./types.ts";

export const STAGE_NAMES: readonly string[] = ["Research", "Plan", "Act", "Verify", "Commit"];

const STATUS_ICONS: Record<string, string> = { idle: "○", inprogress: "●", done: "✓" };

export interface TestStateBanner {
  label: string;
  command?: string;
  detail?: string;
}

/** Pure test-state wording shared by the dashboard and node-safe renderer tests. */
export function getTestStateBanner(state: TestExecutionState): TestStateBanner | undefined {
  if (state.status === "idle") return undefined;
  if (state.status === "running") return { label: "🧪 Test Loop: Running", command: state.command || "suite" };
  if (state.status === "passed") return { label: "🧪 Test Loop: ✓ PASSED", command: state.command || "suite" };
  if (state.status === "failed") {
    return { label: "🧪 Test Loop: ❌ REGRESSION DETECTED", command: state.command || "tests", detail: firstUsefulLine(state.lastError) };
  }
  if (state.status === "no-tests") {
    return { label: "🧪 Test Loop: ⚠ NO TESTS COLLECTED", command: state.command || "tests", detail: firstUsefulLine(state.lastError) };
  }
  return { label: "🧪 Test Loop: ⚠ TEST COMMAND NOT CONFIGURED" };
}

function firstUsefulLine(text?: string): string | undefined {
  return text?.split("\n").map((line) => line.trim()).find(Boolean);
}

export interface TreeRow {
  stage: number;
  label: string;
  tasks: WorkflowTask[];
  isCurrent: boolean;
  isCompleted: boolean;
}

export function buildTreeRows(state: { currentStage: number; completedStages: Set<number>; tasks: WorkflowTask[] }): TreeRow[] {
  const rows: TreeRow[] = [];
  for (let stage = 1; stage <= 5; stage++) {
    const tasks = state.tasks.filter((t) => (t.stage ?? 2) === stage);
    rows.push({
      stage,
      label: STAGE_NAMES[stage - 1],
      tasks,
      isCurrent: state.currentStage > 0 && stage === state.currentStage,
      isCompleted: state.completedStages.has(stage),
    });
  }
  return rows;
}

export function blockedBy(task: WorkflowTask, tasks: WorkflowTask[]): number[] {
  return (task.dependsOn ?? []).filter((d) => {
    const dep = tasks.find((t) => t.id === d);
    return dep !== undefined && dep.status !== "done";
  });
}

export function isBlocked(task: WorkflowTask, tasks: WorkflowTask[]): boolean {
  return blockedBy(task, tasks).length > 0;
}

/** Strip ANSI escapes for measuring, then clip the ORIGINAL string to visible width. */
export function clip(text: string, width: number): string {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (stripped.length <= width) return text;
  let visible = 0;
  let i = 0;
  let lastCut = 0;
  while (i < text.length) {
    if (text[i] === "\x1b") {
      const m = /^\[[0-9;]*m/.exec(text.slice(i));
      if (m) {
        i += m[0].length;
        continue;
      }
    }
    visible++;
    if (visible > width) {
      return text.slice(0, lastCut);
    }
    lastCut = i + 1;
    i++;
  }
  return text;
}

export function renderTreeGrid(
  state: { currentStage: number; completedStages: Set<number>; tasks: WorkflowTask[] },
  width: number,
  theme: Theme
): string[] {
  if (state.currentStage <= 0 && state.tasks.length === 0) return [];

  const rows = buildTreeRows(state);
  const lines: string[] = [];

  for (const row of rows) {
    const hasContent = row.tasks.length > 0 || row.isCurrent || row.isCompleted;
    if (!hasContent) continue;

    const doneCount = row.tasks.filter((t) => t.status === "done").length;
    const ratio = row.tasks.length > 0 ? `  ·  tasks ${doneCount}/${row.tasks.length}` : "  ·  tasks –";
    const icon = row.isCompleted ? "✓" : row.isCurrent ? "▸" : " ";
    const pendingVerify = row.isCurrent && row.stage === 4 && row.tasks.length === 0 && !row.isCompleted;
    const head = ` ${icon} ${row.stage}. ${row.label}${ratio}${pendingVerify ? "  ·  verification pending" : ""}`;
    const line = row.isCurrent ? theme.bold(theme.fg("accent", head)) : row.isCompleted ? theme.fg("success", head) : theme.fg("dim", head);
    lines.push(clip(line, width));

    row.tasks.forEach((t, idx) => {
      const branch = idx === row.tasks.length - 1 ? "    └─ " : "    ├─ ";
      const blocked = isBlocked(t, state.tasks) && t.status === "idle";
      const iconT = blocked ? "⛔" : STATUS_ICONS[t.status] ?? "○";
      const prio = t.priority ? ` [${t.priority}]` : "";
      const deps = blockedBy(t, state.tasks);
      const suffix = deps.length > 0 ? ` (needs ${deps.map((d) => `#${d}`).join(", ")})` : "";
      const body = `${branch}${iconT} #${t.id}${prio} ${t.text}${suffix}`;
      const colored = blocked ? theme.fg("warning", body) : t.status === "done" ? theme.fg("dim", body) : body;
      lines.push(clip(colored, width));
    });
  }

  return lines;
}
