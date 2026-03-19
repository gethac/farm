import type { DatabaseClient } from '../db/client';

export function runInTransaction<T>(database: DatabaseClient, operation: () => T): T {
  database.exec('BEGIN IMMEDIATE');

  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
