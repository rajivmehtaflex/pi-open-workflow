/**
 * Ollama Cloud custom provider registration for pi-open-workflow
 */

import type { ExtensionAPI, WorkflowState } from "./types.js";

const DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const OLLAMA_CLOUD_PROVIDER_CONFIG = {
  name: "Ollama Cloud",
  baseUrl: process.env.OLLAMA_CLOUD_BASE_URL || process.env.OLLAMA_BASE_URL || "https://ollama.com/v1",
  apiKey: process.env.OLLAMA_CLOUD_API_KEY ? "$OLLAMA_CLOUD_API_KEY" : "$OLLAMA_API_KEY",
  api: "openai-completions",
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  },
  models: [
    {
      id: "nemotron-3-super",
      name: "Nemotron 3 Super",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "nemotron-3-nano:30b",
      name: "Nemotron 3 Nano 30B",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "mistral-large-3:675b",
      name: "Mistral Large 3 675B",
      reasoning: false,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "nemotron-3-ultra",
      name: "Nemotron 3 Ultra",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "gemma4:31b",
      name: "Gemma 4 31B",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "qwen3.5:397b",
      name: "Qwen 3.5 397B",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "gpt-oss:120b",
      name: "GPT-oss 120B",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
    {
      id: "gpt-oss:20b",
      name: "GPT-oss 20B",
      reasoning: true,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 16384,
      cost: DEFAULT_COST,
    },
  ],
};

export function registerOllamaCloud(pi: ExtensionAPI, _state?: WorkflowState) {
  if (typeof pi.registerProvider === "function") {
    pi.registerProvider("ollama-cloud", OLLAMA_CLOUD_PROVIDER_CONFIG);
  }
}
