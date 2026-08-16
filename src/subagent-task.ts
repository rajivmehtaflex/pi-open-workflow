import type { ExtensionAPI, ExtensionContext, WorkflowState, SubagentInfo } from "./types.js";
import { Type } from "./types.js";
import { resolveSubagentMode, readOnlyNotice, SUBAGENT_MODE_ENV, type ParentMode } from "./subagent-mode.js";
import { spawn } from "child_process";

interface SubagentResult {
  output: string;
  exitCode: number;
  elapsed: number;
}

function runSubagentProcess(task: string, role: string, model: string | undefined, cwd: string, parentMode: ParentMode): Promise<SubagentResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = ["-p", "--no-session"];
    if (model) args.push("--model", model);
    args.push(`[Role: ${role.toUpperCase()}] ${task}`);

    const child = spawn("pi", args, {
      cwd,
      env: { ...process.env, [SUBAGENT_MODE_ENV]: resolveSubagentMode(role, parentMode) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: any) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: any) => {
      stderr += chunk.toString();
    });

    child.on("close", (code: number | null) => {
      resolve({
        output: (stdout || stderr).trim(),
        exitCode: code ?? 0,
        elapsed: Date.now() - startTime,
      });
    });

    child.on("error", (err: Error) => {
      resolve({
        output: `Failed to spawn subagent: ${err.message}`,
        exitCode: 1,
        elapsed: Date.now() - startTime,
      });
    });
  });
}

export function registerSubagentTask(pi: ExtensionAPI, state: WorkflowState) {
  pi.registerTool({
    name: "Task",
    label: "Task (Subagent)",
    description: "Launch an isolated subagent to perform research, exploration, or execution without cluttering the main conversation context.",
    parameters: Type.Object({
      task: Type.String({ description: "The task description and instructions for the subagent" }),
      role: Type.Optional(Type.String({ description: "Subagent role: explore (read-only), plan, bash, general (default)" })),
      model: Type.Optional(Type.String({ description: "Optional model override for the subagent" })),
    }),
    async execute(_toolCallId: string, params: any, _signal?: AbortSignal, onUpdate?: (u: any) => void, ctx?: ExtensionContext) {
      const { task, role = "general", model } = params as { task: string; role?: string; model?: string };
      const subagentId = `sub-${Date.now()}`;

      // Update pipeline stage to Research (1) if early in the turn
      if (state.tasks.length === 0 && state.currentStage === 1) {
        state.currentStage = 1;
      }

      const info: SubagentInfo = { role, task, status: "running", elapsed: 0 };
      state.activeSubagents.set(subagentId, info);
      state.refreshUI?.();

      if (ctx) ctx.ui.setStatus("subagent", `🤖 Subagent [${role}] working...`);

      if (onUpdate) {
        onUpdate({
          content: [{ type: "text", text: `🤖 Launched [${role}] subagent...` }],
          details: { subagentId, role, status: "running" },
        });
      }

      const cwd = ctx ? ctx.cwd : process.cwd();
      const result = await runSubagentProcess(task, role, model, cwd, state.mode);
      const isOk = result.exitCode === 0;

      const completedInfo: SubagentInfo = {
        role,
        task,
        status: isOk ? "done" : "error",
        elapsed: result.elapsed,
        lastOutput: result.output.slice(0, 100),
      };

      state.activeSubagents.delete(subagentId);
      state.lastSubagent = completedInfo;
      state.refreshUI?.();

      if (ctx) ctx.ui.setStatus("subagent", `🤖 Subagent [${role}] ${isOk ? "done" : "failed"} (${Math.round(result.elapsed / 1000)}s)`);

      const notice = readOnlyNotice(role, state.mode) ?? "";
      const truncated = result.output.length > 6000
        ? result.output.slice(0, 6000) + "\n... [Output truncated for context efficiency]"
        : result.output;

      return {
        content: [
          {
            type: "text",
            text: `### Subagent [${role}] Execution Result (${Math.round(result.elapsed / 1000)}s):\n\n${truncated || "Subagent finished with no output."}${notice}`,
          },
        ],
        details: {
          subagentId,
          role,
          exitCode: result.exitCode,
          elapsed: result.elapsed,
        },
      };
    },
  });
}
