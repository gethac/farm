export interface LeaderboardRule {
  leaderboardId: string;
  name: string;
  metric: 'coins' | 'experience' | 'harvests' | 'steals';
  period: 'all-time' | 'daily' | 'weekly';
  descending: boolean;
}

export const leaderboardRules: readonly LeaderboardRule[] = [
  {
    leaderboardId: 'coins-all-time',
    name: 'Rich Farmers',
    metric: 'coins',
    period: 'all-time',
    descending: true,
  },
  {
    leaderboardId: 'experience-all-time',
    name: 'Top Growers',
    metric: 'experience',
    period: 'all-time',
    descending: true,
  },
] as const;
