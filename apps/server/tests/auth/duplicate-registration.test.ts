import { describe, expect, it } from 'vitest';
import { createAuthService, AuthError } from '../../src/modules/auth/auth-service';
import type { DatabaseClient } from '../../src/db/client';

function createDuplicateSensitiveDatabase(): DatabaseClient {
  let insertCount = 0;

  return {
    close() {},
    exec() {},
    prepare(sql: string) {
      if (sql.includes('SELECT id, display_name, password_hash')) {
        return {
          run() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('INSERT INTO users')) {
        return {
          run() {
            insertCount += 1;
            if (insertCount > 1) {
              const error = new Error('UNIQUE constraint failed: users.display_name') as Error & { code?: string };
              error.code = 'SQLITE_CONSTRAINT_UNIQUE';
              throw error;
            }
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      return {
        run() {
          return undefined;
        },
        all() {
          return [];
        },
      };
    },
  };
}

describe('auth service duplicate registration', () => {
  it('treats a duplicate display name insert as a conflict', () => {
    const database = createDuplicateSensitiveDatabase();
    const authService = createAuthService(database, 'test-secret');

    const first = authService.register({ displayName: 'Ada', password: 'one' });
    expect(first.user.displayName).toBe('Ada');

    expect(() => authService.register({ displayName: 'Ada', password: 'two' })).toThrowError(AuthError);
    expect(() => authService.register({ displayName: 'Ada', password: 'two' })).toThrowError(/display name already exists/i);
  });
});
