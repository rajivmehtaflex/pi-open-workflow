---
description: Execute the full agentic workflow autonomously (research via subagents -> task checklist -> implement -> test verification -> commit summary)
argument-hint: "<goal:string> [flags:string]"
---
You are an autonomous senior software engineer. Execute the following goal end-to-end using the full pi-open-workflow pipeline:

Goal: $ARGUMENTS

Follow this 5-stage workflow strictly:

### Stage 1: Deep Research via Subagent
- Do NOT flood the primary context window with exploratory searches.
- Launch an isolated subagent using your `Task` tool:
  `Task({ task: "Investigate architecture, dependencies, and all files related to: " + goal, role: "explore" })`
- Wait for the subagent's concise report.

### Stage 2: Planning & Task Breakdown
- Synthesize the subagent's findings.
- Register a concrete, numbered task checklist using the `task_checklist` tool:
  `task_checklist({ action: "add", texts: ["Step 1: ...", "Step 2: ...", "Step 3: ..."] })`
- Ensure each task represents an atomic unit of work.

### Stage 3: Step-by-Step Implementation
- If in Plan Mode, switch to Act Mode using `/plan` or proceed with implementation.
- For each task:
  1. Update status to `inprogress`: `task_checklist({ action: "update", id: <id>, status: "inprogress" })`
  2. Implement the required file edits surgical and cleanly.
  3. Mark status `done`: `task_checklist({ action: "update", id: <id>, status: "done" })`

### Stage 4: Automated Verification
- Let the background automated test verification loop validate your edits.
- If any test regressions occur, inspect the failure output and resolve the issue immediately before moving to the next task.

### Stage 5: Final Review & Commit Proposal
- Verify that all tasks in the checklist are marked `done`.
- Inspect `git status` and `git diff --staged`.
- Provide a summary walkthrough of all changes made and propose a Conventional Commit message (e.g. `feat:`, `fix:`, `refactor:`).
