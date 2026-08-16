---
name: open-workflow
description: Use when applying open-source agentic engineering workflows in Pi, including Plan vs Act modes, task checklists, safety rules, post-edit test verification, subagent task delegation, and git lifecycle management.
---

# Open Agentic Workflow for Pi

## Overview
This skill provides conventions and operating instructions for the `pi-open-workflow` package. It enables structured engineering discipline inside Pi.

## Workflow Modes

### 1. Plan Mode (`/plan` or `Shift+Tab`)
* **Behavior**: Read-only exploration and planning. Modifying files (`edit`, `write`) and executing destructive commands are strictly blocked.
* **Goal**: Understand requirements, inspect code, map dependencies, and draft a structured implementation plan.
* **Task Checklist**: Create structured tasks before switching to Act mode.

### 2. Act Mode
* **Behavior**: Full implementation and execution mode.
* **Discipline**: Tasks are picked one by one, moved from `idle` to `inprogress` to `done`.
* **Automatic Verification**: Every file edit automatically triggers background test/lint suites to verify correctness.

## Subagent Delegation (`Task` Tool)
When facing complex research, deep codebase exploration, or tasks with high token outputs, delegate to subagents using the `Task` tool:
- `task`: Actionable prompt description for the subagent.
- `role`: Role specialization (`explore`, `plan`, `bash`, `general`).
- `model`: Optional model override (e.g. lightweight models for quick searches).

## Safety & Permissions
* Protected files (`.env`, `~/.ssh/`, `*.pem`) cannot be read or modified.
* High-risk commands (`rm -rf`, `git reset --hard`, destructive SQL) pause for user confirmation.
* Modifying system files (`package-lock.json`, `/etc`) requires elevated permission.

## Git Lifecycle
* `/commit`: Synthesizes Conventional Commits from staged diffs.
* `/pr`: Generates structured pull request descriptions.
