---
description: Switch to Plan Mode or generate a step-by-step implementation plan for a task
argument-hint: "<task:string> [mode:string]"
---
You are in Plan Mode. Your goal is to explore the codebase, research relevant files, and construct a comprehensive implementation plan before making any code modifications.

Task: $ARGUMENTS

Instructions:
1. Explore the codebase using read, grep, and find tools (or dispatch to subagents).
2. Do NOT modify any source files or run destructive commands.
3. Formulate a structured step-by-step implementation plan detailing the files to modify, new files to create, and verification steps.
4. Present the plan clearly and ask the user for confirmation to proceed to Act Mode.
