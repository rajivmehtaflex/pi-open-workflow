import type { ExtensionAPI, ExtensionContext, WorkflowState, TaskStatus } from "./types.js";
import { isToolCallEventType, Type } from "./types.js";
import { advanceAfterTaskUpdate } from "./workflow-transition.js";

const STATUS_ICONS: Record<TaskStatus, string> = {
  idle: "○",
  inprogress: "●",
  done: "✓",
};

/** ids of dependsOn entries not yet done (unknown ids ignored). */
function blockedBy(task: { dependsOn?: number[]; status: TaskStatus }, tasks: { id: number; status: TaskStatus }[]): number[] {
  return (task.dependsOn ?? []).filter((d) => {
    const dep = tasks.find((t) => t.id === d);
    return dep !== undefined && dep.status !== "done";
  });
}

export function registerPlanMode(pi: ExtensionAPI, state: WorkflowState) {
  // Tool Gating: In Plan Mode, block write & edit tools
  pi.on("tool_call", async (event: any, _ctx: ExtensionContext) => {
    if (state.mode === "plan" || state.permissionMode === "plan") {
      if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
        return {
          block: true,
          reason: `🛑 BLOCKED: You are currently in PLAN MODE (read-only). File modifications (${event.toolName || event.name}) are not allowed. Inspect the codebase, write your implementation plan, and ask the user to switch to Act Mode (/act).`,
        };
      }
    }
    return { block: false };
  });

  // Turn End Nudge: If incomplete tasks exist, remind the agent
  pi.on("agent_end", async (_event: any, ctx: ExtensionContext) => {
    const unfinished = state.tasks.filter((t) => t.status !== "done");
    if (unfinished.length > 0 && state.mode === "act") {
      const inProgress = state.tasks.filter((t) => t.status === "inprogress");
      const current = inProgress.length > 0 ? inProgress[0].text : unfinished[0].text;
      ctx.ui.setStatus("workflow-task", `Tasks: ${state.tasks.length - unfinished.length}/${state.tasks.length} done (Current: ${current.slice(0, 25)}...)`);
    }
    state.refreshUI?.();
  });

  // /plan — idempotent "enter Plan Mode" (never flips to act, never mutates stage)
  pi.registerCommand("plan", {
    description: "Enter Plan Mode (read-only research & plan drafting). Idempotent.",
    handler: async (_args: string | undefined, ctx: ExtensionContext) => {
      if (state.mode === "plan") {
        ctx.ui.notify("Already in PLAN MODE — read-only exploration enabled.", "info");
        return;
      }
      state.mode = "plan";
      ctx.ui.notify("📋 Switched to PLAN MODE: Read-only exploration & plan drafting.", "info");
      state.refreshUI?.();
    },
  });

  // /act — explicit "enter Act Mode" (stage untouched; work moves the stage)
  pi.registerCommand("act", {
    description: "Enter Act Mode (execution, write enabled). Idempotent.",
    handler: async (_args: string | undefined, ctx: ExtensionContext) => {
      if (state.mode === "act") {
        ctx.ui.notify("Already in ACT MODE — full write & execution enabled.", "info");
      } else {
        state.mode = "act";
        ctx.ui.notify("🚀 Switched to ACT MODE: Full write & execution enabled.", "info");
      }
      state.refreshUI?.();
    },
  });

  // Task tool: programmatic agent task tracking with stage stamping + dependency gating
  pi.registerTool({
    name: "task_checklist",
    label: "Task Checklist",
    description:
      "Manage structured tasks and checklists. Actions: add (create tasks with optional priority + dependsOn), update (change status: idle, inprogress, done — refused while dependencies are not done unless force), list (view all), clear.",
    parameters: Type.Object({
      action: Type.String({ description: "Action: add, update, list, clear" }),
      text: Type.Optional(Type.String({ description: "Task description (for add)" })),
      texts: Type.Optional(Type.Array(Type.String(), { description: "Batch task descriptions (for add)" })),
      id: Type.Optional(Type.Number({ description: "Task ID (for update)" })),
      status: Type.Optional(Type.String({ description: "Target status (idle, inprogress, done)" })),
      priority: Type.Optional(Type.String({ description: "Priority (for add): P0 blocker, P1 core, P2 nice-to-have" })),
      dependsOn: Type.Optional(Type.Array(Type.Number(), { description: "Task IDs that must be done before this task starts (for add)" })),
      force: Type.Optional(Type.Boolean({ description: "Bypass dependency gating (for update)" })),
    }),
    async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: (u: any) => void, ctx?: ExtensionContext) {
      const p = params as {
        action: string;
        text?: string;
        texts?: string[];
        id?: number;
        status?: string;
        priority?: string;
        dependsOn?: number[];
        force?: boolean;
      };

      if (ctx && p.action === "add") {
        const toAdd = p.texts || (p.text ? [p.text] : []);
        if (toAdd.length === 0) {
          return { content: [{ type: "text", text: "No task text provided. Pass text or texts." }] };
        }
        const validPriorities = ["P0", "P1", "P2"];
        const priority = validPriorities.includes(p.priority ?? "") ? (p.priority as "P0" | "P1" | "P2") : undefined;
        // Validate dependsOn: must reference existing tasks, no self-reference (ids assigned below)
        const known = new Set(state.tasks.map((t) => t.id));
        const dependsOn = (p.dependsOn ?? []).filter((d) => known.has(d) && d !== state.nextTaskId);
        for (const item of toAdd) {
          state.tasks.push({
            id: state.nextTaskId,
            text: item,
            status: "idle",
            stage: state.currentStage > 0 ? state.currentStage : 2, // default stamp: Plan stage
            ...(priority ? { priority } : {}),
            ...(dependsOn.length > 0 ? { dependsOn } : {}),
          });
          state.nextTaskId++;
        }
        if (state.currentStage < 2) state.currentStage = 2; // Plan stage — tasks now exist, no fabrication beyond visibility
        state.refreshUI?.();
        return {
          content: [{ type: "text", text: `Added ${toAdd.length} task(s)${priority ? ` [${priority}]` : ""}${dependsOn.length > 0 ? ` (depends on: ${dependsOn.join(", ")})` : ""}.` }],
          details: { count: state.tasks.length },
        };
      } else if (ctx && p.action === "update" && typeof p.id === "number" && p.status) {
        const target = state.tasks.find((t) => t.id === p.id);
        if (!target) {
          return { content: [{ type: "text", text: `Task #${p.id} not found.` }] };
        }
        // Dependency gate: inprogress refused while deps not done (force bypasses)
        if (p.status === "inprogress" && !p.force) {
          const blockers = blockedBy(target, state.tasks);
          if (blockers.length > 0) {
            return {
              content: [{ type: "text", text: `⛔ Task #${p.id} is blocked by unfinished dependencies: ${blockers.map((b) => `#${b}`).join(", ")}. Finish them first, or pass force:true.` }],
            };
          }
        }
        target.status = p.status as TaskStatus;

        // Stage advances only on real work — never on keystrokes.
        if (p.status === "inprogress" && state.currentStage < 3) state.currentStage = 3; // Act stage: work has begun

        // Apply pure workflow transition policy using the live checklist and test state.
        const transitioned = advanceAfterTaskUpdate({
          currentStage: state.currentStage,
          completedStages: state.completedStages,
          tasks: state.tasks,
          testStatus: state.testState.status,
        });
        state.currentStage = transitioned.currentStage;
        state.completedStages = transitioned.completedStages;

        state.refreshUI?.();
        return {
          content: [{ type: "text", text: `Task #${p.id} updated to [${p.status}].` }],
          details: { task: target },
        };
      } else if (ctx && p.action === "clear") {
        state.tasks = [];
        state.completedStages.clear();
        state.refreshUI?.();
        return { content: [{ type: "text", text: "Checklist cleared." }] };
      }

      // Default: list
      const summary = state.tasks
        .map((t) => {
          const icons = STATUS_ICONS[t.status];
          const prio = t.priority ? ` [${t.priority}]` : "";
          const blocked = blockedBy(t, state.tasks);
          const suffix = blocked.length > 0 ? ` (blocked by ${blocked.map((b) => `#${b}`).join(", ")})` : "";
          return `[${icons}] #${t.id}${prio}: ${t.text}${suffix}`;
        })
        .join("\n");
      return {
        content: [{ type: "text", text: summary || "No active tasks in checklist." }],
        details: { tasks: state.tasks },
      };
    },
  });
}
