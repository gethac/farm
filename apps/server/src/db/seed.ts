import type { DatabaseSync } from 'node:sqlite';
import { leaderboardRules, taskRules } from '@qq-classic-farm/config';

export function seed(database: DatabaseSync): void {
  const upsertTask = database.prepare(`
    INSERT INTO tasks (
      task_id,
      name,
      type,
      target,
      reward_coins,
      reward_experience,
      repeatable,
      source,
      created_at,
      updated_at
    ) VALUES (
      @taskId,
      @name,
      @type,
      @target,
      @rewardCoins,
      @rewardExperience,
      @repeatable,
      'config',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(task_id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      target = excluded.target,
      reward_coins = excluded.reward_coins,
      reward_experience = excluded.reward_experience,
      repeatable = excluded.repeatable,
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP
  `);

  const upsertLeaderboard = database.prepare(`
    INSERT INTO leaderboard_entries (
      id,
      leaderboard_id,
      leaderboard_name,
      metric_name,
      period,
      descending,
      user_id,
      metric_value,
      rank_position,
      period_started_at,
      period_ended_at,
      refreshed_at,
      meta_json
    ) VALUES (
      @id,
      @leaderboardId,
      @leaderboardName,
      @metricName,
      @period,
      @descending,
      NULL,
      0,
      0,
      NULL,
      NULL,
      CURRENT_TIMESTAMP,
      '{}'
    )
    ON CONFLICT(leaderboard_id, user_id, period_started_at, period_ended_at) DO UPDATE SET
      leaderboard_name = excluded.leaderboard_name,
      metric_name = excluded.metric_name,
      period = excluded.period,
      descending = excluded.descending,
      refreshed_at = CURRENT_TIMESTAMP
  `);

  database.exec('BEGIN IMMEDIATE');

  try {
    for (const rule of taskRules) {
      upsertTask.run({
        taskId: rule.taskId,
        name: rule.name,
        type: rule.type,
        target: rule.target,
        rewardCoins: rule.rewardCoins,
        rewardExperience: rule.rewardExperience,
        repeatable: rule.repeatable ? 1 : 0,
      });
    }

    for (const rule of leaderboardRules) {
      upsertLeaderboard.run({
        id: rule.leaderboardId,
        leaderboardId: rule.leaderboardId,
        leaderboardName: rule.name,
        metricName: rule.metric,
        period: rule.period,
        descending: rule.descending ? 1 : 0,
      });
    }

    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
