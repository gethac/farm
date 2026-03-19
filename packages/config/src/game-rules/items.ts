export interface ItemRule {
  itemId: string;
  name: string;
  category: 'seed' | 'tool' | 'consumable' | 'reward';
  price: number;
  sellPrice: number;
  stackLimit: number;
}

export const itemRules: readonly ItemRule[] = [
  {
    itemId: 'seed-rice',
    name: 'Rice Seed',
    category: 'seed',
    price: 12,
    sellPrice: 6,
    stackLimit: 99,
  },
  {
    itemId: 'seed-corn',
    name: 'Corn Seed',
    category: 'seed',
    price: 18,
    sellPrice: 9,
    stackLimit: 99,
  },
  {
    itemId: 'rice',
    name: 'Rice',
    category: 'reward',
    price: 0,
    sellPrice: 8,
    stackLimit: 999,
  },
  {
    itemId: 'corn',
    name: 'Corn',
    category: 'reward',
    price: 0,
    sellPrice: 10,
    stackLimit: 999,
  },
  {
    itemId: 'water-can',
    name: 'Water Can',
    category: 'tool',
    price: 0,
    sellPrice: 0,
    stackLimit: 1,
  },
] as const;
