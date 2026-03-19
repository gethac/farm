import { randomUUID } from 'node:crypto';
import { taskRules } from '@qq-classic-farm/config';
import type { DatabaseClient } from '../../db/client';

interface TaskProgressRow {
  id: string;
  task_id: string;
  progress: number;
  status: 'locked' | 'active' | 'completed' | 'claimed';
  completed_at: string | null;
}

export interface TaskService {
  syncUserProgress(userId: string): number;
  syncAllUsers(): number;
}

export function createTaskService(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
): TaskService {
  return {
    syncUserProgress(userId) {
      let changedCount = 0;
      const existingRows = database.prepare(`
        SELECT id, task_id, progress, status, completed_at
        FROM task_progress
        WHERE user_id = @userId
      `).all({ userId }) as TaskProgressRow[];
      const existingByTaskId = new Map(existingRows.map((row) => [row.task_id, row]));
      const hasPlantedCropHistory = hasAnyCropHistory(database, userId);

      for (const rule of taskRules) {
        const existing = existingByTaskId.get(rule.taskId) ?? null;
        const derived = deriveTaskSnapshot({
          ruleId: rule.taskId,
          target: rule.target,
          hasPlantedCropHistory,
          existing,
          now,
        });

        if (existing) {
          if (
            existing.progress !== derived.progress ||
            existing.status !== derived.status ||
            existing.completed_at !== derived.completedAt
          ) {
            database.prepare(`
              UPDATE task_progress
              SET progress = @progress,
                  status = @status,
                  completed_at = @completedAt,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = @id
            `).run({
              id: existing.id,
              progress: derived.progress,
              status: derived.status,
              completedAt: derived.completedAt,
            });
            changedCount += 1;
          }
          continue;
        }

        database.prepare(`
          INSERT INTO task_progress (id, user_id, task_id, progress, status, completed_at)
          VALUES (@id, @userId, @taskId, @progress, @status, @completedAt)
        `).run({
          id: randomUUID(),
          userId,
          taskId: rule.taskId,
          progress: derived.progress,
          status: derived.status,
          completedAt: derived.completedAt,
        });
        changedCount += 1;
      }

      return changedCount;
    },

    syncAllUsers() {
      const userRows = database.prepare(`
        SELECT user_id
        FROM farms
        ORDER BY user_id ASC
      `).all() as Array<{ user_id: string }>;

      return userRows.reduce((total, row) => total + this.syncUserProgress(row.user_id), 0);
    },
  };
}

function hasAnyCropHistory(database: DatabaseClient, userId: string): boolean {
  const rows = database.prepare(`
    SELECT crop_instances.id
    FROM crop_instances
    INNER JOIN farms ON farms.id = crop_instances.farm_id
    WHERE farms.user_id = @userId
    LIMIT 1
  `).all({ userId }) as Array<{ id: string }>;

  return rows.length > 0;
}

function deriveTaskSnapshot(input: {
  ruleId: string;
  target: number;
  hasPlantedCropHistory: boolean;
  existing: TaskProgressRow | null;
  now: () => Date;
}): { progress: number; status: TaskProgressRow['status']; completedAt: string | null } {
  if (input.existing?.status === 'claimed') {
    return {
      progress: Math.max(input.existing.progress, input.target),
      status: 'claimed',
      completedAt: input.existing.completed_at ?? input.now().toISOString(),
    };
  }

  if (input.ruleId === 'new-player-plant-first-crop') {
    const progress = input.hasPlantedCropHistory ? input.target : 0;
    const status = progress >= input.target ? 'completed' : 'active';
    const completedAt = status === 'completed'
      ? input.existing?.completed_at ?? input.now().toISOString()
      : null;

    return { progress, status, completedAt };
  }

  return {
    progress: input.existing?.progress ?? 0,
    status: input.existing?.status ?? 'active',
    completedAt: input.existing?.completed_at ?? null,
  };
}
