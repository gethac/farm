import type { DatabaseClient } from '../../db/client';
import type { NotificationService } from '../notifications/notification-service';
import type { TaskService } from '../tasks/task-service';

interface CropRow {
  id: string;
  farm_id: string;
  ready_at: string;
  withers_at: string;
  status: 'planted' | 'ready' | 'withered' | 'harvested';
}

interface FarmOwnerRow {
  farm_id: string;
  user_id: string;
}

export interface FarmReconciler {
  runOnce(): {
    updatedCropCount: number;
    createdNotificationCount: number;
    syncedTaskCount: number;
  };
}

export function createFarmReconciler(dependencies: {
  database: DatabaseClient;
  notificationService: NotificationService;
  taskService: TaskService;
  now?: () => Date;
}): FarmReconciler {
  const now = dependencies.now ?? (() => new Date());

  return {
    runOnce() {
      const cropRows = dependencies.database.prepare(`
        SELECT id, farm_id, ready_at, withers_at, status
        FROM crop_instances
        WHERE status != 'harvested'
        ORDER BY planted_at ASC
      `).all() as CropRow[];
      let updatedCropCount = 0;
      let createdNotificationCount = 0;

      for (const crop of cropRows) {
        const nextStatus = resolveCropStatus(crop, now());
        if (nextStatus === crop.status) {
          continue;
        }

        dependencies.database.prepare(`
          UPDATE crop_instances
          SET status = @status
          WHERE id = @id
        `).run({ id: crop.id, status: nextStatus });
        updatedCropCount += 1;

        if (nextStatus === 'ready' || nextStatus === 'withered') {
          const owner = findFarmOwner(dependencies.database, crop.farm_id);
          if (owner && !hasNotification(dependencies.database, 'crop_instances', crop.id)) {
            dependencies.notificationService.create({
              userId: owner.user_id,
              notificationType: nextStatus === 'ready' ? 'crop-matured' : 'crop-withered',
              title: nextStatus === 'ready' ? '作物成熟提醒' : '作物枯萎提醒',
              body: nextStatus === 'ready' ? '有作物已经成熟，可以收获了' : '有作物已经枯萎，需要清理',
              sourceTable: 'crop_instances',
              sourceId: crop.id,
            });
            createdNotificationCount += 1;
          }
        }
      }

      const syncedTaskCount = dependencies.taskService.syncAllUsers();

      return {
        updatedCropCount,
        createdNotificationCount,
        syncedTaskCount,
      };
    },
  };
}

function resolveCropStatus(crop: CropRow, currentTime: Date): CropRow['status'] {
  const readyAt = new Date(crop.ready_at).getTime();
  const withersAt = new Date(crop.withers_at).getTime();
  const now = currentTime.getTime();

  if (now >= withersAt) {
    return 'withered';
  }

  if (now >= readyAt) {
    return 'ready';
  }

  return 'planted';
}

function findFarmOwner(database: DatabaseClient, farmId: string): FarmOwnerRow | null {
  const rows = database.prepare(`
    SELECT id AS farm_id, user_id
    FROM farms
    WHERE id = @farmId
    LIMIT 1
  `).all({ farmId }) as FarmOwnerRow[];

  return rows[0] ?? null;
}

function hasNotification(database: DatabaseClient, sourceTable: string, sourceId: string): boolean {
  const rows = database.prepare(`
    SELECT id
    FROM notifications
    WHERE source_table = @sourceTable AND source_id = @sourceId
    LIMIT 1
  `).all({ sourceTable, sourceId }) as Array<{ id: string }>;

  return rows.length > 0;
}
