import type { WorkflowMode, WorkflowState } from "./types.ts";

/**
 * Reset per-session dashboard state without discarding the mode selected by the
 * session initializer. This matters for Task-spawned Pi processes: their initial
 * mode may be inherited from a write-capable parent via PI_OPEN_WORKFLOW_MODE.
 */
export function resetDashboardSession(state: WorkflowState, initialMode: WorkflowMode): void {
  state.currentStage = 0;
  state.tasks = [];
  state.completedStages = new Set();
  state.activeSubagents.clear();
  state.lastSubagent = undefined;
  state.testState = { status: "idle" };
  state.workflowPhase = "idle";
  state.mode = initialMode;
  state.permissionMode = "default";
  state.sessionStartTime = Date.now();
}
