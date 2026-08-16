import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";

export function registerCompactionGuard(pi: ExtensionAPI, state: WorkflowState) {
  pi.on("session_before_compact", async (_event: any, ctx: ExtensionContext) => {
    ctx.ui.setStatus("compaction", "🧹 Compacting context while preserving active tasks...");

    const unfinishedTasks = state.tasks.filter((t) => t.status !== "done");
    const taskSummary = state.tasks.length > 0
      ? state.tasks.map((t) => `- [${t.status === "done" ? "x" : " "}] #${t.id}: ${t.text} (${t.status})`).join("\n")
      : "No tasks recorded.";

    const preservedState = `
## PRESERVED WORKFLOW STATE (CRITICAL - DO NOT DROP)
* **Active Workflow Mode**: ${state.mode.toUpperCase()}
* **Permission Mode**: ${state.permissionMode}
* **Pending Tasks**: ${unfinishedTasks.length} remaining
* **Task Checklist**:
${taskSummary}
`;

    return {
      customInstructions: preservedState,
    };
  });
}
