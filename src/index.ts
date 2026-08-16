/**
 * pi-open-workflow — Full open-source agentic workflow experience for Pi
 */

import type { ExtensionAPI, WorkflowState } from "./types.js";
import { registerPlanMode } from "./plan-mode.js";
import { registerSafetyGuard } from "./safety-guard.js";
import { registerTestLoop } from "./test-loop.js";
import { registerMemoryCascade } from "./memory-cascade.js";
import { registerCompactionGuard } from "./compaction-guard.js";
import { registerGitWorkflow } from "./git-workflow.js";
import { registerSubagentTask } from "./subagent-task.js";
import { registerStatusline } from "./statusline.js";
import { registerDashboard } from "./ui-dashboard.js";
import { registerAskUserQuestion } from "./ask-user.js";
import { registerWorkflowPhase } from "./workflow-phase.js";
import { registerManualVerification } from "./verification.js";
import { SUBAGENT_MODE_ENV } from "./subagent-mode.js";

export * from "./types.js";
export * from "./ui-dashboard.js";

export default function (pi: ExtensionAPI) {
  // Subagent sessions spawned by the Task tool inherit the parent's mode via env
  // (default remains Plan Mode for safe exploration of fresh top-level sessions).
  const inheritedMode = process.env[SUBAGENT_MODE_ENV] === "act" ? "act" : "plan";
  const state: WorkflowState = {
    mode: inheritedMode,
    permissionMode: "default",
    currentStage: 0, // Clean slate / idle on startup
    stageStartTime: Date.now(),
    completedStages: new Set<number>(),
    sessionStartTime: Date.now(),
    tasks: [],
    nextTaskId: 1,
    safetyRules: {
      bashToolPatterns: [],
      zeroAccessPaths: [],
      readOnlyPaths: [],
      noDeletePaths: [],
    },
    activeSubagents: new Map(),
    testState: {
      status: "idle",
    },
    workflowPhase: "idle",
  };

  // Register dashboard widget & all workflow sub-engines
  registerDashboard(pi, state);
  registerPlanMode(pi, state);
  registerSafetyGuard(pi, state);
  registerTestLoop(pi, state);
  registerMemoryCascade(pi, state);
  registerCompactionGuard(pi, state);
  registerGitWorkflow(pi, state);
  registerSubagentTask(pi, state);
  registerStatusline(pi, state);
  registerAskUserQuestion(pi, state);
  registerWorkflowPhase(pi, state);
  registerManualVerification(pi, state);
}
