export interface TaskRule {
  taskId: string;
  name: string;
  type: 'one-time' | 'daily' | 'achievement';
  target: number;
  rewardCoins: number;
  rewardExperience: number;
  repeatable: boolean;
}

export const taskRules: readonly TaskRule[] = [
  {
    taskId: 'new-player-plant-first-crop',
    name: 'Plant your first crop',
    type: 'one-time',
    target: 1,
    rewardCoins: 80,
    rewardExperience: 20,
    repeatable: false,
  },
  {
    taskId: 'daily-water',
    name: 'Water crops 5 times',
    type: 'daily',
    target: 5,
    rewardCoins: 30,
    rewardExperience: 10,
    repeatable: true,
  },
] as const;
