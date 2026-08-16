---
description: Spec-driven workflow — clarify, research/plan, decompose to a dependency graph, then execute
argument-hint: "<task:string>"
---
You are running the structured spec-driven workflow. Follow these phases IN ORDER; do not skip ahead. Use `workflow_phase` at every boundary and only describe a phase as changed after its tool result confirms the transition.

Task: $ARGUMENTS

## Phase 1 — Clarify (before any research)
Call `workflow_phase` with action `start` and continue only if its result confirms `clarify`. Inspect the user's request. If ANYTHING is ambiguous (scope, target stack, constraints, success criteria, error handling, testing expectations), call `ask_user_question` with ALL clarifying questions in ONE invocation (up to 4 questions, 2-4 options each; recommended option FIRST with "(Recommended)" in its label). If the request is fully specified, state your assumptions in one line and move on.

## Phase 2 — Research & Plan
At the phase boundary, call `workflow_phase` with action `advance`; continue only if its result confirms `research-plan`. Explore the codebase first (read, search — no edits). Draft a concise plan: goal, approach, files to touch, risks. Present it in <= 15 lines.

## Phase 3 — Decompose into a task graph
At the phase boundary, call `workflow_phase` with action `advance`; continue only if its result confirms `decompose`. Convert the plan into atomic tasks via `task_checklist` (action: "add"). For each task include:
- a short imperative text
- priority: P0 (blocker) / P1 (core) / P2 (nice-to-have)
- dependsOn: ids of tasks that must be done before this one starts

Add tasks in dependency order. Sub-steps of a bigger task = separate tasks that depend on it.

## Phase 4 — Execute
At the phase boundary, call `workflow_phase` with action `advance`; continue only if its result confirms `execute`. Work tasks in topological order — `update` to `inprogress` is REFUSED while dependsOn tasks are not done. Mark each `inprogress` when starting, `done` when finished. Switch to Act Mode (/act) before editing files. If a task reveals a wrong assumption, stop and call `ask_user_question` again before proceeding.
