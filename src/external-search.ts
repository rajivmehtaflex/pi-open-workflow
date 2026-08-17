import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.js";

export const DEFAULT_EXA_MCP_CONFIG = {
  mcpServers: {
    exa: {
      url: "https://mcp.exa.ai/mcp",
      directTools: true,
    },
  },
};

export function getExternalSearchGuidelines(now: Date = new Date()): string {
  const currentDate = now.toISOString().split("T")[0];
  const currentYear = now.getUTCFullYear();
  const isoTime = now.toISOString();

  return `
## External Knowledge, Real-Time Temporal Grounding & Internet Search
- **Current Real-Time Context:** Today's Date is **${currentDate}** (${isoTime}, Year: **${currentYear}**).
- **Temporal Anchor:** For any time-relative query (e.g., "ongoing", "current", "latest", "today", "upcoming", "recent"), ALWAYS anchor your searches and answers to the current year (${currentYear}) and date (${currentDate}). Never search for or assume outdated years (like 2024 or 2025) unless explicitly asked by the user.
- **External Knowledge & Search:** Always use internet search for the latest information, rather than depending on internal LLM knowledge.
- **Search Provider:** Always use \`exa\` as the MCP server / internet search provider (\`web_search_exa\` / \`web_fetch_exa\`).
- **Scope:** The above search instructions apply only and only in case you require search from internet-based external knowledge.
- **Direct Output Delivery:** For analytical, research, and informational requests, execute the necessary retrieval and deliver the complete, formatted final result immediately without pausing for workflow confirmations or unnecessary conversational overhead.`;
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

  // 2. Inject dynamic search guidelines & real-time date grounding into session system prompt
  pi.on("before_agent_start", async (_event: any, _ctx: ExtensionContext) => {
    return {
      systemPrompt: getExternalSearchGuidelines(),
    };
  });
}
