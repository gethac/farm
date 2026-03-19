import { randomUUID } from 'node:crypto';
import { taskRules } from '@qq-classic-farm/config';
import type { DatabaseClient } from '../../db/client';

interface TaskRow {
  taskId: string;
  target: number;
  repeatable: number;
}

interface TaskProgressRow {
  id: string;
  progress: number;
  status: 'locked' | 'active' | 'completed' | 'claimed';
  completed_at: string | null;
}

type TaskEventName = 'plant' | 'water';

const eventTaskMap: Record<TaskEventName, { taskId: string; amount: number }> = {
  plant: { taskId: 'new-player-plant-first-crop', amount: 1 },
  water: { taskId: 'daily-water', amount: 1 },
};

export interface TaskProgressor {
  recordEvent(userId: string, eventName: TaskEventName, amount?: number): void;
}

export function createTaskProgressor(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
): TaskProgressor {
  return {
    recordEvent(userId, eventName, amount = 1) {
      const mapping = eventTaskMap[eventName];
      if (!mapping || amount <= 0) {
        return;
      }

      const task = findTask(database, mapping.taskId);
      if (!task) {
        return;
      }

      const progressRow = findTaskProgress(database, userId, mapping.taskId);
      const normalized = normalizeProgressRow(progressRow, task.repeatable === 1, now);
      if (normalized.status === 'claimed' || normalized.status === 'completed') {
        return;
      }

      const nextProgress = Math.min(task.target, normalized.progress + mapping.amount * amount);
      const nextStatus: TaskProgressRow['status'] = nextProgress >= task.target ? 'completed' : 'active';
      const completedAt = nextStatus === 'completed' ? now().toISOString() : null;

      if (progressRow) {
        database.prepare(`
          UPDATE task_progress
          SET progress = @progress,
              status = @status,
              completed_at = @completedAt,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = @id
        `).run({
          id: progressRow.id,
          progress: nextProgress,
          status: nextStatus,
          completedAt,
        });
        return;
      }

      database.prepare(`
        INSERT INTO task_progress (id, user_id, task_id, progress, status, completed_at)
        VALUES (@id, @userId, @taskId, @progress, @status, @completedAt)
      `).run({
        id: randomUUID(),
        userId,
        taskId: mapping.taskId,
        progress: nextProgress,
        status: nextStatus,
        completedAt,
      });
    },
  };
}

function findTask(database: DatabaseClient, taskId: string): TaskRow | null {
  const rows = database.prepare(`
    SELECT task_id AS taskId, target, repeatable
    FROM tasks
    WHERE task_id = @taskId
    LIMIT 1
  `).all({ taskId }) as TaskRow[];

  if (rows[0]) {
    return rows[0];
  }

  const rule = taskRules.find((item) => item.taskId === taskId);
  return rule
    ? { taskId: rule.taskId, target: rule.target, repeatable: rule.repeatable ? 1 : 0 }
    : null;
}

function findTaskProgress(database: DatabaseClient, userId: string, taskId: string): TaskProgressRow | null {
  const rows = database.prepare(`
    SELECT id, progress, status, completed_at
    FROM task_progress
    WHERE user_id = @userId AND task_id = @taskId
    LIMIT 1
  `).all({ userId, taskId }) as TaskProgressRow[];

  return rows[0] ?? null;
}

function normalizeProgressRow(
  row: TaskProgressRow | null,
  repeatable: boolean,
  now: () => Date,
): Pick<TaskProgressRow, 'progress' | 'status'> {
  if (!row) {
    return { progress: 0, status: 'active' };
  }

  if (!repeatable) {
    return { progress: row.progress, status: row.status };
  }

  if ((row.status === 'completed' || row.status === 'claimed') && isPriorDay(row.completed_at, now())) {
    return { progress: 0, status: 'active' };
  }

  return { progress: row.progress, status: row.status };
}

function isPriorDay(timestamp: string | null, currentTime: Date): boolean {
  if (!timestamp) {
    return false;
  }

  return timestamp.slice(0, 10) !== currentTime.toISOString().slice(0, 10);
}
