import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
  let database: DatabaseSync | undefined;

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

    database = new DatabaseSync(dbFile);

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
});
