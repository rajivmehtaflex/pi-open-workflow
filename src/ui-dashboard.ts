/**
 * Responsive UI Dashboard Widget for pi-open-workflow.
 * Tree-Grid workflow view: stages as parent rows, tasks nested underneath.
 * Stage progress derives from completedStages (explicit) — never back-filled.
 */
import type { ExtensionAPI, ExtensionContext, Theme, WorkflowState } from "./types.js";
import { visibleWidth, truncateToWidth } from "./types.js";
import { renderTreeGrid, getTestStateBanner } from "./ui-tree.js";

const STAGE_NAMES = ["Research", "Plan", "Act", "Verify", "Commit"];


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
        const isWide = width >= 85;

        // 1. TREE-GRID WORKFLOW VIEW (stages as parents, tasks nested)
        const treeLines = renderTreeGrid(state, width, theme);
        if (treeLines.length > 0) {
          lines.push(...treeLines);
        } else if (state.currentStage > 0) {
          const name = STAGE_NAMES[state.currentStage - 1] || "Research";
          lines.push(truncateToWidth(` ${theme.fg("accent", theme.bold(`[${state.currentStage}. ${name} ●]`))}`, width));
        }

        // 2. SUBAGENT TELEMETRY (wide: right column; narrow: banner)
        if (hasSubagents) {
          if (isWide) {
            const colWidth = Math.floor((width - 4) / 2);
            const rows: string[] = [theme.bold(theme.fg("accent", "Subagent Telemetry:"))];
            if (runningSubagents.length > 0) {
              for (const s of runningSubagents) {
                rows.push(theme.fg("warning", `  🤖 [${s.role}] Running...`));
                rows.push(truncateToWidth(theme.fg("dim", `     Task: ${s.task.slice(0, 30)}...`), colWidth));
              }
            } else if (state.lastSubagent) {
              const s = state.lastSubagent;
              const icon = s.status === "done" ? theme.fg("success", "✓") : theme.fg("error", "✗");
              rows.push(`  ${icon} Last: [${s.role}] ${s.status} (${Math.round(s.elapsed / 1000)}s)`);
              rows.push(truncateToWidth(theme.fg("dim", `     Task: ${s.task.slice(0, 28)}...`), colWidth));
            } else {
              rows.push(theme.fg("dim", "  Idle (No subagents spawned)"));
            }
            lines.push(...rows);
          } else {
            for (const s of runningSubagents) {
              lines.push(truncateToWidth(theme.fg("warning", ` 🤖 [${s.role}] Running: ${s.task.slice(0, width - 25)}...`), width));
            }
          }
        }

        // 3. LIVE TEST VERIFICATION BANNER
        if (hasTests) {
          const ts = state.testState;
          const banner = getTestStateBanner(ts);
          if (banner) {
            const color = ts.status === "passed" ? "success" : ts.status === "failed" ? "error" : ts.status === "running" ? "accent" : "warning";
            const command = banner.command ? ` ${theme.fg("dim", `(${banner.command})`)}` : "";
            lines.push(` ${theme.fg(color, banner.label)}${command}`);
            if (banner.detail) {
              lines.push(truncateToWidth(theme.fg(ts.status === "failed" ? "error" : "warning", `    ${banner.detail}`), width));
            }
          }
        }

        return lines.map((l) => truncateToWidth(l, width));
      },
    };
  });
}
