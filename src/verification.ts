/**
 * record_verification -- Pi tool registration for manual verification.
 * Core logic in ./verification-core.ts (pure, tested); this file is Pi glue.
 */
import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";
import { Type } from "./types.js";
import { evaluateManualVerification } from "./verification-core.js";
import { advanceAfterTaskUpdate } from "./workflow-transition.js";

export function registerManualVerification(pi: ExtensionAPI, state: WorkflowState): void {
  pi.registerTool({
    name: "record_verification",
    label: "Record Manual Verification",
    description:
      "Record that verification was performed manually (e.g. a row-count query, a spot-check, a manual assertion) " +
      "when no automated test suite applies to the work just completed -- for example a database-seeding or " +
      "script-only task with no source-file edits, where the file-edit-triggered test loop never runs. Requires " +
      "every checklist task to be done first. Sets the same 'tests passed'/'tests failed' gate the automated " +
      "test loop would otherwise set, so Stage 4 (Verify) and the verify->complete workflow phase can proceed.",
    parameters: Type.Object({
      summary: Type.String({
        description: "What was verified and how (e.g. 'SELECT COUNT(*) FROM student = 100; all enrollment FKs valid')",
      }),
      passed: Type.Boolean({ description: "Whether the verification succeeded" }),
    }),
    async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: (u: any) => void, _ctx?: ExtensionContext) {
      const p = params as { summary?: string; passed?: boolean };
      const result = evaluateManualVerification({
        tasks: state.tasks,
        passed: p.passed === true,
        summary: p.summary ?? "",
      });
      if (!result.ok) {
        return { content: [{ type: "text", text: `record_verification refused: ${result.reason}` }] };
      }
      state.testState = {
        status: result.status,
        command: result.command,
        lastError: result.lastError,
      };
      const transitioned = advanceAfterTaskUpdate({
        currentStage: state.currentStage,
        completedStages: state.completedStages,
        tasks: state.tasks,
        testStatus: state.testState.status,
      });
      state.currentStage = transitioned.currentStage;
      state.completedStages = transitioned.completedStages;
      state.refreshUI?.();
      const icon = result.status === "passed" ? "✅" : "❌";
      return {
        content: [{ type: "text", text: `${icon} Manual verification recorded (${result.status}): ${p.summary}` }],
        details: result,
      };
    },
  });
}
