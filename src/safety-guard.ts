import type { ExtensionAPI, ExtensionContext, SafetyRules, WorkflowState } from "./types.js";
import { isToolCallEventType } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const DEFAULT_SAFETY_RULES: SafetyRules = {
  bashToolPatterns: [
    { pattern: "(^|\\s|;)rm\\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\\s+--force)\\s+", reason: "Recursive forced deletion (rm -rf) detected", ask: true },
    { pattern: "git\\s+reset\\s+--hard", reason: "Destructive git reset --hard detected", ask: true },
    { pattern: "git\\s+clean\\s+-fd", reason: "Destructive git clean -fd detected", ask: true },
    { pattern: "DROP\\s+(DATABASE|TABLE)", reason: "Destructive database DROP statement detected", ask: true },
    { pattern: "aws\\s+s3\\s+rm\\s+.*--recursive", reason: "AWS S3 recursive delete detected", ask: true },
  ],
  zeroAccessPaths: [".env", ".env.local", ".env.production", "~/.ssh", "*.pem", "*.key"],
  readOnlyPaths: ["package-lock.json", "bun.lock", "uv.lock", "/etc"],
  noDeletePaths: [".git", "Dockerfile", "README.md", "pyproject.toml", "package.json"],
};

function resolvePath(p: string, cwd: string): string {
  if (p.startsWith("~")) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(cwd, p);
}

function isPathMatch(targetPath: string, pattern: string, cwd: string): boolean {
  const resolvedPattern = pattern.startsWith("~") ? path.join(os.homedir(), pattern.slice(1)) : pattern;
  if (resolvedPattern.endsWith("/")) {
    const absolutePattern = path.isAbsolute(resolvedPattern) ? resolvedPattern : path.resolve(cwd, resolvedPattern);
    return targetPath.startsWith(absolutePattern);
  }
  const regexPattern = resolvedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`);
  const relativePath = path.relative(cwd, targetPath);
  return regex.test(targetPath) || regex.test(relativePath) || targetPath.includes(resolvedPattern) || relativePath.includes(resolvedPattern);
}

export function registerSafetyGuard(pi: ExtensionAPI, state: WorkflowState) {
  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    state.safetyRules = { ...DEFAULT_SAFETY_RULES };
    const projectRulesPath = path.join(ctx.cwd, ".pi", "damage-control-rules.yaml");
    const globalRulesPath = path.join(os.homedir(), ".pi", "damage-control-rules.yaml");
    const rulesPath = fs.existsSync(projectRulesPath) ? projectRulesPath : fs.existsSync(globalRulesPath) ? globalRulesPath : null;

    if (rulesPath) {
      try {
        const content = fs.readFileSync(rulesPath, "utf8");
        const lines = content.split("\n");
        let currentSection: keyof SafetyRules | null = null;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("bashToolPatterns:")) currentSection = "bashToolPatterns";
          else if (trimmed.startsWith("zeroAccessPaths:")) currentSection = "zeroAccessPaths";
          else if (trimmed.startsWith("readOnlyPaths:")) currentSection = "readOnlyPaths";
          else if (trimmed.startsWith("noDeletePaths:")) currentSection = "noDeletePaths";
          else if (trimmed.startsWith("- ") && currentSection && currentSection !== "bashToolPatterns") {
            const val = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, "");
            if (!state.safetyRules[currentSection].includes(val)) {
              state.safetyRules[currentSection].push(val);
            }
          }
        }
        ctx.ui.notify("🛡️ Open Workflow: Safety rules active", "info");
      } catch (err) {
        ctx.ui.notify(`⚠️ Failed to parse custom safety rules: ${err}`, "warning");
      }
    }
  });

  pi.on("tool_call", async (event: any, ctx: ExtensionContext) => {
    if (state.permissionMode === "bypassPermissions" || state.permissionMode === "dontAsk") {
      return { block: false };
    }

    const inputPaths: string[] = [];
    if (isToolCallEventType("read", event) || isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      if (event.input?.path) inputPaths.push(event.input.path);
    } else if (isToolCallEventType("grep", event) || isToolCallEventType("find", event) || isToolCallEventType("ls", event)) {
      if (event.input?.path) inputPaths.push(event.input.path);
    }

    // 1. Zero Access Path Check
    for (const p of inputPaths) {
      const resolved = resolvePath(p, ctx.cwd);
      for (const zap of state.safetyRules.zeroAccessPaths) {
        if (isPathMatch(resolved, zap, ctx.cwd)) {
          ctx.ui.notify(`🛑 Blocked access to restricted file: ${zap}`, "error");
          return {
            block: true,
            reason: `🛑 BLOCKED: Access to zero-access path restricted: ${zap}. Do not attempt to bypass this path.`,
          };
        }
      }
    }

    // 2. Read-Only Paths for write/edit
    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      for (const p of inputPaths) {
        const resolved = resolvePath(p, ctx.cwd);
        for (const rop of state.safetyRules.readOnlyPaths) {
          if (isPathMatch(resolved, rop, ctx.cwd)) {
            return {
              block: true,
              reason: `🛑 BLOCKED: Modification of read-only system file is prohibited: ${rop}`,
            };
          }
        }
      }
    }

    // 3. Bash tool pattern screening
    if (isToolCallEventType("bash", event)) {
      const cmd = event.input?.command || "";
      for (const rule of state.safetyRules.bashToolPatterns) {
        const regex = new RegExp(rule.pattern, "i");
        if (regex.test(cmd)) {
          if (rule.ask && ctx.ui.confirm) {
            const confirmed = await ctx.ui.confirm(
              "🛡️ Safety Gating Confirmation",
              `Potentially destructive command detected: ${rule.reason}\n\nCommand:\n${cmd}\n\nDo you want to proceed?`
            );
            if (!confirmed) {
              return {
                block: true,
                reason: `🛑 BLOCKED by user: ${rule.reason}. The user declined execution of this command.`,
              };
            }
          } else {
            return {
              block: true,
              reason: `🛑 BLOCKED: ${rule.reason}`,
            };
          }
        }
      }
    }

    return { block: false };
  });

  pi.registerCommand("permission", {
    description: "Switch permission mode (plan, default, acceptEdits, dontAsk, bypassPermissions)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      const mode = args?.trim() as typeof state.permissionMode;
      const valid = ["plan", "default", "acceptEdits", "dontAsk", "bypassPermissions"];
      if (mode && valid.includes(mode)) {
        state.permissionMode = mode;
        ctx.ui.notify(`Permission mode set to: ${mode}`, "info");
      } else if (ctx.ui.select) {
        const selected = await ctx.ui.select("Select Permission Mode", valid);
        if (selected) {
          state.permissionMode = selected as typeof state.permissionMode;
          ctx.ui.notify(`Permission mode set to: ${selected}`, "info");
        }
      }
    },
  });
}
