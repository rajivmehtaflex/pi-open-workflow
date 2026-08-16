import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function findMemoryFiles(cwd: string): string[] {
  const memoryFiles: string[] = [];
  const homeDir = os.homedir();

  // 1. Global Claude memory: ~/.claude/CLAUDE.md or ~/.claude.md
  const globalClaude = path.join(homeDir, ".claude", "CLAUDE.md");
  if (fs.existsSync(globalClaude)) memoryFiles.push(globalClaude);

  // 2. Upward traversal from cwd to find project memory
  let current = path.resolve(cwd);
  const candidates: string[] = [];
  while (true) {
    const claudeMd = path.join(current, "CLAUDE.md");
    const agentsMd = path.join(current, "AGENTS.md");
    if (fs.existsSync(claudeMd) && !memoryFiles.includes(claudeMd)) candidates.unshift(claudeMd);
    if (fs.existsSync(agentsMd) && !memoryFiles.includes(agentsMd)) candidates.unshift(agentsMd);

    const parent = path.dirname(current);
    if (parent === current || current === homeDir) break;
    current = parent;
  }

  memoryFiles.push(...candidates);
  return memoryFiles;
}

export function registerMemoryCascade(pi: ExtensionAPI, _state: WorkflowState) {
  pi.on("before_agent_start", async (_event: any, ctx: ExtensionContext) => {
    const memoryFiles = findMemoryFiles(ctx.cwd);
    if (memoryFiles.length === 0) return;

    const sections: string[] = [];
    for (const f of memoryFiles) {
      try {
        const content = fs.readFileSync(f, "utf8").trim();
        if (content) {
          const relPath = path.relative(ctx.cwd, f);
          sections.push(`### Memory from ${relPath || f}\n${content}`);
        }
      } catch {}
    }

    if (sections.length > 0) {
      const memoryHeader = `\n\n## Project Context & Memory (Cascading CLAUDE.md / AGENTS.md)\n${sections.join("\n\n")}`;
      return {
        systemPrompt: memoryHeader,
      };
    }
  });
}
