/**
 * Responsive UI Dashboard Widget for pi-open-workflow.
 * Tree-Grid workflow view: stages as parent rows, tasks nested underneath.
 * Stage progress derives from completedStages (explicit) — never back-filled.
 */
import type { ExtensionAPI, ExtensionContext, Theme, WorkflowState } from "./types.js";
import { truncateToWidth } from "./types.js";
import { renderTaskTable, renderPipelineStrip, renderStatusRows } from "./ui-table.js";


export function registerDashboard(pi: ExtensionAPI, state: WorkflowState) {
  let activeContext: ExtensionContext | null = null;

  state.refreshUI = () => {
    if (activeContext) updateDashboardWidget(activeContext, state);
  };

  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    activeContext = ctx;
    // Full reset on every session start — no state leaks across sessions
    state.currentStage = 0;
    state.tasks = [];
    state.completedStages = new Set();
    state.activeSubagents.clear();
    state.lastSubagent = undefined;
    state.testState = { status: "idle" };
    state.workflowPhase = "idle";
    state.mode = "plan";
    state.permissionMode = "default";
    state.sessionStartTime = Date.now();
    if (ctx.ui.setWidget) ctx.ui.setWidget("openflow-dashboard", undefined);
    state.refreshUI?.();
  });

  pi.on("tool_call", async (_event: any, ctx: ExtensionContext) => {
    activeContext = ctx;
  });

  pi.on("tool_result", async (_event: any, ctx: ExtensionContext) => {
    activeContext = ctx;
    state.refreshUI?.();
  });
}

export function updateDashboardWidget(ctx: ExtensionContext, state: WorkflowState) {
  if (!ctx.ui.setWidget) return;

  const hasTasks = state.tasks.length > 0;
  const runningSubagents = Array.from(state.activeSubagents.values()).filter((s) => s.status === "running");
  const hasSubagents = runningSubagents.length > 0 || !!state.lastSubagent;
  const hasTests = state.testState.status !== "idle";

  if (!hasTasks && !hasSubagents && !hasTests && state.currentStage <= 0) {
    ctx.ui.setWidget("openflow-dashboard", undefined);
    return;
  }

  ctx.ui.setWidget("openflow-dashboard", (_tui: any, theme: Theme) => {
    return {
      dispose: () => {},
      invalidate: () => {},
      render(width: number): string[] {
        const lines: string[] = [];

        // 1. TASK TABLE (borderless, flat — # / PRI / STATUS / STAGE / TASK / DEPS)
        lines.push(...renderTaskTable(state, width, theme));

        // 2. PIPELINE STRIP — all five stages always shown, never skipped
        if (state.currentStage > 0 || hasTasks) {
          lines.push(...renderPipelineStrip(state, width, theme));
        }

        // 3. TESTS / AGENT STATUS ROWS
        lines.push(...renderStatusRows(state.testState, runningSubagents, state.lastSubagent, width, theme));

        return lines.map((l) => truncateToWidth(l, width));
      },
    };
  });
}
