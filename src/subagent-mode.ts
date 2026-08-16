/**
 * Pure policy for subagent session-mode inheritance.
 *
 * Problem this solves: the Task tool spawns children as fresh `pi -p` processes that
 * load this same extension, whose state defaults to Plan Mode — so every subagent's
 * write/edit calls were blocked by its own copy of the plan-mode guard, even while the
 * parent session was in Execute with work to deliver. (Observed live: a giraffe-builder
 * subagent burned ~4 minutes preparing work, then reported itself blocked.)
 *
 * Policy: subagents inherit the parent session's mode, EXCEPT `explore`, which is
 * read-only by definition regardless of parent mode. The parent passes its mode to the
 * child via PI_OPEN_WORKFLOW_MODE; the child extension reads it at init.
 */

export type ParentMode = "plan" | "act";
export type SubagentRole = "explore" | "plan" | "bash" | "general" | (string & {});

/** Mode the spawned subagent session should start in. */
export function resolveSubagentMode(role: string, parentMode: ParentMode): ParentMode {
  if (role === "explore") return "plan"; // read-only by contract, never inherits write access
  return parentMode; // all other roles inherit the parent session's mode
}

/** Env var the parent writes and the child extension reads (see index.ts). */
export const SUBAGENT_MODE_ENV = "PI_OPEN_WORKFLOW_MODE";

/**
 * Notice appended to the Task tool result when a write-capable role ran read-only
 * because the parent was in Plan Mode — so the user gets an instant, actionable
 * remedy instead of a subagent that silently struggles or gives up.
 */
export function readOnlyNotice(role: string, parentMode: ParentMode): string | undefined {
  if (parentMode !== "plan") return undefined;
  if (role === "explore") return undefined; // read-only is the contract, not a problem
  return (
    "\n\n---\n**⚠️ READ-ONLY SUBAGENT:** The parent session is in Plan Mode, so this " +
    `[${role}] subagent ran without write access. Switch to Act Mode with **/act** in the ` +
    "parent session and re-launch if the subagent needed to create or modify files."
  );
}
