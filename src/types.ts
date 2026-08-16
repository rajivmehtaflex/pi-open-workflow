/**
 * Shared types and standalone helpers for pi-open-workflow
 */

export type WorkflowMode = "plan" | "act";

export type WorkflowPhase = "idle" | "clarify" | "research-plan" | "decompose" | "execute" | "verify" | "complete";

export type PermissionMode = "plan" | "default" | "acceptEdits" | "dontAsk" | "bypassPermissions";

export type TaskStatus = "idle" | "inprogress" | "done";

export type PipelineStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface WorkflowTask {
  id: number;
  text: string;
  status: TaskStatus;
  stage?: number;
  priority?: "P0" | "P1" | "P2";
  dependsOn?: number[];
}

export interface SafetyRule {
  pattern: string;
  reason: string;
  ask?: boolean;
}

export interface SafetyRules {
  bashToolPatterns: SafetyRule[];
  zeroAccessPaths: string[];
  readOnlyPaths: string[];
  noDeletePaths: string[];
}

export interface SubagentInfo {
  role: string;
  task: string;
  status: "running" | "done" | "error";
  elapsed: number;
  tokens?: number;
  lastOutput?: string;
}

export interface TestExecutionState {
  status: "idle" | "running" | "passed" | "failed" | "no-tests" | "not-configured";
  command?: string;
  passedCount?: number;
  failedCount?: number;
  elapsed?: number;
  lastError?: string;
  projectRoot?: string;
  exitCode?: number;
}

export interface WorkflowState {
  mode: WorkflowMode;
  permissionMode: PermissionMode;
  currentStage: PipelineStage;
  stageStartTime: number;
  completedStages: Set<number>;
  sessionStartTime: number;
  tasks: WorkflowTask[];
  nextTaskId: number;
  safetyRules: SafetyRules;
  activeSubagents: Map<string, SubagentInfo>;
  lastSubagent?: SubagentInfo;
  testState: TestExecutionState;
  workflowPhase: WorkflowPhase;
  refreshUI?: () => void;
}

export interface Theme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
  dim(text: string): string;
  [key: string]: any;
}

export interface ExtensionUIContext {
  notify(message: string, level?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string): void;
  setWidget?(key: string, component: any): void;
  setFooter?(component: (tui: any, theme: Theme, footerData?: any) => { dispose(): void; invalidate(): void; render(width: number): string[] }): void;
  confirm?(title: string, message: string, options?: any): Promise<boolean>;
  select?(title: string, options: string[]): Promise<string | undefined>;
  input?(title: string, placeholder?: string): Promise<string | undefined>;
  custom?(renderFn: any): void;
}

export interface ExtensionContext {
  ui: ExtensionUIContext;
  cwd: string;
  model?: { id?: string; contextWindow?: number; [key: string]: any };
  getContextUsage?(): { percent: number; [key: string]: any };
  [key: string]: any;
}

export interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters: any;
  execute: (
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
    onUpdate?: (update: any) => void,
    ctx?: ExtensionContext
  ) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    details?: any;
  }>;
}

export interface CommandDefinition {
  description: string;
  handler: (args: string | undefined, ctx: ExtensionContext) => Promise<string | void> | string | void;
}

export interface ExtensionAPI {
  on(
    event: string,
    handler: (event: any, ctx: ExtensionContext) => Promise<any> | any
  ): void;
  registerTool(tool: ToolDefinition): void;
  registerCommand(name: string, command: CommandDefinition): void;
  registerShortcut?(shortcut: string, options: { description: string; handler: (ctx: ExtensionContext) => void }): void;
  sendUserMessage?(message: string): void;
}

// Standalone JSON Schema builder (compatible with TypeBox syntax)
export const Type = {
  Object: (properties: Record<string, any>, options?: any) => ({ type: "object", properties, ...options }),
  String: (options?: any) => ({ type: "string", ...options }),
  Number: (options?: any) => ({ type: "number", ...options }),
  Integer: (options?: any) => ({ type: "integer", ...options }),
  Boolean: (options?: any) => ({ type: "boolean", ...options }),
  Array: (items: any, options?: any) => ({ type: "array", items, ...options }),
  Optional: (schema: any) => schema,
};

export function isToolCallEventType(toolName: string, event: any): boolean {
  return event && (event.toolName === toolName || event.name === toolName);
}

export function visibleWidth(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function truncateToWidth(str: string, width: number): string {
  if (visibleWidth(str) <= width) return str;
  let len = 0;
  let result = "";
  let inEscape = false;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\x1b") {
      inEscape = true;
      result += str[i];
      continue;
    }
    if (inEscape) {
      result += str[i];
      if (str[i] === "m") inEscape = false;
      continue;
    }
    if (len >= width - 3) {
      result += "...";
      break;
    }
    result += str[i];
    len++;
  }
  return result;
}
