import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";

export const DEFAULT_EXA_MCP_CONFIG = {
  mcpServers: {
    exa: {
      url: "https://mcp.exa.ai/mcp",
      directTools: true,
    },
  },
};

export const EXTERNAL_SEARCH_GUIDELINES = `
## External Knowledge, Internet Search & Temporal Guidelines
- **External Knowledge & Search:** Always use internet search for the latest information, rather than depending on internal LLM knowledge.
- **Search Provider:** Always use \`exa\` as the MCP server / internet search provider (e.g. \`web_search_exa\` or \`web_fetch_exa\`).
- **Scope:** The above search instructions apply only and only in case you require search from internet-based external knowledge.
- **Temporal Grounding:** For time-sensitive or date-relative queries (e.g., "last 24 hours", "today", "recent news"), ground your search with the actual current date/time and use date constraints/anchors in Exa search to ensure results are strictly from the requested time window.
- **Direct Output Delivery:** For analytical, research, and informational requests, execute the necessary retrieval and deliver the complete, formatted final result immediately without pausing for workflow confirmations or unnecessary conversational overhead.`;

export function getExternalSearchGuidelines(): string {
  return EXTERNAL_SEARCH_GUIDELINES;
}

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

export function registerExternalSearch(pi: ExtensionAPI, _state: WorkflowState) {
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

  // 2. Inject search guidelines & temporal grounding into session system prompt
  pi.on("before_agent_start", async (_event: any, _ctx: ExtensionContext) => {
    return {
      systemPrompt: EXTERNAL_SEARCH_GUIDELINES,
    };
  });
}
