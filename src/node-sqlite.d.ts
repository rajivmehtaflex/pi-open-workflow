declare module "node:sqlite" {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync<Row = any> {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Row | undefined;
    all(...params: unknown[]): Row[];
  }

  export interface DatabaseSync {
    exec(source: string): void;
    prepare<Row = any>(source: string): StatementSync<Row>;
    close(): void;
  }

  export const DatabaseSync: {
    new (path: string): DatabaseSync;
  };

  export const StatementSync: {
    new (...args: unknown[]): StatementSync;
  };

  export const Session: unknown;
  export const constants: Record<string, unknown>;
  export const backup: unknown;
}
