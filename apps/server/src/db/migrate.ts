import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

export function migrate(database: DatabaseSync): void {
  const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  database.exec(schemaSql);
}
