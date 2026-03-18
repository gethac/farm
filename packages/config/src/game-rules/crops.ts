export interface CropRule {
  cropId: string;
  name: string;
  seedItemId: string;
  growthDurationMs: number;
  witherDurationMs: number;
  yield: number;
}

export const cropRules: readonly CropRule[] = [
  {
    cropId: 'rice',
    name: 'Rice',
    seedItemId: 'seed-rice',
    growthDurationMs: 10 * 60 * 1000,
    witherDurationMs: 20 * 60 * 1000,
    yield: 3,
  },
  {
    cropId: 'corn',
    name: 'Corn',
    seedItemId: 'seed-corn',
    growthDurationMs: 20 * 60 * 1000,
    witherDurationMs: 35 * 60 * 1000,
    yield: 4,
  },
] as const;
