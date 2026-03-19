import type { EventMessageName } from './events';

export const requestNames = [
  'farm:getMine',
  'farm:getUser',
  'farm:operate',
  'shop:list',
  'inventory:list',
  'friends:list',
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

export interface RequestPayloadMap {
  'farm:getMine': Record<string, never>;
  'farm:getUser': { userId: string };
  'farm:operate': FarmOperateRequest;
  'shop:list': Record<string, never>;
  'inventory:list': Record<string, never>;
  'friends:list': Record<string, never>;
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
  'inventory:list': { items: readonly InventoryEntrySummary[] };
  'friends:list': { friends: readonly FriendSummary[] };
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
  'inventory:list': { name: 'inventory:list', kind: 'request' },
  'friends:list': { name: 'friends:list', kind: 'request' },
  'tasks:list': { name: 'tasks:list', kind: 'request' },
  'ranking:list': { name: 'ranking:list', kind: 'request' },
} as const satisfies Record<RequestMessageName, RequestDefinition>;
