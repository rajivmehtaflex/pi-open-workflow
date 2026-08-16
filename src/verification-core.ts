/**
 * Pure policy for recording manual verification when no automated test suite
 * applies to the work just completed (e.g. a database/script-only task with
 * no source-file edits, so the file-edit-triggered test loop in test-loop.ts
 * never runs). Zero runtime imports -- testable under node --test without Pi.
 */
import type { TaskStatus } from "./types.ts";

export interface VerificationTaskInput {
  status: TaskStatus;
}

export interface VerificationInput {
  tasks: VerificationTaskInput[];
  passed: boolean;
  summary: string;
}

export type VerificationResult =
  | { ok: true; status: "passed" | "failed"; command: string; lastError?: string }
  | { ok: false; reason: string };

export function evaluateManualVerification(input: VerificationInput): VerificationResult {
  if (input.tasks.length === 0) {
    return { ok: false, reason: "Cannot record verification until at least one checklist task exists." };
  }
  if (!input.tasks.every((task) => task.status === "done")) {
    return { ok: false, reason: "Cannot record verification until every checklist task is done." };
  }
  if (!input.summary || input.summary.trim().length === 0) {
    return { ok: false, reason: "A verification summary is required (what was checked and how)." };
  }
  return input.passed
    ? { ok: true, status: "passed", command: "manual verification" }
    : { ok: true, status: "failed", command: "manual verification", lastError: input.summary };
}
