import { exec } from "child_process";
import { isAbsolute, resolve as resolvePath } from "node:path";
import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";
import { classifyTestResult, detectTestCommand, resolveProjectRoot } from "./test-loop-core.js";

interface CachedToolPath {
  path: string;
  keys: string[];
}

const MAX_CACHED_TOOL_PATHS = 100;

function runCommandAsync(
  command: string,
  cwd: string,
  timeoutMs = 15000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: timeoutMs }, (error: any, stdout: string, stderr: string) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
      });
    });
  });
}

function eventIdVariants(event: any): string[] {
  const ids = [
    event?.toolCallId,
    event?.tool_call_id,
    event?.callId,
    event?.call_id,
    event?.id,
    event?.toolCall?.id,
    event?.tool_call?.id,
  ];
  return [...new Set(ids.filter((id): id is string | number => typeof id === "string" || typeof id === "number").map(String))];
}

function inputPath(event: any): string | undefined {
  return typeof event?.input?.path === "string" ? event.input.path : undefined;
}

function truncateOutput(output: string): string {
  return output.length > 2000 ? `${output.slice(0, 2000)}\n... [truncated]` : output;
}

export function registerTestLoop(pi: ExtensionAPI, state: WorkflowState) {
  let autoTestEnabled = true;
  const cachedPaths = new Map<string, CachedToolPath>();

  const cacheToolPath = (event: any) => {
    const path = inputPath(event);
    const keys = eventIdVariants(event);
    if (!path || keys.length === 0) return;

    const entry = { path, keys };
    for (const key of keys) {
      const previous = cachedPaths.get(key);
      if (previous) {
        for (const previousKey of previous.keys) cachedPaths.delete(previousKey);
      }
      cachedPaths.set(key, entry);
    }

    while (cachedPaths.size > MAX_CACHED_TOOL_PATHS) {
      const oldestKey = cachedPaths.keys().next().value as string | undefined;
      if (!oldestKey) break;
      cachedPaths.delete(oldestKey);
    }
  };

  const consumeCachedPath = (event: any): string | undefined => {
    const matchingEntry = eventIdVariants(event).map((key) => cachedPaths.get(key)).find(Boolean);
    if (!matchingEntry) return undefined;
    for (const key of matchingEntry.keys) cachedPaths.delete(key);
    return matchingEntry.path;
  };

  pi.on("session_start", () => {
    cachedPaths.clear();
  });

  pi.on("tool_call", (event: any) => {
    const toolName = event?.toolName || event?.name;
    if (toolName === "edit" || toolName === "write") cacheToolPath(event);
  });

  pi.on("tool_result", async (event: any, ctx: ExtensionContext) => {
    if (!autoTestEnabled || state.mode === "plan") return;

    // Only trigger after write or edit tools.
    const toolName = event.toolName || event.name;
    if (toolName !== "edit" && toolName !== "write") return;

    const rawTargetPath = consumeCachedPath(event) || inputPath(event) || ctx.cwd;
    const targetPath = isAbsolute(rawTargetPath) ? rawTargetPath : resolvePath(ctx.cwd, rawTargetPath);
    const projectRoot = resolveProjectRoot(targetPath);
    const command = detectTestCommand(projectRoot);

    if (!command) {
      const projectDetail = projectRoot ? `project ${projectRoot}` : `target ${targetPath}`;
      const detail = `No automated test command is configured for ${projectDetail}.`;
      state.testState = {
        status: "not-configured",
        projectRoot: projectRoot || undefined,
        lastError: detail,
      };
      state.refreshUI?.();
      ctx.ui.setStatus("test-loop", "ℹ️ Automated tests not configured");
      ctx.ui.notify(detail, "warning");
      return;
    }

    state.testState = {
      status: "running",
      command: command.command,
      projectRoot: command.cwd,
    };
    state.refreshUI?.();

    ctx.ui.setStatus("test-loop", "🧪 Running automated verification...");
    const startTime = Date.now();
    const result = await runCommandAsync(command.command, command.cwd);
    const elapsed = Date.now() - startTime;
    const classified = classifyTestResult(command, result);
    const output = truncateOutput(classified.output);

    state.testState = {
      status: classified.outcome,
      command: command.command,
      projectRoot: command.cwd,
      elapsed,
      exitCode: classified.exitCode ?? undefined,
      lastError: classified.outcome === "failed" || classified.outcome === "no-tests" ? output : undefined,
      passedCount: classified.testCount,
      failedCount: classified.failedCount,
    };
    state.refreshUI?.();

    if (classified.outcome === "passed") {
      ctx.ui.setStatus("test-loop", "✅ Automated tests passed");
    } else if (classified.outcome === "no-tests") {
      ctx.ui.setStatus("test-loop", "⚠️ No automated tests collected");
      ctx.ui.notify(`⚠️ No tests were collected by \`${command.command}\` in ${command.cwd}`, "warning");
    } else if (classified.outcome === "failed") {
      ctx.ui.setStatus("test-loop", "❌ Automated tests failed!");
      ctx.ui.notify("⚠️ Post-edit test verification failed", "warning");

      // Append regression feedback directly into the turn result.
      if (event.content && Array.isArray(event.content)) {
        event.content.push({
          type: "text",
          text: `\n\n⚠️ AUTOMATED TEST FAILURE DETECTED AFTER FILE EDIT:\nCommand: \`${command.command}\`\n\nTest Output:\n\`\`\`\n${output}\n\`\`\`\nPlease fix the test regressions before completing your turn.`,
        });
      }
    } else {
      ctx.ui.setStatus("test-loop", "ℹ️ Automated tests not configured");
      ctx.ui.notify("Automated test verification is not configured", "warning");
    }
  });

  pi.registerCommand("autotest", {
    description: "Toggle automated test verification loop on file edits (on/off)",
    handler: async (_args: string | undefined, ctx: ExtensionContext) => {
      autoTestEnabled = !autoTestEnabled;
      ctx.ui.notify(`Automated test verification loop: ${autoTestEnabled ? "ENABLED" : "DISABLED"}`, "info");
    },
  });
}
