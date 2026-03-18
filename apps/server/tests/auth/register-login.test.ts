import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../src/lib/test-app';

describe('auth register/login', () => {
  it('creates a user with a hashed password and issues tokens on register and login', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Ada Lovelace',
          password: 'secret123',
        },
      });

      expect(registerResponse.statusCode).toBe(200);

      const registerBody = registerResponse.json() as {
        token: string;
        user: { id: string; displayName: string };
      };

      expect(registerBody.token).toEqual(expect.any(String));
      expect(registerBody.user.displayName).toBe('Ada Lovelace');
      expect(registerBody.user.id).toEqual(expect.any(String));

      const rows = database
        .prepare('SELECT id, display_name, password_hash FROM users WHERE display_name = @displayName')
        .all({ displayName: 'Ada Lovelace' }) as Array<{
        id: string;
        display_name: string;
        password_hash: string;
      }>;

      expect(rows).toHaveLength(1);
      expect(rows[0]?.display_name).toBe('Ada Lovelace');
      expect(rows[0]?.password_hash).not.toBe('secret123');
      expect(rows[0]?.password_hash).toContain(':');

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          displayName: 'Ada Lovelace',
          password: 'secret123',
        },
      });

      expect(loginResponse.statusCode).toBe(200);

      const loginBody = loginResponse.json() as {
        token: string;
        user: { id: string; displayName: string };
      };

      expect(loginBody.token).toEqual(expect.any(String));
      expect(loginBody.user).toEqual(registerBody.user);
    } finally {
      await close();
    }
  });
});
