import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DEFAULT_EXA_MCP_CONFIG,
  registerExternalSearch,
} from "./external-search.ts";
import type { ExtensionAPI, ExtensionContext, WorkflowState } from "./types.ts";

test("DEFAULT_EXA_MCP_CONFIG contains Exa endpoint and directTools", () => {
  assert.ok(DEFAULT_EXA_MCP_CONFIG.mcpServers.exa);
  assert.equal(DEFAULT_EXA_MCP_CONFIG.mcpServers.exa.url, "https://mcp.exa.ai/mcp");
  assert.equal(DEFAULT_EXA_MCP_CONFIG.mcpServers.exa.directTools, true);
});

test("registerExternalSearch registers before_agent_start hook that injects metadata and guidelines", async () => {
  const registeredEvents: Record<string, Function[]> = {};

  const mockPi: ExtensionAPI = {
    on: (event: string, handler: Function) => {
      if (!registeredEvents[event]) registeredEvents[event] = [];
      registeredEvents[event].push(handler);
    },
    registerTool: () => {},
    registerCommand: () => {},
  };

  const mockState = { mode: "act" } as WorkflowState;

  registerExternalSearch(mockPi, mockState);

  assert.ok(registeredEvents["before_agent_start"]);
  assert.ok(registeredEvents["before_agent_start"].length > 0);

  const handler = registeredEvents["before_agent_start"][0];
  const mockCtx = { cwd: process.cwd() } as ExtensionContext;
  const result = await handler({}, mockCtx);

  assert.ok(result);
  assert.ok(result.systemPrompt);
  assert.ok(result.systemPrompt.includes("## Environment & Runtime Metadata"));
  assert.ok(result.systemPrompt.includes("Today's Date is"));
  assert.ok(result.systemPrompt.includes("Working Directory:"));
  assert.ok(result.systemPrompt.includes("## External Knowledge & Internet Search Guidelines"));
});
