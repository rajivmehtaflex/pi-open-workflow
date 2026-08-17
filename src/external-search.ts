import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.ts";
import { detectSystemInformation, formatSystemMetadataBlock } from "./system-metadata.ts";

export const DEFAULT_EXA_MCP_CONFIG = {
  mcpServers: {
    exa: {
      url: "https://mcp.exa.ai/mcp",
      directTools: true,
    },
  },
};

export async function loadMcpAdapterFactory(): Promise<any> {
  try {
    const pkgName = "pi-mcp-adapter";
    // Dynamic import without pulling raw uncompiled TS types during tsc build
    const mod = await import(pkgName);
    return mod.createMcpAdapter || mod.default || null;
  } catch {
    return null;
  }
}

export function registerExternalSearch(pi: ExtensionAPI, state: WorkflowState) {
  // 1. Initialize embedded pi-mcp-adapter with default Exa MCP server payload
  loadMcpAdapterFactory()
    .then((createMcpAdapter) => {
      if (createMcpAdapter) {
        const mcpExtension = createMcpAdapter({
          config: DEFAULT_EXA_MCP_CONFIG,
        });
        mcpExtension(pi as any);
      }
    })
    .catch((err) => {
      console.error("Failed to initialize default Exa MCP adapter in pi-open-workflow:", err);
    });

  // 2. Inject comprehensive environment & real-time temporal metadata on every agent start
  pi.on("before_agent_start", async (_event: any, ctx: ExtensionContext) => {
    const info = detectSystemInformation(ctx.cwd, state);
    return {
      systemPrompt: formatSystemMetadataBlock(info),
    };
  });
}
