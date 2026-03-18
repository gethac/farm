import type { DatabaseSync } from 'node:sqlite';
import type { ServerEnv } from './env';

export interface AppContext {
  database: DatabaseSync;
  env: ServerEnv;
}

export async function buildApp(_context: AppContext): Promise<{
  listen(options: { host: string; port: number }): Promise<void>;
}> {
  const loadFastify = new Function("return import('fastify')") as () => Promise<{ default: (options: { logger: boolean }) => { get(path: string, handler: () => Promise<{ ok: boolean }>): void; listen(options: { host: string; port: number }): Promise<void>; }; }>;
  const { default: Fastify } = await loadFastify();
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ ok: true }));

  return app;
}
