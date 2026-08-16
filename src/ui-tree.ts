/**
 * Dependency-blocking and test-state wording shared by the tabular dashboard (ui-table.ts).
 * Formerly also hosted the nested tree-grid renderer, replaced by ui-table.ts's flat
 * borderless table — see docs/superpowers/specs for the design rationale.
 * Zero runtime imports (import type only) — runnable under node --test.
 */
import type { WorkflowTask, TestExecutionState } from "./types.ts";

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

export function blockedBy(task: WorkflowTask, tasks: WorkflowTask[]): number[] {
  return (task.dependsOn ?? []).filter((d) => {
    const dep = tasks.find((t) => t.id === d);
    return dep !== undefined && dep.status !== "done";
  });
}

export function isBlocked(task: WorkflowTask, tasks: WorkflowTask[]): boolean {
  return blockedBy(task, tasks).length > 0;
}
