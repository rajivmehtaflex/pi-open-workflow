# pi-open-workflow

[![Release](https://img.shields.io/badge/release-v0.1.9-blue.svg)](https://github.com/rajivmehtaflex/pi-open-workflow/releases/tag/v0.1.9)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org)
[![Pi Coding Agent](https://img.shields.io/badge/Pi-Coding%20Agent-purple.svg)](https://pi.dev)

A complete **open-source agentic workflow harness** for the [Pi Coding Agent](https://pi.dev). `pi-open-workflow` brings spec-driven execution, Plan/Act modes, interactive questionnaires, automated test verification, hierarchical memory, isolated research subagents, and built-in cloud model provider integration directly into your Pi sessions.

---

## 🌟 Key Features

* **🎯 Plan Mode & Act Mode (`/plan`, `/act`)**: Idempotent read-only exploration and plan drafting separate from execution mode, enforced with path and tool safety guards.
* **📋 Spec-Driven 5-Phase Pipeline (`/workflow`, `/openflow`)**: Structured lifecycle chaining **Clarify → Research/Plan → Decompose → Execute → Verify** with strict phase-transition gating.
* **📊 Real-Time Tabular Task Dashboard**: Borderless, column-aligned task table (`# / PRI / STATUS / STAGE / TASK / DEPS`) with glyph+text status cells, 5-stage pipeline strip, and width-aware truncation that handles wide unicode glyphs seamlessly.
* **🛡️ 5-Mode Safety & Damage Control (`/permission`)**: Granular security controls (`plan`, `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`) with bash screening and protected path boundaries (`zeroAccess`, `readOnly`, `noDelete`).
* **🧪 Automated Post-Edit Test Loop (`/autotest`)**: Automatically executes `pytest` or `npm test` after file edits and feeds regression errors directly back to the model.
* **✅ Manual Verification Gate (`record_verification`)**: Record verified assertions for database migrations, config tweaks, or script runs to clear the verification stage without source edits.
* **🤖 Isolated Subagent Task Tool (`Task`)**: Spawns isolated child `pi` processes for deep research without polluting your main session context, complete with live telemetry monitoring.
* **❓ Interactive Questionnaires (`ask_user_question`)**: Structured modal dialogs for clarifying ambiguous requirements (single-select, multi-select, free-text write-in).
* **🧠 Cascading Project Memory & Compaction Guard**: Automatically cascades instructions from `~/.claude/CLAUDE.md`, `./CLAUDE.md`, and `./AGENTS.md`, and preserves task checklists across context compaction events.
* **🌐 Dynamic Runtime Environment Grounding**: Injects live UTC timestamps, host OS, architecture, and toolchain metadata (Node, Python, Rust, Go) into model prompts.
* **☁️ Built-in Ollama Cloud Provider**: Instant zero-config support for 8 curated models (Gemma 4, Nemotron 3, Qwen 3.5, GPT-oss, Mistral Large 3) with thinking and cost accounting.
* **🐙 Semantic Git Lifecycle (`/commit`, `/pr`)**: Automated conventional commit message generation and pull request drafting from staged changes.

---

## 📦 Installation

### Prerequisites
* **Node.js**: `>= 20.0.0` (utilizes native `node:sqlite` and `node:test`)
* **Pi Coding Agent**: Installed and accessible in your `$PATH`

### 1. Install at Project Level (Recommended)
Install directly into your current workspace:

```bash
pi install git:github.com/rajivmehtaflex/pi-open-workflow@v0.1.9 -l
```

### 2. Install at Global Level
Install globally for all Pi projects on your machine:

```bash
pi install git:github.com/rajivmehtaflex/pi-open-workflow@v0.1.9
```

Verify your installation:
```bash
pi list -a
```

---

## ☁️ Built-in Ollama Cloud Provider & Models

`pi-open-workflow` automatically registers the `ollama-cloud` provider with full reasoning and tool support.

### Supported Models

| Model Name | Model ID | Reasoning / Thinking | Context Window | Max Output |
| :--- | :--- | :---: | :---: | :---: |
| **Gemma 4 31B** | `gemma4:31b` | ✅ Yes (Text + Image) | 128k | 16k |
| **Nemotron 3 Super** | `nemotron-3-super` | ✅ Yes | 128k | 16k |
| **Nemotron 3 Nano 30B** | `nemotron-3-nano:30b` | ✅ Yes | 128k | 16k |
| **Nemotron 3 Ultra** | `nemotron-3-ultra` | ✅ Yes | 128k | 16k |
| **Qwen 3.5 397B** | `qwen3.5:397b` | ✅ Yes | 128k | 16k |
| **GPT-oss 120B** | `gpt-oss:120b` | ✅ Yes | 128k | 16k |
| **GPT-oss 20B** | `gpt-oss:20b` | ✅ Yes | 128k | 16k |
| **Mistral Large 3 675B**| `mistral-large-3:675b` | ❌ No | 128k | 16k |

### Usage & Setup

1. **Set your API Key**:
   ```bash
   export OLLAMA_API_KEY="your-ollama-api-key"
   # or export OLLAMA_CLOUD_API_KEY="your-ollama-api-key"
   ```

2. **List Available Models**:
   ```bash
   pi --list-models ollama-cloud
   ```

3. **Run with Model & High Thinking**:
   ```bash
   pi --model ollama-cloud/nemotron-3-super:high
   ```

*(To point to a custom or local Ollama host, export `OLLAMA_CLOUD_BASE_URL="http://localhost:11434/v1"`).*

---

## 🚀 End-to-End Workflow Guide

### 1. Exploration in Plan Mode
Start in safe, read-only mode to explore the codebase and draft requirements without accidental file changes:
```
/plan
"Explore the auth module and analyze how token refresh is implemented."
```

### 2. Spec-Driven Execution with `/workflow`
Switch to execution mode and run the structured pipeline:
```
/act
/workflow Add JWT token rotation with a 15-minute expiration and Redis blacklist store.
```

1. **Phase 1: Clarify**: `ask_user_question` triggers if details are missing.
2. **Phase 2: Research & Plan**: Synthesizes architecture and requirements.
3. **Phase 3: Decompose**: `task_checklist` creates dependency-ordered tasks with priority tags (`[P0]`, `[P1]`).
4. **Phase 4: Execute**: Executes tasks sequentially. The dashboard tracks progress in real time.
5. **Phase 5: Verify**: Tests run automatically (`/autotest`) or manual verification is recorded (`record_verification`).

### 3. Automated & Manual Verification
* **Auto-Testing**: Toggle with `/autotest`. Every code edit runs your test suite (`npm test` / `pytest`).
* **Manual Verification**: For database or infrastructure tasks:
  ```
  call record_verification with summary "Migration completed: verified 100 rows" and passed: true
  ```

### 4. Git Automation
Once verified, generate commit messages and PR descriptions:
```bash
git add -A
```
In Pi chat:
```
/commit
/pr
```

---

## 🛠️ Command & Tool Reference

### Slash Commands & Prompt Templates

| Command | Type | Description |
| :--- | :--- | :--- |
| `/workflow <goal>` | Slash Command | Runs the 5-stage spec-driven workflow (**Clarify → Plan → Decompose → Execute → Verify**). |
| `/openflow <goal>` | Slash Command | Autonomous end-to-end goal orchestrator with research and self-healing loops. |
| `/plan` | Slash Command | Switches to **Plan Mode** (read-only exploration and architecture drafting). |
| `/act` | Slash Command | Switches to **Act Mode** (execution and file modification enabled). |
| `/permission <mode>`| Slash Command | Adjusts security levels (`plan`, `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`). |
| `/autotest` | Slash Command | Toggles the post-edit test execution loop. |
| `/commit` | Slash Command | Analyzes git diffs and drafts Conventional Commits. |
| `/pr` | Slash Command | Prepares a comprehensive GitHub pull request summary. |
| `/plan-task <task>` | Prompt Template| Generates a structured dependency-linked task breakdown. |
| `/search <query>` | Prompt Template| Searches external documentation and synthesizes citations. |

### Agent Tools

| Tool Name | Purpose | Key Parameters |
| :--- | :--- | :--- |
| `task_checklist` | Manages tasks and dependency gates | `action` (`add`, `update`, `list`, `clear`), `tasks`, `id`, `status`, `priority`, `dependsOn`, `force` |
| `ask_user_question` | Asks interactive questions to resolve ambiguity | `questions` (`question`, `options`, `is_multi_select`) |
| `record_verification` | Records manual verification to clear Phase 5 | `summary`, `passed` |
| `Task` | Launches isolated child subagents | `role` (`explore`, `plan`, `general`), `task` |

---

## 🧪 Development & Testing

Clone the repository and run the test suite locally:

```bash
git clone https://github.com/rajivmehtaflex/pi-open-workflow.git
cd pi-open-workflow
npm install
npm run build
npm test
```

Test runner uses Node.js native test runner (`node --test`).

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
