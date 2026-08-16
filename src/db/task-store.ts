import { DatabaseSync } from "node:sqlite";
import type { TaskStatus, WorkflowTask } from "../types.js";

export interface TaskInsertInput {
  text: string;
  status?: TaskStatus;
}

export const DEFAULT_SAMPLE_TASK_COUNT = 120;
export const DEFAULT_TASK_DB_NAME = "gdb.db";

const VALID_STATUSES = new Set<TaskStatus>(["idle", "inprogress", "done"]);
const TASK_COLUMNS = "id, text, status";

export const DEFAULT_SAMPLE_TASKS: TaskInsertInput[] = Array.from({ length: DEFAULT_SAMPLE_TASK_COUNT }, (_, index) => ({
  text: `Sample task ${String(index + 1).padStart(3, "0")} — workflow checkpoint`,
  status: "idle",
}));

function assertValidStatus(status: string): asserts status is TaskStatus {
  if (!VALID_STATUSES.has(status as TaskStatus)) {
    throw new RangeError(`Invalid task status: ${status}`);
  }
}

function toTask(row: any): WorkflowTask {
  return {
    id: Number(row.id),
    text: String(row.text),
    status: row.status as TaskStatus,
  };
}

export function openTaskStore(dbPath: string = DEFAULT_TASK_DB_NAME): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  initializeSchema(db);
  return db;
}

function getTaskCount(db: DatabaseSync): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM task_store`).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'inprogress', 'done')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function seedInitialTasks(db: DatabaseSync): number {
  initializeSchema(db);

  if (getTaskCount(db) > 0) {
    return 0;
  }

  const insert = db.prepare(`INSERT INTO task_store (text, status) VALUES (?, ?)`);

  db.exec(`BEGIN`);
  try {
    for (const task of DEFAULT_SAMPLE_TASKS) {
      insert.run(task.text, task.status ?? "idle");
    }
    db.exec(`COMMIT`);
  } catch (error) {
    db.exec(`ROLLBACK`);
    throw error;
  }

  return DEFAULT_SAMPLE_TASKS.length;
}

export function insertTask(db: DatabaseSync, task: TaskInsertInput): WorkflowTask {
  initializeSchema(db);

  const text = task.text.trim();
  if (!text) {
    throw new TypeError("Task text must not be empty");
  }

  const status = task.status ?? "idle";
  assertValidStatus(status);

  const result = db.prepare(`INSERT INTO task_store (text, status) VALUES (?, ?)`).run(text, status);
  return getTaskById(db, Number(result.lastInsertRowid))!;
}

export function getTaskById(db: DatabaseSync, id: number): WorkflowTask | null {
  initializeSchema(db);

  const row = db
    .prepare(`SELECT ${TASK_COLUMNS} FROM task_store WHERE id = ? LIMIT 1`)
    .get(id) as WorkflowTask | undefined;

  return row ? toTask(row) : null;
}

export function listTasks(db: DatabaseSync): WorkflowTask[] {
  initializeSchema(db);

  const rows = db
    .prepare(`SELECT ${TASK_COLUMNS} FROM task_store ORDER BY id ASC`)
    .all() as WorkflowTask[];

  return rows.map(toTask);
}

export function deleteTask(db: DatabaseSync, id: number): boolean {
  initializeSchema(db);

  const result = db.prepare(`DELETE FROM task_store WHERE id = ?`).run(id);
  return result.changes > 0;
}
