import type { ExtensionAPI, ExtensionContext, Theme, WorkflowState } from "./types.js";
import { truncateToWidth, visibleWidth } from "./types.js";
import { formatElapsed, countBlocked } from "./clock.js";

const STAGE_NAMES = ["Research", "Plan", "Act", "Verify", "Commit"];

export function registerStatusline(pi: ExtensionAPI, state: WorkflowState) {
  let activeTimer: ReturnType<typeof setInterval> | undefined;

  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    if (!ctx.ui.setFooter) return;
    ctx.ui.setFooter((tui: any, theme: Theme) => {
      // Tick every second so the session clock stays current
      activeTimer = setInterval(() => tui?.requestRender?.(), 1000);

      return {
        dispose: () => {
          if (activeTimer) clearInterval(activeTimer);
          activeTimer = undefined;
        },
        invalidate: () => {},
        render(width: number): string[] {
          const isNarrow = width < 70;
          const model = ctx.model?.id || "default";
          const usage = ctx.getContextUsage ? ctx.getContextUsage() : undefined;
          const pct = usage ? usage.percent : 0;
          const filled = Math.round(pct / 10);
          const bar = "#".repeat(filled) + "-".repeat(10 - filled);

          // Session clock
          const clock = isNarrow ? "" : theme.fg("dim", `${formatElapsed(Date.now() - state.sessionStartTime)} `);

          // Stage & Mode Badge
          const modeColor = state.mode === "plan" ? "warning" : "success";
          let modeLabel = `[${state.mode.toUpperCase()}]`;

          if (state.currentStage > 0) {
            const stageName = STAGE_NAMES[state.currentStage - 1] || "Research";
            modeLabel = isNarrow
              ? `[${state.mode.toUpperCase()}: ${state.currentStage}/5]`
              : `[${state.mode.toUpperCase()}: ${stageName} ${state.currentStage}/5]`;
          }

          const modeBadge = theme.fg(modeColor, theme.bold(modeLabel));

          // Task Ratio
          const doneTasks = state.tasks.filter((t) => t.status === "done").length;
          const taskInfo = state.tasks.length > 0 ? theme.fg("dim", `· ${doneTasks}/${state.tasks.length} Tasks`) : "";

          // Blocked Tasks
          const blockedCount = countBlocked(state.tasks);
          const blockedInfo = blockedCount > 0 ? theme.fg("warning", `· blocked:${blockedCount}`) : "";

          // Subagent Badge
          const runningSubagents = Array.from(state.activeSubagents.values()).filter((s) => s.status === "running").length;
          const subInfo = runningSubagents > 0 ? theme.fg("warning", `· 🤖 ${runningSubagents}`) : "";

          const permBadge = isNarrow ? "" : theme.fg("dim", `(${state.permissionMode})`);

          const left = ` ${theme.fg("accent", model)} ${modeBadge} ${permBadge} ${taskInfo} ${blockedInfo} ${subInfo}`;
          const right = `${clock}${theme.fg("dim", `[${bar}] ctx ${Math.round(pct)}%`)} `;

          const padLen = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
          const line = left + " ".repeat(padLen) + right;

          return [truncateToWidth(line, width)];
        },
      };
    });
  });
}
