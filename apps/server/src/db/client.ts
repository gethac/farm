import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// @ts-ignore - runtime dependency is provided by the workspace package install
import Database from 'better-sqlite3';

export interface DatabaseClient {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): {
    run(bindings?: Record<string, unknown>): unknown;
    all(bindings?: Record<string, unknown>): unknown[];
  };
}

export function createDatabaseClient(databasePath: string): DatabaseClient {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);

  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);

  return database;
}