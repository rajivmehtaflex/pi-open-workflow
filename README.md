# pi-open-workflow

A full **open-source agentic workflow experience** packaged for the Pi Coding Agent.

---

## Features

* **Plan Mode & Task Discipline** (`/plan`, `/act`): Idempotent read-only exploration and plan drafting, separate from execution mode, with structured dependency-aware task checklists.
* **5-Mode Safety & Sandboxing** (`/permission`): Path-based access control and dangerous bash command screening with user confirmation dialogs.
* **Automated Post-Edit Test Loop** (`/autotest`): Automatically executes `pytest` or `npm test` after file edits and feeds regression errors back to the model.
* **Cascading Project Memory**: Hierarchically loads and injects `~/.claude/CLAUDE.md`, `./CLAUDE.md`, and `./AGENTS.md` instructions into every turn.
* **Smart Compaction Guard**: Preserves active tasks and project rules across context compaction events.
* **Subagent Task Tool**: Native `Task` tool spawning isolated child `pi` processes for deep research without cluttering primary context.
* **Semantic Git Lifecycle** (`/commit`, `/pr`): Structured commit message generation and PR drafting from staged changes.
* **Hierarchical Tree-Grid Dashboard**: Stages as parent rows, tasks nested underneath with priority chips and dependency-blocked badges.
* **Spec-Driven `/workflow`**: `ask_user_question` tool + `/workflow` slash command chaining Clarify → Research/Plan → Decompose → Execute → Verify.
* **Responsive Statusline**: Footer displaying Model, Mode (`[PLAN]` / `[ACT]`), permission levels, blocked-task count, session clock (`[hh:mm:ss]`), and context usage meter.

---

## Installation

### Prerequisites

```bash
node --version    # >= 20 required (node:sqlite, node --test)
pi --version       # any recent Pi CLI build
```

### 1. Install the extension into your project

```bash
pi install git:github.com/rajivmehtaflex/pi-open-workflow@v0.1.2
```

This adds an entry to your project's `.pi/settings.json` under `"packages"`. Verify it landed:

```bash
pi list
```

Expected output includes:

```
Project packages:
  git:github.com/rajivmehtaflex/pi-open-workflow@v0.1.2
    <local clone path>
```

### 2. (Optional) External tools setup — web-search-backed tools

Some `/openflow` research steps use `pi-mcp-adapter` + an Exa MCP server. If you don't need web research, skip this.

```bash
pi install npm:pi-mcp-adapter
```

Add to `~/.config/mcp/mcp.json` (or your project's `.mcp.json`):

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp",
      "lifecycle": "lazy"
    }
  }
}
```

### 3. Try it without installing (local dev / clone-and-run)

```bash
git clone https://github.com/rajivmehtaflex/pi-open-workflow.git
cd pi-open-workflow
npm install
npm run build
pi -e ./src/index.ts
```

---

## Usage

Start `pi` in a project where the extension is installed (or loaded via `-e`), then try these in order — each exercises a different subsystem end to end.

### 1. Enter Plan Mode and draft a plan (read-only, no edits)

```
/plan
```
Ask a question, e.g. "Add a `priority` column to the sqlite task store." The agent explores and drafts a plan; file edits are blocked while `[PLAN]` shows in the footer.

### 2. Switch to Act Mode and run the full spec-driven pipeline

```
/act
/workflow Add a `priority` column ("P0"|"P1"|"P2") to the sqlite task_store table, update insertTask/listTasks to read/write it, and add node:test coverage.
```
Watch for:
- `ask_user_question` firing in Phase 1 if the request is ambiguous — answer via the numbered dialog or type a custom answer.
- `task_checklist` building a dependency-ordered task graph in Phase 3 (priority chips `[P0]`/`[P1]`, `dependsOn` gating).
- The tree-grid dashboard widget rendering stages (`Research`/`Plan`/`Act`/`Verify`/`Commit`) with tasks nested underneath as they execute.
- The statusline footer showing `[ACT: Act 3/5]`, the `blocked:N` badge if a task is dependency-blocked, and a ticking `[hh:mm:ss]` session clock.

### 3. Manage tasks directly (without going through `/workflow`)

Ask the agent, in plain chat:
```
Use task_checklist: add texts ["Write the migration", "Backfill existing rows"], the second depends on the first with priority P0. Then try to mark the second one inprogress before the first is done.
```
Expected: the second task is refused with `⛔ Task #2 is blocked by unfinished dependencies: #1` until #1 is marked `done` (or `force: true` is passed).

### 4. Toggle the automated test loop

```
/autotest
```
After the next file edit, it automatically runs `npm test` (or `pytest`, if the project is Python) and feeds any failures back into the conversation.

### 5. Record manual verification for a non-file-editing task

For work that never edits a source file (a database migration, a data-seeding script), the automated test loop never fires. Ask the agent, in plain chat:
```
Once all tasks are done, call record_verification with summary "SELECT COUNT(*) FROM student = 100; all enrollment foreign keys valid" and passed: true.
```
Expected: Stage 4 ("Verify") flips from `▸ 4. Verify · tasks – · verification pending` to `✓ 4. Verify`.

### 6. Generate a commit message from staged changes

```bash
git add -A
```
then in the `pi` session:
```
/commit
```

### 7. Draft a PR description

```
/pr
```

### 8. Launch an isolated research subagent

Ask the agent:
```
Use the Task tool to explore how insertTask validates status, role: explore.
```
Watch the subagent telemetry panel appear in the dashboard (`🤖 [explore] Running...`) without cluttering your main conversation context.

---

## Commands & Tools

| Command / Tool | Type | Description |
| :--- | :--- | :--- |
| `/openflow` | Slash Command | Autonomous end-to-end master workflow (`/openflow <goal>`). |
| `/workflow` | Slash Command | Spec-driven pipeline: Clarify → Research/Plan → Decompose → Execute → Verify (`/workflow <task>`). |
| `/plan` | Slash Command | Enter Plan Mode (read-only exploration). Idempotent — safe to run when already in Plan Mode. |
| `/act` | Slash Command | Enter Act Mode (execution: write & edit enabled). Idempotent. |
| `/permission` | Slash Command | Set permission level (`plan`, `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`). |
| `/autotest` | Slash Command | Toggle automatic post-edit test verification on or off. |
| `/commit` | Slash Command | Inspect staged git changes and generate Conventional Commits. |
| `/pr` | Slash Command | Prepare a structured pull request description for GitHub. |
| `Task` | LLM Tool | Launch an isolated subagent with typed roles (`explore`, `plan`, `general`). |
| `task_checklist` | LLM Tool | Programmatic task management: add (with `priority`, `dependsOn`), update, list, clear. Dependency-gated — `inprogress` is refused while dependencies are unfinished unless `force: true`. |
| `ask_user_question` | LLM Tool | Ask the user 1-4 structured clarifying questions (2-4 options each, optional multi-select, free-text escape hatch) when requirements are ambiguous. |
| `record_verification` | LLM Tool | Record manual verification (summary + pass/fail) when no automated test suite applies to the work just completed — e.g. a database/script-only task with no source-file edits. Requires every checklist task to be done first; sets the same gate the automated post-edit test loop would otherwise set. |

## License

MIT — see [LICENSE](./LICENSE).
