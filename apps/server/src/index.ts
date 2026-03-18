import { loadEnv } from './env';
import { createDatabaseClient } from './db/client';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { buildApp } from './app';

async function main(): Promise<void> {
  const env = loadEnv();
  const database = createDatabaseClient(env.databasePath);

  try {
    migrate(database);
    seed(database);

    const app = await buildApp({ database, env });
    await app.listen({ host: env.host, port: env.port });
  } catch (error) {
    database.close();
    throw error;
  }
}

const isMainModule = import.meta.url === new URL(process.argv[1] ?? '', 'file:').href;

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
