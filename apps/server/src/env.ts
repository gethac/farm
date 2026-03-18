import { resolve } from 'node:path';

export interface ServerEnv {
  host: string;
  port: number;
  databasePath: string;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const port = parseNumber(source.PORT, 3000);
  const host = source.HOST?.trim() || '0.0.0.0';
  const databasePath = resolve(source.DATABASE_PATH?.trim() || source.SQLITE_PATH?.trim() || 'apps/server/data/server.sqlite');

  return { host, port, databasePath };
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
