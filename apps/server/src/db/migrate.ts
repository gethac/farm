import { readFileSync } from 'node:fs';
import type { DatabaseClient } from './client';

export function migrate(database: DatabaseClient): void {
  const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  database.exec(schemaSql);
  assertNoDuplicateDisplayNames(database);
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);');
}

function assertNoDuplicateDisplayNames(database: DatabaseClient): void {
  const rows = database
    .prepare(`
      SELECT display_name, COUNT(*) AS count
      FROM users
      GROUP BY display_name
      HAVING COUNT(*) > 1
      ORDER BY display_name
      LIMIT 1
    `)
    .all() as Array<{ display_name: string; count: number }>;

  const duplicate = rows[0];
  if (!duplicate) {
    return;
  }

  throw new Error(
    `Cannot migrate users.display_name uniqueness: legacy database contains duplicate display_name "${duplicate.display_name}" (${duplicate.count} rows).`,
  );
}
