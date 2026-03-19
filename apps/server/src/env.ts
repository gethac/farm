import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export interface ServerEnv {
  host: string;
  port: number;
  databasePath: string;
  authSecret: string;
  testMode: boolean;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const port = parseNumber(source.PORT, 3000);
  const host = source.HOST?.trim() || '0.0.0.0';
  const databasePath = resolve(source.DATABASE_PATH?.trim() || source.SQLITE_PATH?.trim() || 'data/server.sqlite');
  const authSecret = source.AUTH_SECRET?.trim() || randomBytes(32).toString('base64url');
  const testMode = parseBoolean(source.TEST_MODE);

  return { host, port, databasePath, authSecret, testMode };
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true';
}
