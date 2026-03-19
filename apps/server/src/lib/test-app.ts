import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabaseClient } from '../db/client';
import { migrate } from '../db/migrate';
import { seed } from '../db/seed';
import { buildApp, type ServerApp } from '../app';

interface TestAppInstance extends ServerApp {
  server: ServerApp['server'];
}

export interface TestApp {
  app: TestAppInstance;
  database: ReturnType<typeof createDatabaseClient>;
  port: number;
  close(): Promise<void>;
}

export async function createTestApp(options: {
  listen?: boolean;
  now?: () => Date;
  bootstrapPlayerState?: boolean;
  testMode?: boolean;
} = {}): Promise<TestApp> {
  const tempDir = mkdtempSync(join(tmpdir(), 'farm-server-'));
  const databasePath = join(tempDir, 'server.sqlite');
  const database = createDatabaseClient(databasePath);
  migrate(database);
  seed(database);

  const env = {
    host: '127.0.0.1',
    port: 0,
    databasePath,
    authSecret: 'test-auth-secret',
    testMode: options.testMode ?? false,
  };

  const app = (await buildApp({
    database,
    env,
    now: options.now,
    bootstrapPlayerState: options.bootstrapPlayerState ?? false,
    testMode: options.testMode ?? false,
  })) as TestAppInstance;
  let port = 0;

  if (options.listen) {
    await app.listen({ host: env.host, port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to determine listening port');
    }

    port = address.port;
  }

  async function close(): Promise<void> {
    for (const session of app.sessionStore.values()) {
      session.socket?.destroy();
    }

    try {
      await app.close();
    } catch {
      // Ignore teardown races from upgraded sockets in tests.
    }

    database.close();
    rmSync(tempDir, { recursive: true, force: true });
  }

  return { app, database, port, close };
}
