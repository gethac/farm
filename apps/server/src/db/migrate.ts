import { readFileSync } from 'node:fs';
import type { DatabaseClient } from './client';

export function migrate(database: DatabaseClient): void {
  const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  database.exec(`${schemaSql}

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);`);
}
