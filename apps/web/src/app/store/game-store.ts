import { useSyncExternalStore } from 'react';
import type {
  EventEnvelope,
  FarmSlotSummary,
  FarmSummary,
  FriendSummary,
  InventoryEntrySummary,
  LeaderboardEntrySummary,
  NotificationSummary,
  ShopItemSummary,
  TaskSummary,
} from '@qq-classic-farm/protocol';
import type { AppTabId } from '../router';

export interface GameState {
  activeTab: AppTabId;
  coins: number;
  experience: number;
  level: number;
  farm: FarmSummary;
  slots: readonly FarmSlotSummary[];
  friends: readonly FriendSummary[];
  inventoryItems: readonly InventoryEntrySummary[];
  shopItems: readonly ShopItemSummary[];
  tasks: readonly TaskSummary[];
  rankingEntries: readonly LeaderboardEntrySummary[];
  notices: readonly NotificationSummary[];
  selectedSlotId: string | null;
  selectedFriendUserId: string | null;
  notificationsOpen: boolean;
}

export function createInitialGameState(): GameState {
  const farm: FarmSummary = {
    farmId: 'farm-me',
    ownerUserId: 'user-me',
    nickname: '我的农场',
    level: 6,
    coins: 520,
    experience: 188,
    protectionUntil: null,
    dog: {
      isActive: true,
      protectionUntil: '2026-03-19T18:00:00.000Z',
    },
  };

  const slots: FarmSlotSummary[] = [
    {
      slotId: 'slot-1',
      cropId: null,
      plantedAt: null,
      maturedAt: null,
      withersAt: null,
      status: 'empty',
      stage: 0,
      health: 100,
      locked: false,
      availableActions: ['plant'],
    },
    {
      slotId: 'slot-2',
      cropId: 'corn',
      plantedAt: '2026-03-19T09:30:00.000Z',
      maturedAt: '2026-03-19T12:00:00.000Z',
      withersAt: '2026-03-19T16:00:00.000Z',
      status: 'growing',
      stage: 2,
      health: 92,
      locked: false,
      availableActions: ['water', 'removeGrass', 'removeWorms', 'fertilize'],
    },
    {
      slotId: 'slot-3',
      cropId: 'wheat',
      plantedAt: '2026-03-19T08:00:00.000Z',
      maturedAt: '2026-03-19T09:00:00.000Z',
      withersAt: '2026-03-19T12:00:00.000Z',
      status: 'mature',
      stage: 3,
      health: 100,
      locked: false,
      availableActions: ['harvest'],
    },
    {
      slotId: 'slot-4',
      cropId: 'carrot',
      plantedAt: '2026-03-19T05:30:00.000Z',
      maturedAt: '2026-03-19T07:30:00.000Z',
      withersAt: '2026-03-19T09:30:00.000Z',
      status: 'withered',
      stage: 4,
      health: 35,
      locked: false,
      availableActions: ['clearDeadCrop'],
    },
    {
      slotId: 'slot-5',
      cropId: null,
      plantedAt: null,
      maturedAt: null,
      withersAt: null,
      status: 'empty',
      stage: 0,
      health: 100,
      locked: false,
      availableActions: ['plant'],
    },
    {
      slotId: 'slot-6',
      cropId: null,
      plantedAt: null,
      maturedAt: null,
      withersAt: null,
      status: 'empty',
      stage: 0,
      health: 100,
      locked: true,
      availableActions: [],
    },
  ];

  const friends: FriendSummary[] = [
    { userId: 'friend-1', nickname: '小葵', canVisit: true, lastVisitAt: null },
    { userId: 'friend-2', nickname: '阿牧', canVisit: true, lastVisitAt: '2026-03-19T08:15:00.000Z' },
    { userId: 'friend-3', nickname: '多多', canVisit: false, lastVisitAt: null },
  ];

  const inventoryItems: InventoryEntrySummary[] = [
    { itemId: 'wheat', quantity: 18 },
    { itemId: 'corn-seed', quantity: 6 },
    { itemId: 'fertilizer', quantity: 3 },
  ];

  const shopItems: ShopItemSummary[] = [
    { itemId: 'corn-seed', name: '玉米种子', price: 18, category: 'seed' },
    { itemId: 'carrot-seed', name: '胡萝卜种子', price: 15, category: 'seed' },
    { itemId: 'fertilizer', name: '高级化肥', price: 42, category: 'consumable' },
  ];

  const tasks: TaskSummary[] = [
    { taskId: 'new-player-plant-first-crop', progress: 0, target: 1, isClaimed: false },
    { taskId: 'daily-water', progress: 2, target: 5, isClaimed: false },
  ];

  const rankingEntries: LeaderboardEntrySummary[] = [
    { rank: 1, userId: 'friend-1', nickname: '小葵', value: 880 },
    { rank: 2, userId: 'user-me', nickname: '农场主', value: 520 },
    { rank: 3, userId: 'friend-2', nickname: '阿牧', value: 460 },
  ];

  const notices: NotificationSummary[] = [
    {
      noticeId: 'notice-1',
      notificationType: 'system',
      title: '今日播报',
      body: '好友地块有新的成熟作物。',
      createdAt: '2026-03-19T10:30:00.000Z',
      isRead: false,
    },
  ];

  return {
    activeTab: 'farm',
    coins: farm.coins,
    experience: farm.experience,
    level: farm.level,
    farm,
    slots,
    friends,
    inventoryItems,
    shopItems,
    tasks,
    rankingEntries,
    notices,
    selectedSlotId: null,
    selectedFriendUserId: friends[0]?.userId ?? null,
    notificationsOpen: false,
  };
}

let state: GameState = createInitialGameState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reduceRealtimeEvent(currentState: GameState, event: EventEnvelope): GameState {
  switch (event.message) {
    case 'farm:slotUpdated': {
      const payload = event.payload as { farmId: string; slot: FarmSlotSummary };
      return {
        ...currentState,
        slots: currentState.slots.map((slot) => (
          slot.slotId === payload.slot.slotId ? payload.slot : slot
        )),
      };
    }
    case 'task:updated': {
      const payload = event.payload as { taskId: string; progress: number; target: number };
      const nextTasks = currentState.tasks.some((task) => task.taskId === payload.taskId)
        ? currentState.tasks.map((task) => (
          task.taskId === payload.taskId
            ? { ...task, progress: payload.progress, target: payload.target }
            : task
        ))
        : [...currentState.tasks, { taskId: payload.taskId, progress: payload.progress, target: payload.target, isClaimed: false }];
      return { ...currentState, tasks: nextTasks };
    }
    case 'notice:new': {
      const payload = event.payload as { noticeId: string; kind: string; message: string };
      return {
        ...currentState,
        notices: [
          {
            noticeId: payload.noticeId,
            notificationType: payload.kind,
            title: '最新提醒',
            body: payload.message,
            createdAt: '2026-03-19T11:30:00.000Z',
            isRead: false,
          },
          ...currentState.notices,
        ],
      };
    }
    default:
      return currentState;
  }
}

export function useGameStoreSnapshot(): GameState {
  return state;
}

export const gameActions = {
  setActiveTab(activeTab: AppTabId) {
    state = { ...state, activeTab };
    emit();
  },
  selectSlot(slotId: string | null) {
    state = { ...state, selectedSlotId: slotId };
    emit();
  },
  selectFriend(userId: string | null) {
    state = { ...state, selectedFriendUserId: userId };
    emit();
  },
  setNotificationsOpen(notificationsOpen: boolean) {
    state = { ...state, notificationsOpen };
    emit();
  },
  applyRealtimeEvent(event: EventEnvelope) {
    state = reduceRealtimeEvent(state, event);
    emit();
  },
  reset() {
    state = createInitialGameState();
    emit();
  },
};

export function useGameStore(): GameState {
  return useSyncExternalStore(subscribe, useGameStoreSnapshot, useGameStoreSnapshot);
}
