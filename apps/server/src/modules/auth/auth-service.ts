import { createHmac, pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseClient } from '../../db/client';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
}

export interface AuthResult {
  token: string;
  user: AuthenticatedUser;
}

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

interface UserRow {
  id: string;
  display_name: string;
  password_hash: string;
}

export interface AuthService {
  register(input: { displayName: string; password: string }): AuthResult;
  login(input: { displayName: string; password: string }): AuthResult;
  verifyToken(token: string): AuthenticatedUser | null;
}

export function createAuthService(database: DatabaseClient, secret: string): AuthService {
  return {
    register(input) {
      const displayName = normalizeDisplayName(input.displayName);
      const password = normalizePassword(input.password);
      const user: AuthenticatedUser = {
        id: randomUUID(),
        displayName,
      };
      const passwordHash = hashPassword(password);

      try {
        database.prepare(
          `
            INSERT INTO users (id, display_name, password_hash)
            VALUES (@id, @displayName, @passwordHash)
          `,
        ).run({
          id: user.id,
          displayName: user.displayName,
          passwordHash,
        });
      } catch (error) {
        if (isUniqueDisplayNameError(error)) {
          throw new AuthError(409, 'Display name already exists');
        }

        throw error;
      }

      return {
        token: signToken({ userId: user.id }, secret),
        user,
      };
    },

    login(input) {
      const displayName = normalizeDisplayName(input.displayName);
      const password = normalizePassword(input.password);
      const users = findUsersByDisplayName(database, displayName);

      if (users.length !== 1) {
        throw new AuthError(401, 'Invalid display name or password');
      }

      const user = users[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new AuthError(401, 'Invalid display name or password');
      }

      return {
        token: signToken({ userId: user.id }, secret),
        user: toAuthenticatedUser(user),
      };
    },

    verifyToken(token) {
      const payload = verifySignedToken(token, secret);
      if (!payload) {
        return null;
      }

      const user = findUserById(database, payload.userId);
      return user ? toAuthenticatedUser(user) : null;
    },
  };
}

function normalizeDisplayName(value: string): string {
  const displayName = value.trim();
  if (!displayName) {
    throw new AuthError(400, 'displayName is required');
  }

  return displayName;
}

function normalizePassword(value: string): string {
  const password = value.trim();
  if (!password) {
    throw new AuthError(400, 'password is required');
  }

  return password;
}

function findUsersByDisplayName(database: DatabaseClient, displayName: string): UserRow[] {
  return database
    .prepare(
      `
        SELECT id, display_name, password_hash
        FROM users
        WHERE display_name = @displayName
      `,
    )
    .all({ displayName }) as UserRow[];
}

function findUserById(database: DatabaseClient, id: string): UserRow | null {
  const rows = database
    .prepare(
      `
        SELECT id, display_name, password_hash
        FROM users
        WHERE id = @id
        LIMIT 1
      `,
    )
    .all({ id }) as UserRow[];

  return rows[0] ?? null;
}

function toAuthenticatedUser(user: UserRow): AuthenticatedUser {
  return {
    id: user.id,
    displayName: user.display_name,
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':', 2);
  if (!salt || !expectedHash) {
    return false;
  }

  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return hash === expectedHash;
}

function signToken(payload: { userId: string }, secret: string): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifySignedToken(token: string, secret: string): { userId: string } | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret).update(body).digest('base64url');
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(body)) as { userId?: string };
    return typeof decoded.userId === 'string' && decoded.userId ? { userId: decoded.userId } : null;
  } catch {
    return null;
  }
}

function isUniqueDisplayNameError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      ('message' in error && typeof error.message === 'string' && error.message.includes('users.display_name')))
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
