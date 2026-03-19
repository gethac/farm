import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../src/lib/test-app';
import { createTaskService } from '../../src/modules/tasks/task-service';

describe('task reward claiming', () => {
  it('claims rewards once and rejects duplicate claims', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Reward User', password: 'secret123' },
      });
      const body = registerResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-reward', @userId, 'Reward Farm', 100, 0)
      `).run({ userId: body.user.id });
      database.prepare(`
        INSERT INTO task_progress (id, user_id, task_id, progress, status, completed_at)
        VALUES ('task-first-crop', @userId, 'new-player-plant-first-crop', 1, 'completed', CURRENT_TIMESTAMP)
      `).run({ userId: body.user.id });

      const taskService = createTaskService(database);
      const claimResult = taskService.claimReward(body.user.id, 'new-player-plant-first-crop');

      expect(claimResult.affectedEventNames).toEqual(['task:updated', 'notice:new']);
      expect(claimResult.farm.coins).toBe(180);
      expect(claimResult.farm.experience).toBe(20);
      expect(claimResult.tasks).toEqual([
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
          isClaimed: true,
        },
      ]);

      expect(() => taskService.claimReward(body.user.id, 'new-player-plant-first-crop')).toThrow(/already claimed|not claimable/i);
    } finally {
      await close();
    }
  });
});
