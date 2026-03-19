import { leaderboardRules } from '@qq-classic-farm/config';
import type { LeaderboardEntrySummary } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';

interface FarmMetricRow {
  user_id: string;
  nickname: string;
  coins: number;
  experience: number;
}

export interface RankingService {
  refreshAll(): { updatedEntryCount: number };
  refresh(leaderboardId: string): { updatedEntryCount: number };
  list(leaderboardId: string): readonly LeaderboardEntrySummary[];
}

export function createRankingService(database: DatabaseClient): RankingService {
  return {
    refreshAll() {
      return leaderboardRules.reduce(
        (total, rule) => {
          const result = this.refresh(rule.leaderboardId);
          return { updatedEntryCount: total.updatedEntryCount + result.updatedEntryCount };
        },
        { updatedEntryCount: 0 },
      );
    },

    refresh(leaderboardId) {
      const rule = leaderboardRules.find((item) => item.leaderboardId === leaderboardId);
      if (!rule) {
        return { updatedEntryCount: 0 };
      }

      const metricRows = database.prepare(`
        SELECT farms.user_id, users.display_name AS nickname, farms.coins, farms.experience
        FROM farms
        INNER JOIN users ON users.id = farms.user_id
      `).all() as FarmMetricRow[];
      const sorted = [...metricRows].sort((left, right) => {
        const leftValue = rule.metric === 'coins' ? left.coins : left.experience;
        const rightValue = rule.metric === 'coins' ? right.coins : right.experience;
        return rightValue - leftValue || left.nickname.localeCompare(right.nickname);
      });

      database.prepare(`
        DELETE FROM leaderboard_entries
        WHERE leaderboard_id = @leaderboardId AND user_id IS NOT NULL
      `).run({ leaderboardId });

      let updatedEntryCount = 0;
      for (let index = 0; index < sorted.length; index += 1) {
        const row = sorted[index];
        if (!row) {
          continue;
        }

        const value = rule.metric === 'coins' ? row.coins : row.experience;
        database.prepare(`
          INSERT INTO leaderboard_entries (
            id, leaderboard_id, leaderboard_name, metric_name, period, descending,
            user_id, metric_value, rank_position, period_started_at, period_ended_at, refreshed_at, meta_json
          ) VALUES (
            @id, @leaderboardId, @leaderboardName, @metricName, @period, @descending,
            @userId, @metricValue, @rankPosition, NULL, NULL, CURRENT_TIMESTAMP, @metaJson
          )
        `).run({
          id: `${leaderboardId}:${row.user_id}`,
          leaderboardId,
          leaderboardName: rule.name,
          metricName: rule.metric,
          period: rule.period,
          descending: rule.descending ? 1 : 0,
          userId: row.user_id,
          metricValue: value,
          rankPosition: index + 1,
          metaJson: JSON.stringify({ nickname: row.nickname }),
        });
        updatedEntryCount += 1;
      }

      return { updatedEntryCount };
    },

    list(leaderboardId) {
      const rows = database.prepare(`
        SELECT user_id, metric_value, rank_position, meta_json
        FROM leaderboard_entries
        WHERE leaderboard_id = @leaderboardId AND user_id IS NOT NULL
        ORDER BY rank_position ASC
      `).all({ leaderboardId }) as Array<{
        user_id: string;
        metric_value: number;
        rank_position: number;
        meta_json: string;
      }>;

      return rows.map((row) => ({
        rank: row.rank_position,
        userId: row.user_id,
        nickname: parseNickname(row.meta_json),
        value: row.metric_value,
      })) satisfies readonly LeaderboardEntrySummary[];
    },
  };
}

function parseNickname(metaJson: string): string {
  try {
    const parsed = JSON.parse(metaJson) as { nickname?: string };
    return parsed.nickname ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}
