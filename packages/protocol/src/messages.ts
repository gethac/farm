import type { EventMessageName } from './events';

export const requestNames = [
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
] as const;

export type RequestMessageName = (typeof requestNames)[number];

export type FarmOperateAction =
  | 'plant'
  | 'water'
  | 'removeGrass'
  | 'removeWorms'
  | 'fertilize'
  | 'harvest'
  | 'clearDeadCrop'
  | 'steal'
  | 'help'
  | 'throwWorms';

export interface FarmDogSummary {
  isActive: boolean;
  protectionUntil: string | null;
}

export interface FarmSummary {
  farmId: string;
  ownerUserId: string;
  nickname: string;
  level: number;
  coins: number;
  experience: number;
  protectionUntil?: string | null;
  dog: FarmDogSummary;
}

export interface FarmSlotSummary {
  slotId: string;
  cropId: string | null;
  plantedAt: string | null;
  maturedAt: string | null;
  withersAt: string | null;
  status: 'empty' | 'growing' | 'mature' | 'withered';
  stage: number;
  health: number;
  locked: boolean;
  availableActions: readonly FarmOperateAction[];
}

export interface InventoryEntrySummary {
  itemId: string;
  quantity: number;
}

export interface FriendSummary {
  userId: string;
  nickname: string;
  canVisit: boolean;
  lastVisitAt?: string | null;
}

export interface FriendRequestSummary {
  requestId: string;
  requesterUserId: string;
  requesterNickname: string;
  addresseeUserId: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  requestedAt: string;
}

export interface NotificationSummary {
  noticeId: string;
  notificationType: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
}

export interface TaskSummary {
  taskId: string;
  progress: number;
  target: number;
  isClaimed: boolean;
}

export interface LeaderboardEntrySummary {
  rank: number;
  userId: string;
  nickname: string;
  value: number;
}

export interface ShopItemSummary {
  itemId: string;
  name: string;
  price: number;
  category: 'seed' | 'tool' | 'consumable';
}

export interface InventoryMutationSummary {
  farm: FarmSummary;
  inventory: readonly InventoryEntrySummary[];
  affectedEventNames: readonly EventMessageName[];
}

export interface FriendRequestMutationSummary {
  affectedEventNames: readonly EventMessageName[];
}

export interface FriendRequestCreatedSummary extends FriendRequestMutationSummary {
  requestId: string;
}

export interface FriendAcceptSummary extends FriendRequestMutationSummary {
  friendshipId: string;
}

export interface FriendRemoveSummary extends FriendRequestMutationSummary {
  removedUserId: string;
}

export interface SocialVisitSummary {
  visitId: string;
  affectedEventNames: readonly EventMessageName[];
}

export interface FarmOperateBaseRequest {
  farmId: string;
  slotId: string;
}

export interface PlantCropOperateRequest extends FarmOperateBaseRequest {
  action: 'plant';
  itemId: string;
}

export interface WaterOperateRequest extends FarmOperateBaseRequest {
  action: 'water';
}

export interface RemoveGrassOperateRequest extends FarmOperateBaseRequest {
  action: 'removeGrass';
}

export interface RemoveWormsOperateRequest extends FarmOperateBaseRequest {
  action: 'removeWorms';
}

export interface FertilizeOperateRequest extends FarmOperateBaseRequest {
  action: 'fertilize';
  itemId: string;
}

export interface HarvestOperateRequest extends FarmOperateBaseRequest {
  action: 'harvest';
}

export interface ClearDeadCropOperateRequest extends FarmOperateBaseRequest {
  action: 'clearDeadCrop';
}

export interface StealOperateRequest extends FarmOperateBaseRequest {
  action: 'steal';
  targetUserId: string;
  targetSlotId: string;
  quantity: number;
}

export interface HelpOperateRequest extends FarmOperateBaseRequest {
  action: 'help';
  targetUserId: string;
  targetSlotId: string;
}

export interface ThrowWormsOperateRequest extends FarmOperateBaseRequest {
  action: 'throwWorms';
  targetUserId: string;
  targetSlotId: string;
}

export type FarmOperateRequest =
  | PlantCropOperateRequest
  | WaterOperateRequest
  | RemoveGrassOperateRequest
  | RemoveWormsOperateRequest
  | FertilizeOperateRequest
  | HarvestOperateRequest
  | ClearDeadCropOperateRequest
  | StealOperateRequest
  | HelpOperateRequest
  | ThrowWormsOperateRequest;

export interface ShopPurchaseRequest {
  itemId: string;
  quantity: number;
}

export interface InventorySellRequest {
  itemId: string;
  quantity: number;
}

export interface FriendRequestCreateRequest {
  targetUserId: string;
  message?: string;
}

export interface FriendRequestAcceptRequest {
  requestId: string;
}

export interface FriendRemoveRequest {
  targetUserId: string;
}

export interface SocialVisitRequest {
  targetUserId: string;
}

export interface RequestPayloadMap {
  'farm:getMine': Record<string, never>;
  'farm:getUser': { userId: string };
  'farm:operate': FarmOperateRequest;
  'shop:list': Record<string, never>;
  'shop:purchase': ShopPurchaseRequest;
  'inventory:list': Record<string, never>;
  'inventory:sell': InventorySellRequest;
  'friends:list': Record<string, never>;
  'friends:request': FriendRequestCreateRequest;
  'friends:accept': FriendRequestAcceptRequest;
  'friends:remove': FriendRemoveRequest;
  'social:visit': SocialVisitRequest;
  'notice:list': Record<string, never>;
  'tasks:list': Record<string, never>;
  'ranking:list': { rankingId?: string };
}

export interface ResponsePayloadMap {
  'farm:getMine': { farm: FarmSummary; slots: readonly FarmSlotSummary[] };
  'farm:getUser': {
    farm: FarmSummary;
    slots: readonly FarmSlotSummary[];
    isFriend: boolean;
    canVisit: boolean;
  };
  'farm:operate': {
    farm: FarmSummary;
    slots: readonly FarmSlotSummary[];
    affectedEventNames: readonly EventMessageName[];
  };
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
}

export interface RequestDefinition<Name extends RequestMessageName = RequestMessageName> {
  name: Name;
  kind: 'request';
}

export interface RequestEnvelope<Name extends RequestMessageName = RequestMessageName> {
  requestId: string;
  message: Name;
  payload: RequestPayloadMap[Name];
}

export interface ResponseEnvelope<Name extends RequestMessageName = RequestMessageName> {
  requestId: string;
  message: Name;
  payload: ResponsePayloadMap[Name];
}

export const requests = {
  'farm:getMine': { name: 'farm:getMine', kind: 'request' },
  'farm:getUser': { name: 'farm:getUser', kind: 'request' },
  'farm:operate': { name: 'farm:operate', kind: 'request' },
  'shop:list': { name: 'shop:list', kind: 'request' },
  'shop:purchase': { name: 'shop:purchase', kind: 'request' },
  'inventory:list': { name: 'inventory:list', kind: 'request' },
  'inventory:sell': { name: 'inventory:sell', kind: 'request' },
  'friends:list': { name: 'friends:list', kind: 'request' },
  'friends:request': { name: 'friends:request', kind: 'request' },
  'friends:accept': { name: 'friends:accept', kind: 'request' },
  'friends:remove': { name: 'friends:remove', kind: 'request' },
  'social:visit': { name: 'social:visit', kind: 'request' },
  'notice:list': { name: 'notice:list', kind: 'request' },
  'tasks:list': { name: 'tasks:list', kind: 'request' },
  'ranking:list': { name: 'ranking:list', kind: 'request' },
} as const satisfies Record<RequestMessageName, RequestDefinition>;
