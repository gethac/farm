import Fastify from 'fastify';
import type { DatabaseClient } from './db/client';
import type { ServerEnv } from './env';
import { createAuthService } from './modules/auth/auth-service';
import { registerAuthController } from './modules/auth/auth-controller';
import { createSessionStore, type SessionStore } from './realtime/session-store';
import { registerSocketServer } from './realtime/socket-server';

export interface AppContext {
  database: DatabaseClient;
  env: ServerEnv;
}

export interface ServerApp {
  get(path: string, handler: () => Promise<unknown>): void;
  post(path: string, handler: (request: { body?: unknown }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) => Promise<unknown> | unknown): void;
  inject(args: { method: string; url: string; payload?: unknown }): Promise<{ statusCode: number; json(): unknown }>;
  listen(options: { host: string; port: number }): Promise<void>;
  close(): Promise<void>;
  server: {
    on(event: 'upgrade', listener: (request: { url?: string; headers: Record<string, string | string[] | undefined> }, socket: { write(data: string | Uint8Array): void; end(data?: string): void; destroy(): void; on(event: string, listener: (...args: unknown[]) => void): void }, head: Uint8Array) => void): void;
    address(): { port: number } | string | null;
  };
  sessionStore: SessionStore;
}

export async function buildApp(context: AppContext): Promise<ServerApp> {
  const app = Fastify({ logger: false }) as ServerApp;

  const authService = createAuthService(context.database, context.env.authSecret);
  const sessionStore = createSessionStore();
  app.sessionStore = sessionStore;

  registerAuthController(app, authService);
  registerSocketServer(app, authService, sessionStore);

  app.get('/health', async () => ({ ok: true }));

  return app;
}
