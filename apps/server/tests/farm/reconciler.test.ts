import { describe, expect, it } from 'vitest';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';
import { createNotificationService } from '../../src/modules/notifications/notification-service';
import { createTaskService } from '../../src/modules/tasks/task-service';
import { createFarmReconciler } from '../../src/modules/farm/farm-reconciler';

const now = new Date('2026-03-19T01:00:00.000Z');
const riceRule = cropRules[0];

describe('farm reconciler', () => {
  it('reconciles idle crop state, task progress, and reminder notifications', async () => {
    const { app, database, close } = await createTestApp({ now: () => now });

    try {
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Owner', password: 'secret123' },
      });
      const owner = ownerResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-owner', @userId, 'Owner Farm', 100, 0)
      `).run({ userId: owner.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES
          ('slot-ready', 'farm-owner', 0, 'crop-ready', 0),
          ('slot-withered', 'farm-owner', 1, 'crop-withered', 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        ) VALUES
          (
            'crop-ready',
            'farm-owner',
            'slot-ready',
            @cropId,
            '2026-03-19T00:45:00.000Z',
            '2026-03-19T00:55:00.000Z',
            '2026-03-19T01:15:00.000Z',
            'planted',
            '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}'
          ),
          (
            'crop-withered',
            'farm-owner',
            'slot-withered',
            @cropId,
            '2026-03-19T00:20:00.000Z',
            '2026-03-19T00:30:00.000Z',
            '2026-03-19T00:50:00.000Z',
            'ready',
            '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}'
          )
      `).run({ cropId: riceRule.cropId });

      const taskService = createTaskService(database, () => now);
      const notificationService = createNotificationService(database);
      const reconciler = createFarmReconciler({
        database,
        notificationService,
        taskService,
        now: () => now,
      });

      const result = reconciler.runOnce();

      expect(result.updatedCropCount).toBe(2);
      expect(result.createdNotificationCount).toBe(2);
      expect(result.syncedTaskCount).toBeGreaterThanOrEqual(2);

      const cropRows = database.prepare(`
        SELECT id, status
        FROM crop_instances
        ORDER BY id ASC
      `).all() as Array<{ id: string; status: string }>;
      expect(cropRows).toEqual([
        { id: 'crop-ready', status: 'ready' },
        { id: 'crop-withered', status: 'withered' },
      ]);

      const taskRows = database.prepare(`
        SELECT task_id, progress, status
        FROM task_progress
        WHERE user_id = @userId
        ORDER BY task_id ASC
      `).all({ userId: owner.user.id }) as Array<{ task_id: string; progress: number; status: string }>;
      expect(taskRows).toEqual([
        { task_id: 'daily-water', progress: 0, status: 'active' },
        { task_id: 'new-player-plant-first-crop', progress: 1, status: 'completed' },
      ]);

      const notificationRows = database.prepare(`
        SELECT notification_type, title, source_id
        FROM notifications
        WHERE user_id = @userId
        ORDER BY source_id ASC
      `).all({ userId: owner.user.id }) as Array<{ notification_type: string; title: string; source_id: string }>;
      expect(notificationRows).toEqual([
        { notification_type: 'crop-matured', title: '作物成熟提醒', source_id: 'crop-ready' },
        { notification_type: 'crop-withered', title: '作物枯萎提醒', source_id: 'crop-withered' },
      ]);
    } finally {
      await close();
    }
  });
});
