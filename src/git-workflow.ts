import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";
import { exec } from "child_process";

function execPromise(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error: any, stdout: string, stderr: string) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
      });
    });
  });
}

export function registerGitWorkflow(pi: ExtensionAPI, _state: WorkflowState) {
  pi.registerCommand("commit", {
    description: "Inspect staged changes and generate a semantic Conventional Commit",
    handler: async (_args: string | undefined, ctx: ExtensionContext) => {
      const statusRes = await execPromise("git status --short", ctx.cwd);
      if (!statusRes.stdout.trim()) {
        ctx.ui.notify("No changes detected in working tree.", "warning");
        return;
      }

      const diffRes = await execPromise("git diff --staged", ctx.cwd);
      if (!diffRes.stdout.trim()) {
        if (ctx.ui.confirm) {
          const confirmStage = await ctx.ui.confirm(
            "Git Commit",
            "No changes currently staged. Do you want to stage all modified tracked files (`git add -u`)?"
          );
          if (confirmStage) {
            await execPromise("git add -u", ctx.cwd);
          } else {
            ctx.ui.notify("Aborted commit: no staged changes.", "info");
            return;
          }
        }
      }

      if (pi.sendUserMessage) {
        pi.sendUserMessage(
          "Please inspect `git status` and `git diff --staged` and generate a concise Conventional Commit message (e.g. feat:, fix:, refactor:). Confirm with me before committing."
        );
      }
    },
  });

  pi.registerCommand("pr", {
    description: "Prepare and create a GitHub pull request for the active branch",
    handler: async (args: string | undefined, _ctx: ExtensionContext) => {
      const baseBranch = args?.trim() || "main";
      if (pi.sendUserMessage) {
        pi.sendUserMessage(
          `Please inspect the current branch commits and diff against '${baseBranch}', generate a structured PR description, and ask for confirmation before executing \`gh pr create\`.`
        );
      }
    },
  });
}
