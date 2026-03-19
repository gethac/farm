import { loadEnv } from './env';
import { createDatabaseClient } from './db/client';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { buildApp } from './app';
import { createFarmReconciler } from './modules/farm/farm-reconciler';
import { createNotificationBackfill } from './modules/notifications/notification-backfill';
import { createNotificationService } from './modules/notifications/notification-service';
import { createTaskService } from './modules/tasks/task-service';

export async function main(): Promise<void> {
  const env = loadEnv();
  const database = createDatabaseClient(env.databasePath);

  try {
    migrate(database);
    seed(database);

    const app = await buildApp({ database, env });
    const notificationService = createNotificationService(database);
    const taskService = createTaskService(database);
    const farmReconciler = createFarmReconciler({
      database,
      notificationService,
      taskService,
    });
    const notificationBackfill = createNotificationBackfill({
      database,
      notificationService,
    });

    setInterval(() => {
      try {
        farmReconciler.runOnce();
        notificationBackfill.runOnce();
      } catch (error) {
        console.error(error);
      }
    }, 60_000);

    await app.listen({ host: env.host, port: env.port });
  } catch (error) {
    database.close();
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
