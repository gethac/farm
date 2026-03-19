import type {
  FarmSlotSummary,
  FriendSummary,
  FriendRequestCreatedSummary,
  FriendAcceptSummary,
  FriendRemoveSummary,
  FriendRequestSummary,
  InventoryEntrySummary,
  InventoryMutationSummary,
  LeaderboardEntrySummary,
  NotificationSummary,
  ShopItemSummary,
  SocialVisitSummary,
  TaskSummary,
} from './messages';

export const eventNames = [
  'farm:getMine',
  'farm:getUser',
  'farm:operate',
  'shop:list',
  'shop:purchase',
  'inventory:list',
  'inventory:sell',
  'friends:list',
  'friends:request',
  'friends:accept',
  'friends:remove',
  'social:visit',
  'notice:list',
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
  'shop:purchase': InventoryMutationSummary;
  'inventory:list': { items: readonly InventoryEntrySummary[] };
  'inventory:sell': InventoryMutationSummary;
  'friends:list': {
    friends: readonly FriendSummary[];
    pendingReceived: readonly FriendRequestSummary[];
    pendingSent: readonly FriendRequestSummary[];
  };
  'friends:request': FriendRequestCreatedSummary;
  'friends:accept': FriendAcceptSummary;
  'friends:remove': FriendRemoveSummary;
  'social:visit': SocialVisitSummary;
  'notice:list': { notices: readonly NotificationSummary[] };
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
  'shop:purchase': { name: 'shop:purchase', kind: 'event' },
  'inventory:list': { name: 'inventory:list', kind: 'event' },
  'inventory:sell': { name: 'inventory:sell', kind: 'event' },
  'friends:list': { name: 'friends:list', kind: 'event' },
  'friends:request': { name: 'friends:request', kind: 'event' },
  'friends:accept': { name: 'friends:accept', kind: 'event' },
  'friends:remove': { name: 'friends:remove', kind: 'event' },
  'social:visit': { name: 'social:visit', kind: 'event' },
  'notice:list': { name: 'notice:list', kind: 'event' },
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
