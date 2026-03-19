import { randomUUID } from 'node:crypto';
import { taskRules } from '@qq-classic-farm/config';
import type { EventMessageName, FarmSummary, TaskSummary } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';
import { runInTransaction } from '../../lib/transactions';
import { mapFarmSummary } from '../farm/farm-snapshot-mapper';
import { FarmOperationError } from '../farm/farm-operation-service';
import type { NotificationService } from '../notifications/notification-service';

interface TaskRuleRow {
  task_id: string;
  target: number;
  reward_coins: number;
  reward_experience: number;
  repeatable: number;
}

interface TaskProgressRow {
  id: string;
  task_id: string;
  progress: number;
  status: 'locked' | 'active' | 'completed' | 'claimed';
  completed_at: string | null;
}

interface FarmRow {
  farm_id: string;
  owner_user_id: string;
  nickname: string;
  coins: number;
  experience: number;
}

export interface TaskClaimResult {
  farm: FarmSummary;
  tasks: readonly TaskSummary[];
  affectedEventNames: readonly EventMessageName[];
}

export interface TaskService {
  list(userId: string): readonly TaskSummary[];
  claimReward(userId: string, taskId: string): TaskClaimResult;
  syncUserProgress(userId: string): number;
  syncAllUsers(): number;
}

export function createTaskService(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
  notificationService?: NotificationService,
): TaskService {
  return {
    list(userId) {
      this.syncUserProgress(userId);
      return listTasks(userId);
    },

    claimReward(userId, taskId) {
      return runInTransaction(database, () => {
        this.syncUserProgress(userId);

        const taskRule = findTaskRule(taskId);
        if (!taskRule) {
          throw new FarmOperationError('NOT_FOUND', 'Task not found');
        }

        const progressRow = requireTaskProgress(database, userId, taskId);
        if (progressRow.status !== 'completed') {
          throw new FarmOperationError('CONFLICT', 'Task reward is not claimable');
        }

        database.prepare(`
          UPDATE farms
          SET coins = coins + @coins,
              experience = experience + @experience,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = @userId
        `).run({
          userId,
          coins: taskRule.reward_coins,
          experience: taskRule.reward_experience,
        });

        database.prepare(`
          UPDATE task_progress
          SET status = 'claimed',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = @id
        `).run({ id: progressRow.id });

        notificationService?.create({
          userId,
          notificationType: 'task-reward',
          title: '任务奖励已领取',
          body: `领取了任务奖励：${taskRule.reward_coins} 金币，${taskRule.reward_experience} 经验`,
          sourceTable: 'task_progress',
          sourceId: progressRow.id,
        });

        return {
          farm: buildFarmSummary(userId),
          tasks: listTasks(userId),
          affectedEventNames: ['task:updated', 'notice:new'],
        };
      });
    },

    syncUserProgress(userId) {
      let changedCount = 0;
      const hasPlantedCropHistory = hasAnyCropHistory(database, userId);
      const rules = listTaskRules();

      for (const rule of rules) {
        const existing = findTaskProgress(database, userId, rule.task_id);
        const derived = deriveTaskSnapshot({
          rule,
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
          taskId: rule.task_id,
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

  function listTasks(userId: string): readonly TaskSummary[] {
    const rows = database.prepare(`
      SELECT task_id, progress, status
      FROM task_progress
      WHERE user_id = @userId
      ORDER BY task_id ASC
    `).all({ userId }) as Array<{ task_id: string; progress: number; status: TaskProgressRow['status'] }>;

    const targetByTaskId = new Map(listTaskRules().map((rule) => [rule.task_id, rule.target]));
    return rows.map((row) => ({
      taskId: row.task_id,
      progress: row.progress,
      target: targetByTaskId.get(row.task_id) ?? 0,
      isClaimed: row.status === 'claimed',
    }));
  }

  function buildFarmSummary(userId: string): FarmSummary {
    const farm = requireFarm(userId);
    return mapFarmSummary({
      farmId: farm.farm_id,
      ownerUserId: farm.owner_user_id,
      nickname: farm.nickname,
      coins: farm.coins,
      experience: farm.experience,
      protectionUntil: null,
      currentTime: now(),
    });
  }

  function requireFarm(userId: string): FarmRow {
    const rows = database.prepare(`
      SELECT
        farms.id AS farm_id,
        users.id AS owner_user_id,
        users.display_name AS nickname,
        farms.coins,
        farms.experience
      FROM farms
      INNER JOIN users ON users.id = farms.user_id
      WHERE farms.user_id = @userId
      LIMIT 1
    `).all({ userId }) as FarmRow[];

    const farm = rows[0];
    if (!farm) {
      throw new FarmOperationError('NOT_FOUND', 'Farm not found');
    }

    return farm;
  }
}

function listTaskRules(): TaskRuleRow[] {
  return taskRules.map((rule) => ({
    task_id: rule.taskId,
    target: rule.target,
    reward_coins: rule.rewardCoins,
    reward_experience: rule.rewardExperience,
    repeatable: rule.repeatable ? 1 : 0,
  }));
}

function findTaskRule(taskId: string): TaskRuleRow | null {
  return listTaskRules().find((rule) => rule.task_id === taskId) ?? null;
}

function findTaskProgress(database: DatabaseClient, userId: string, taskId: string): TaskProgressRow | null {
  const rows = database.prepare(`
    SELECT id, task_id, progress, status, completed_at
    FROM task_progress
    WHERE user_id = @userId AND task_id = @taskId
    LIMIT 1
  `).all({ userId, taskId }) as TaskProgressRow[];

  return rows[0] ?? null;
}

function requireTaskProgress(database: DatabaseClient, userId: string, taskId: string): TaskProgressRow {
  const row = findTaskProgress(database, userId, taskId);
  if (!row) {
    throw new FarmOperationError('NOT_FOUND', 'Task progress not found');
  }

  return row;
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
  rule: TaskRuleRow;
  hasPlantedCropHistory: boolean;
  existing: TaskProgressRow | null;
  now: () => Date;
}): { progress: number; status: TaskProgressRow['status']; completedAt: string | null } {
  const normalizedExisting = normalizeDailyReset(input.rule, input.existing, input.now);

  if (normalizedExisting?.status === 'claimed' && input.rule.repeatable === 0) {
    return {
      progress: Math.max(normalizedExisting.progress, input.rule.target),
      status: 'claimed',
      completedAt: normalizedExisting.completed_at ?? input.now().toISOString(),
    };
  }

  if (input.rule.task_id === 'new-player-plant-first-crop') {
    const progress = input.hasPlantedCropHistory
      ? Math.max(normalizedExisting?.progress ?? 0, input.rule.target)
      : normalizedExisting?.progress ?? 0;
    const status = normalizedExisting?.status === 'claimed'
      ? 'claimed'
      : progress >= input.rule.target ? 'completed' : 'active';
    const completedAt = status === 'completed' || status === 'claimed'
      ? normalizedExisting?.completed_at ?? input.now().toISOString()
      : null;

    return { progress, status, completedAt };
  }

  return {
    progress: normalizedExisting?.progress ?? 0,
    status: normalizedExisting?.status ?? 'active',
    completedAt: normalizedExisting?.completed_at ?? null,
  };
}

function normalizeDailyReset(
  rule: TaskRuleRow,
  existing: TaskProgressRow | null,
  now: () => Date,
): TaskProgressRow | null {
  if (!existing) {
    return null;
  }

  if (rule.repeatable === 1 && (existing.status === 'completed' || existing.status === 'claimed')) {
    const completedDate = existing.completed_at?.slice(0, 10);
    const currentDate = now().toISOString().slice(0, 10);
    if (completedDate && completedDate !== currentDate) {
      return {
        ...existing,
        progress: 0,
        status: 'active',
        completed_at: null,
      };
    }
  }

  return existing;
}
