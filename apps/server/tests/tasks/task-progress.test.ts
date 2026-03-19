import { describe, expect, it } from 'vitest';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';
import { createTaskService } from '../../src/modules/tasks/task-service';
import { createTaskProgressor } from '../../src/modules/tasks/task-progressor';

const now = new Date('2026-03-19T01:00:00.000Z');
const nextDay = new Date('2026-03-20T01:00:00.000Z');
const riceRule = cropRules[0];

describe('task progress', () => {
  it('syncs onboarding progress from farm history and advances daily water progress from gameplay events', async () => {
    const { app, database, close } = await createTestApp({ now: () => now });

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Task User', password: 'secret123' },
      });
      const body = registerResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-task', @userId, 'Task Farm', 100, 0)
      `).run({ userId: body.user.id });
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        ) VALUES (
          'crop-history',
          'farm-task',
          NULL,
          @cropId,
          '2026-03-19T00:40:00.000Z',
          '2026-03-19T00:50:00.000Z',
          '2026-03-19T01:10:00.000Z',
          'harvested',
          '{}'
        )
      `).run({ cropId: riceRule.cropId });

      const taskService = createTaskService(database, () => now);
      const progressor = createTaskProgressor(database, () => now);

      const initialTasks = taskService.list(body.user.id);
      expect(initialTasks).toEqual([
        {
          taskId: 'daily-water',
          progress: 0,
          target: 5,
          isClaimed: false,
        },
        {
          taskId: 'new-player-plant-first-crop',
          progress: 1,
          target: 1,
          isClaimed: false,
        },
      ]);

      for (let i = 0; i < 5; i += 1) {
        progressor.recordEvent(body.user.id, 'water', 1);
      }

      const updatedTasks = taskService.list(body.user.id);
      expect(updatedTasks).toEqual([
        {
          taskId: 'daily-water',
          progress: 5,
          target: 5,
          isClaimed: false,
        },
        {
          taskId: 'new-player-plant-first-crop',
          progress: 1,
          target: 1,
          isClaimed: false,
        },
      ]);
    } finally {
      await close();
    }
  });

  it('resets repeatable daily tasks on a new day', async () => {
    const { app, database, close } = await createTestApp({ now: () => nextDay });

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Daily Reset User', password: 'secret123' },
      });
      const body = registerResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-reset', @userId, 'Reset Farm', 100, 0)
      `).run({ userId: body.user.id });
      database.prepare(`
        INSERT INTO task_progress (id, user_id, task_id, progress, status, completed_at)
        VALUES ('task-daily', @userId, 'daily-water', 5, 'claimed', '2026-03-19T05:00:00.000Z')
      `).run({ userId: body.user.id });

      const taskService = createTaskService(database, () => nextDay);
      const tasks = taskService.list(body.user.id);

      expect(tasks).toEqual([
        {
          taskId: 'daily-water',
          progress: 0,
          target: 5,
          isClaimed: false,
        },
        {
          taskId: 'new-player-plant-first-crop',
          progress: 0,
          target: 1,
          isClaimed: false,
        },
      ]);
    } finally {
      await close();
    }
  });
});
