/**
 * Pure formatting helpers for the session clock and dependency status.
 * Zero runtime imports — only `import type` allowed.
 */

/** Format milliseconds as "[hh:mm:ss]" with hours unbounded, minutes/seconds zero-padded. */
export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600); // unbounded, padded to min 2 digits
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `[${hh}:${mm}:${ss}]`;
}

/**
 * Count idle tasks blocked by at least one unfinished dependency.
 * A dependency is satisfied only when the referenced task's status is "done";
 * unknown dependency ids are ignored (treated as satisfied).
 */
export function countBlocked(
  tasks: { id: number; status: string; dependsOn?: number[] }[]
): number {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.filter((t) => {
    if (t.status !== "idle") return false;
    const deps = t.dependsOn ?? [];
    return deps.some((depId) => {
      const dep = byId.get(depId);
      return dep !== undefined && dep.status !== "done";
    });
  }).length;
}
