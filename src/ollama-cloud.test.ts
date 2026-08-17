import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  OLLAMA_CLOUD_PROVIDER_CONFIG,
  registerOllamaCloud,
} from "./ollama-cloud.ts";
import type { ExtensionAPI, WorkflowState } from "./types.ts";

test("OLLAMA_CLOUD_PROVIDER_CONFIG contains all requested models and settings", () => {
  assert.equal(OLLAMA_CLOUD_PROVIDER_CONFIG.name, "Ollama Cloud");
  assert.equal(OLLAMA_CLOUD_PROVIDER_CONFIG.api, "openai-completions");
  assert.equal(OLLAMA_CLOUD_PROVIDER_CONFIG.compat.supportsDeveloperRole, false);
  assert.equal(OLLAMA_CLOUD_PROVIDER_CONFIG.compat.supportsReasoningEffort, false);

  for (const model of OLLAMA_CLOUD_PROVIDER_CONFIG.models) {
    assert.ok(model.cost, `Model ${model.id} must define a cost object`);
    assert.equal(typeof model.cost.input, "number");
    assert.equal(typeof model.cost.output, "number");
  }
});

test("registerOllamaCloud calls pi.registerProvider with correct config", () => {
  let registeredName = "";
  let registeredConfig: any = null;

  const mockPi: ExtensionAPI = {
    on: () => {},
    registerTool: () => {},
    registerCommand: () => {},
    registerProvider: (name: string, config: any) => {
      registeredName = name;
      registeredConfig = config;
    },
  };

  const mockState = { mode: "act" } as WorkflowState;
  registerOllamaCloud(mockPi, mockState);

  assert.equal(registeredName, "ollama-cloud");
  assert.equal(registeredConfig.name, "Ollama Cloud");
  assert.equal(registeredConfig.models.length, 8);
});
