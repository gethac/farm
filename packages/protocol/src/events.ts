import type {
  FarmSlotSummary,
  FriendSummary,
  InventoryEntrySummary,
  LeaderboardEntrySummary,
  ShopItemSummary,
  TaskSummary,
} from './messages';

export const eventNames = [
  'farm:getMine',
  'farm:getUser',
  'farm:operate',
  'shop:list',
  'inventory:list',
  'friends:list',
  'tasks:list',
  'ranking:list',
  'farm:slotUpdated',
  'farm:cropMatured',
  'task:updated',
  'task:claimable',
  'notice:new',
  'social:interactionReceived',
] as const;

export type EventMessageName = (typeof eventNames)[number];

export interface EventPayloadMap {
  'farm:getMine': { slots: readonly FarmSlotSummary[] };
  'farm:getUser': { slots: readonly FarmSlotSummary[] };
  'farm:operate': { slots: readonly FarmSlotSummary[] };
  'shop:list': { items: readonly ShopItemSummary[] };
  'inventory:list': { items: readonly InventoryEntrySummary[] };
  'friends:list': { friends: readonly FriendSummary[] };
  'tasks:list': { tasks: readonly TaskSummary[] };
  'ranking:list': { entries: readonly LeaderboardEntrySummary[] };
  'farm:slotUpdated': { farmId: string; slot: FarmSlotSummary };
  'farm:cropMatured': { farmId: string; slotId: string; cropId: string };
  'task:updated': { taskId: string; progress: number; target: number };
  'task:claimable': { taskId: string };
  'notice:new': { noticeId: string; kind: string; message: string };
  'social:interactionReceived': {
    fromUserId: string;
    kind: 'help' | 'steal' | 'visit' | 'gift';
  };
}

export interface EventDefinition<Name extends EventMessageName = EventMessageName> {
  name: Name;
  kind: 'event';
}

export const events = {
  'farm:getMine': { name: 'farm:getMine', kind: 'event' },
  'farm:getUser': { name: 'farm:getUser', kind: 'event' },
  'farm:operate': { name: 'farm:operate', kind: 'event' },
  'shop:list': { name: 'shop:list', kind: 'event' },
  'inventory:list': { name: 'inventory:list', kind: 'event' },
  'friends:list': { name: 'friends:list', kind: 'event' },
  'tasks:list': { name: 'tasks:list', kind: 'event' },
  'ranking:list': { name: 'ranking:list', kind: 'event' },
  'farm:slotUpdated': { name: 'farm:slotUpdated', kind: 'event' },
  'farm:cropMatured': { name: 'farm:cropMatured', kind: 'event' },
  'task:updated': { name: 'task:updated', kind: 'event' },
  'task:claimable': { name: 'task:claimable', kind: 'event' },
  'notice:new': { name: 'notice:new', kind: 'event' },
  'social:interactionReceived': { name: 'social:interactionReceived', kind: 'event' },
} as const satisfies Record<EventMessageName, EventDefinition>;

export interface EventEnvelope<Name extends EventMessageName = EventMessageName> {
  message: Name;
  payload: EventPayloadMap[Name];
}
