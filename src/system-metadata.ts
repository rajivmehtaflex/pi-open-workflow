import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";
import type { WorkflowState } from "./types.js";

export interface SystemInformation {
  currentDate: string;
  currentIsoTime: string;
  currentYear: number;
  timezone: string;
  os: string;
  arch: string;
  shell: string;
  userPrivilege: string;
  cwd: string;
  git?: {
    branch?: string;
    commit?: string;
    isClean?: boolean;
    remoteUrl?: string;
  };
  detectedToolchains: string[];
  workflowMode: string;
}

export function detectGitInfo(cwd: string): SystemInformation["git"] | undefined {
  try {
    const branch = child_process
      .execSync("git rev-parse --abbrev-ref HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" })
      .trim();
    const commit = child_process
      .execSync("git rev-parse --short HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" })
      .trim();
    const statusOut = child_process
      .execSync("git status --porcelain", { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" })
      .trim();
    let remoteUrl: string | undefined;
    try {
      remoteUrl = child_process
        .execSync("git config --get remote.origin.url", { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" })
        .trim();
    } catch {}

    return {
      branch: branch || undefined,
      commit: commit || undefined,
      isClean: statusOut.length === 0,
      remoteUrl: remoteUrl || undefined,
    };
  } catch {
    return undefined;
  }
}

export function detectToolchains(cwd: string): string[] {
  const toolchains: string[] = [];

  // Python ecosystem
  if (fs.existsSync(path.join(cwd, "uv.lock"))) {
    toolchains.push("Python (uv)");
  } else if (fs.existsSync(path.join(cwd, "poetry.lock"))) {
    toolchains.push("Python (poetry)");
  } else if (fs.existsSync(path.join(cwd, "Pipfile"))) {
    toolchains.push("Python (pipenv)");
  } else if (fs.existsSync(path.join(cwd, "pyproject.toml")) || fs.existsSync(path.join(cwd, "requirements.txt"))) {
    toolchains.push("Python (pip)");
  }

  if (fs.existsSync(path.join(cwd, ".venv"))) {
    toolchains.push("Active .venv");
  }

  // Node.js ecosystem
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    toolchains.push("Node.js (pnpm)");
  } else if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    toolchains.push("Node.js (yarn)");
  } else if (fs.existsSync(path.join(cwd, "bun.lockb")) || fs.existsSync(path.join(cwd, "bun.lock"))) {
    toolchains.push("Node.js (bun)");
  } else if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
    toolchains.push("Node.js (npm)");
  } else if (fs.existsSync(path.join(cwd, "package.json"))) {
    toolchains.push("Node.js");
  }

  // Rust / Go / etc.
  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) {
    toolchains.push("Rust (cargo)");
  }
  if (fs.existsSync(path.join(cwd, "go.mod"))) {
    toolchains.push("Go");
  }

  return toolchains.length > 0 ? toolchains : ["Generic"];
}

export function detectSystemInformation(
  cwd: string,
  state?: WorkflowState,
  now: Date = new Date()
): SystemInformation {
  const currentDate = now.toISOString().split("T")[0];
  const currentIsoTime = now.toISOString();
  const currentYear = now.getUTCFullYear();
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {}

  const osName = process.platform;
  const arch = process.arch;
  const shell = process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");

  let userPrivilege = "standard user";
  try {
    if (typeof (process as any).getuid === "function" && (process as any).getuid() === 0) {
      userPrivilege = "root (uid 0)";
    }
  } catch {}

  const git = detectGitInfo(cwd);
  const detectedToolchains = detectToolchains(cwd);
  const workflowMode =
    state?.mode === "act" ? "Act Mode (Full Execution)" : "Plan Mode (Exploration / Read-Only)";

  return {
    currentDate,
    currentIsoTime,
    currentYear,
    timezone,
    os: osName,
    arch,
    shell,
    userPrivilege,
    cwd: path.resolve(cwd),
    git,
    detectedToolchains,
    workflowMode,
  };
}

export function formatSystemMetadataBlock(info: SystemInformation): string {
  const gitLine = info.git
    ? `- **Git Repository:** Branch: \`${info.git.branch || "unknown"}\` | Commit: \`${info.git.commit || "none"}\` | Status: \`${info.git.isClean ? "clean" : "dirty"}\`${info.git.remoteUrl ? ` | Remote: \`${info.git.remoteUrl}\`` : ""}`
    : `- **Git Repository:** None / Not a git repo`;

  return `
## Environment & Runtime Metadata
- **Current Real-Time Context:** Today's Date is **${info.currentDate}** (${info.currentIsoTime}, Timezone: **${info.timezone}**, Year: **${info.currentYear}**).
- **Temporal Grounding:** For any time-relative query (e.g., "ongoing", "current", "latest", "today", "upcoming", "recent"), ALWAYS anchor your searches and answers to the current year (${info.currentYear}) and date (${info.currentDate}). Never search for or assume outdated years (like 2024 or 2025) unless explicitly requested.
- **Working Directory:** \`${info.cwd}\`
- **Host Environment:** OS: \`${info.os}\` (${info.arch}) | Shell: \`${info.shell}\` | Privilege: \`${info.userPrivilege}\`
${gitLine}
- **Detected Toolchains:** ${info.detectedToolchains.join(", ")}
- **Workflow State:** ${info.workflowMode}

## External Knowledge & Internet Search Guidelines
- **External Knowledge & Search:** Always use internet search for the latest information, rather than depending on internal LLM knowledge.
- **Search Provider:** Always use \`exa\` as the MCP server / internet search provider (\`web_search_exa\` / \`web_fetch_exa\`).
- **Scope:** The above search instructions apply only and only in case you require search from internet-based external knowledge.
- **Direct Output Delivery:** For analytical, research, and informational requests, execute the necessary retrieval and deliver the complete, formatted final result immediately without pausing for workflow confirmations or unnecessary conversational overhead.`.trim();
}
