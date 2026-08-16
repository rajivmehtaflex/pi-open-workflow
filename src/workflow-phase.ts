/** Persisted workflow-phase policy and its Pi tool adapter. */

import type { ExtensionAPI, ExtensionContext, TestExecutionState, WorkflowState, WorkflowTask, WorkflowPhase } from "./types.js";

export type WorkflowPhaseAction = "start" | "advance" | "reset";

export interface WorkflowPhaseInput {
  phase: WorkflowPhase;
  action: WorkflowPhaseAction;
  tasks?: WorkflowTask[];
  testStatus?: TestExecutionState["status"];
}

export type WorkflowPhaseResult =
  | { ok: true; phase: WorkflowPhase }
  | { ok: false; phase: WorkflowPhase; reason: string };

const NEXT_PHASE: Partial<Record<WorkflowPhase, WorkflowPhase>> = {
  clarify: "research-plan",
  "research-plan": "decompose",
  decompose: "execute",
  execute: "verify",
  verify: "complete",
};

export function advanceWorkflowPhase(input: WorkflowPhaseInput): WorkflowPhaseResult {
  if (input.action === "reset") return { ok: true, phase: "idle" };
  if (input.action === "start") {
    return input.phase === "idle"
      ? { ok: true, phase: "clarify" }
      : { ok: false, phase: input.phase, reason: `Cannot start from ${input.phase}; reset first or advance the current phase.` };
  }

  const next = NEXT_PHASE[input.phase];
  if (!next) return { ok: false, phase: input.phase, reason: `No legal advance from ${input.phase}.` };
  if (input.phase === "decompose" && (!input.tasks || input.tasks.length === 0)) {
    return { ok: false, phase: input.phase, reason: "Cannot enter Execute until at least one task exists." };
  }
  if (input.phase === "execute" && (!input.tasks || input.tasks.length === 0 || !input.tasks.every((task) => task.status === "done"))) {
    return { ok: false, phase: input.phase, reason: "Cannot enter Verify until all tasks are done." };
  }
  if (input.phase === "verify" && input.testStatus !== "passed") {
    return { ok: false, phase: input.phase, reason: "Cannot complete Verify until tests have passed." };
  }
  return { ok: true, phase: next };
}

export function registerWorkflowPhase(pi: ExtensionAPI, state: WorkflowState): void {
  pi.registerTool({
    name: "workflow_phase",
    label: "Workflow Phase",
    description: "Advance or reset the persisted workflow phase. Actions: start, advance, reset.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action: start, advance, or reset" },
      },
      required: ["action"],
    },
    async execute(_toolCallId: string, params: { action?: string }, _signal?: AbortSignal, _onUpdate?: (update: any) => void, _ctx?: ExtensionContext) {
      const action = params.action as WorkflowPhaseAction | undefined;
      if (action !== "start" && action !== "advance" && action !== "reset") {
        return { content: [{ type: "text", text: "Workflow phase refused: action must be start, advance, or reset." }] };
      }
      const result = advanceWorkflowPhase({
        action,
        phase: state.workflowPhase,
        tasks: state.tasks,
        testStatus: state.testState.status,
      });
      if (result.ok) {
        state.workflowPhase = result.phase;
        state.refreshUI?.();
        return { content: [{ type: "text", text: `Workflow phase: ${result.phase}.` }], details: result };
      }
      return { content: [{ type: "text", text: `Workflow phase refused: ${result.reason}` }], details: result };
    },
  });
}
