---
description: Create a pull request with an automated summary of branch commits and diffs
argument-hint: "[base-branch:string]"
---
Prepare a pull request for the current branch against the base branch (default: `main`).

Base Branch: $ARGUMENTS

Instructions:
1. Inspect the branch commit log and full diff against the base branch.
2. Generate a structured pull request description including:
   - Summary of changes
   - Motivation and context
   - Key files modified
   - Verification and testing steps performed
3. Confirm with the user before creating the PR via GitHub CLI (`gh pr create`).
