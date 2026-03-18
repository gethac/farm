export interface ItemRule {
  itemId: string;
  name: string;
  category: 'seed' | 'tool' | 'consumable' | 'reward';
  price: number;
  stackLimit: number;
}

export const itemRules: readonly ItemRule[] = [
  {
    itemId: 'seed-rice',
    name: 'Rice Seed',
    category: 'seed',
    price: 12,
    stackLimit: 99,
  },
  {
    itemId: 'seed-corn',
    name: 'Corn Seed',
    category: 'seed',
    price: 18,
    stackLimit: 99,
  },
  {
    itemId: 'water-can',
    name: 'Water Can',
    category: 'tool',
    price: 0,
    stackLimit: 1,
  },
] as const;
