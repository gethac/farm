import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabaseClient } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import { seed } from '../../src/db/seed';

const requiredTables = [
  'users',
  'farms',
  'farm_slots',
  'crop_instances',
  'inventory_entries',
  'friendships',
  'friendship_requests',
  'visit_logs',
  'interaction_logs',
  'message_logs',
  'tasks',
  'task_progress',
  'notifications',
  'leaderboard_entries',
] as const;

describe('database migrations', () => {
  let dbFile = '';
  let database: ReturnType<typeof createDatabaseClient> | undefined;

  afterEach(() => {
    database?.close();
    database = undefined;
    if (dbFile) {
      rmSync(dbFile, { force: true });
      dbFile = '';
    }
  });

  it('creates the required tables when migrating and seeding a new database', () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'farm-server-'));
    dbFile = join(dbDir, 'test.sqlite');

    database = createDatabaseClient(dbFile);

    migrate(database);
    seed(database);

    const rows = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    const tableNames = rows.map((row) => row.name);
    expect(tableNames).toEqual([...requiredTables].sort());
  });

  it('adds display name uniqueness to an upgraded users table', () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'farm-server-'));
    dbFile = join(dbDir, 'test.sqlite');

    database = createDatabaseClient(dbFile);
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (id, display_name, password_hash) VALUES
        ('user-1', 'Ada', 'hash-1');
    `);

    migrate(database);

    expect(() =>
      database.prepare(
        `INSERT INTO users (id, display_name, password_hash) VALUES ('user-2', 'Ada', 'hash-2')`,
      ).run(),
    ).toThrow();
  });

  it('fails fast with a clear message when legacy duplicate display names exist', () => {
    const dbDir = mkdtempSync(join(tmpdir(), 'farm-server-'));
    dbFile = join(dbDir, 'test.sqlite');

    database = createDatabaseClient(dbFile);
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users (id, display_name, password_hash) VALUES
        ('user-1', 'Ada', 'hash-1'),
        ('user-2', 'Ada', 'hash-2');
    `);

    expect(() => migrate(database)).toThrowError(
      'Cannot migrate users.display_name uniqueness: legacy database contains duplicate display_name "Ada" (2 rows).',
    );
  });
});
