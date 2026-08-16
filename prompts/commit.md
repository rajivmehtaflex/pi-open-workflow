---
description: Analyze staged git changes and generate a structured Conventional Commit
argument-hint: "[flags:string]"
---
Analyze the current staged git changes using `git status` and `git diff --staged`.

Flags: $ARGUMENTS

Instructions:
1. Run `git status` and `git diff --staged` to inspect all pending modifications.
2. Group the changes into logical components.
3. Write a clear, concise Conventional Commit message (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.).
4. Show the commit message and ask the user for confirmation before executing `git commit`.
