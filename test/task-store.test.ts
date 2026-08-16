import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  DEFAULT_SAMPLE_TASK_COUNT,
  DEFAULT_TASK_DB_NAME,
  deleteTask,
  getTaskById,
  insertTask,
  listTasks,
  openTaskStore,
  seedInitialTasks,
} from "../src/db/task-store.ts";

function createDatabase(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

test("openTaskStore creates a gdb.db database file", () => {
  assert.equal(DEFAULT_TASK_DB_NAME, "gdb.db");

  const dir = mkdtempSync(join(tmpdir(), "openflow-task-store-"));
  const dbPath = join(dir, DEFAULT_TASK_DB_NAME);
  const db = openTaskStore(dbPath);

  try {
    assert.equal(existsSync(dbPath), true);
    assert.equal(listTasks(db).length, 0);
  } finally {
    db.close();
  }
});

test("seedInitialTasks populates 100+ sample tasks when the database is empty", () => {
  const db = createDatabase();
  try {
    const inserted = seedInitialTasks(db);
    const tasks = listTasks(db);

    assert.equal(DEFAULT_SAMPLE_TASK_COUNT >= 100, true);
    assert.equal(inserted, DEFAULT_SAMPLE_TASK_COUNT);
    assert.equal(tasks.length, DEFAULT_SAMPLE_TASK_COUNT);
    assert.equal(tasks[0]?.id, 1);
    assert.equal(tasks[0]?.text.startsWith("Sample task 001"), true);
    assert.equal(tasks[tasks.length - 1]?.id, DEFAULT_SAMPLE_TASK_COUNT);
  } finally {
    db.close();
  }
});

test("seedInitialTasks is idempotent and does not duplicate rows", () => {
  const db = createDatabase();
  try {
    const firstInsert = seedInitialTasks(db);
    const secondInsert = seedInitialTasks(db);
    const tasks = listTasks(db);

    assert.equal(firstInsert, DEFAULT_SAMPLE_TASK_COUNT);
    assert.equal(secondInsert, 0);
    assert.equal(tasks.length, DEFAULT_SAMPLE_TASK_COUNT);
  } finally {
    db.close();
  }
});

test("insertTask and getTaskById round-trip a record", () => {
  const db = createDatabase();
  try {
    seedInitialTasks(db);

    const inserted = insertTask(db, { text: "Ship SQLite-backed task store", status: "inprogress" });
    const fetched = getTaskById(db, inserted.id);

    assert.ok(fetched);
    assert.equal(fetched?.id, inserted.id);
    assert.equal(fetched?.text, "Ship SQLite-backed task store");
    assert.equal(fetched?.status, "inprogress");
  } finally {
    db.close();
  }
});

test("listTasks returns rows ordered by id and includes newly inserted tasks", () => {
  const db = createDatabase();
  try {
    seedInitialTasks(db);
    const inserted = insertTask(db, { text: "Write follow-up integration checks", status: "done" });

    const tasks = listTasks(db);

    assert.equal(tasks.length, DEFAULT_SAMPLE_TASK_COUNT + 1);
    assert.equal(tasks[0]?.id, 1);
    assert.equal(tasks[tasks.length - 1]?.id, inserted.id);
    assert.deepEqual(tasks[tasks.length - 1], inserted);
  } finally {
    db.close();
  }
});

test("deleteTask removes rows and returns false when the record is missing", () => {
  const db = createDatabase();
  try {
    const inserted = insertTask(db, { text: "Remove this task", status: "idle" });

    assert.equal(deleteTask(db, inserted.id), true);
    assert.equal(getTaskById(db, inserted.id), null);
    assert.equal(deleteTask(db, inserted.id), false);
  } finally {
    db.close();
  }
});

test("insertTask validates text and status", () => {
  const db = createDatabase();
  try {
    assert.throws(() => insertTask(db, { text: "   " }), /Task text must not be empty/);
    assert.throws(() => insertTask(db, { text: "Bad status", status: "blocked" as never }), /Invalid task status/);
  } finally {
    db.close();
  }
});
