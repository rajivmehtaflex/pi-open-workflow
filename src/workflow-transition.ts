import type { PipelineStage, TestExecutionState, WorkflowTask } from "./types.ts";

export interface WorkflowTransitionState {
  currentStage: PipelineStage;
  completedStages: Set<number>;
  tasks: WorkflowTask[];
  testStatus: TestExecutionState["status"];
}

export function advanceAfterTaskUpdate(state: WorkflowTransitionState): WorkflowTransitionState {
  const completedStages = new Set(state.completedStages);
  const stampedStages = new Set(state.tasks.map((task) => task.stage ?? 2));

  for (const stage of stampedStages) {
    if (stage === 4) continue; // Verify is a meta-stage: gated by test status below, never by a stamped task
    const stageTasks = state.tasks.filter((task) => (task.stage ?? 2) === stage);
    if (!stageTasks.length || !stageTasks.every((task) => task.status === "done")) continue;
    completedStages.add(stage);
  }

  const allTasksDone = state.tasks.length > 0 && state.tasks.every((task) => task.status === "done");
  if (allTasksDone && state.testStatus === "passed") completedStages.add(4);

  const currentStage = allTasksDone && state.currentStage < 4 ? 4 : state.currentStage;

  return { ...state, currentStage, completedStages };
}
