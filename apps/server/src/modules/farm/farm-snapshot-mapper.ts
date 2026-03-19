import type { FarmOperateAction, FarmSlotSummary, FarmSummary } from '@qq-classic-farm/protocol';
import type { CalculatedFarmSlotState } from './farm-calculator';

export interface FarmSnapshotFarmInput {
  farmId: string;
  ownerUserId: string;
  nickname: string;
  coins: number;
  experience: number;
  protectionUntil: string | null;
  currentTime: Date | string | number;
}

export interface FarmSnapshotSlotInput {
  calculated: CalculatedFarmSlotState;
  locked: boolean;
  isOwner: boolean;
  canVisit: boolean;
}

export function mapFarmSummary(input: FarmSnapshotFarmInput): FarmSummary {
  const protectionUntilMs = input.protectionUntil ? new Date(input.protectionUntil).getTime() : null;
  const currentTimeMs = new Date(input.currentTime).getTime();
  const dogActive = protectionUntilMs !== null && protectionUntilMs > currentTimeMs;

  return {
    farmId: input.farmId,
    ownerUserId: input.ownerUserId,
    nickname: input.nickname,
    level: Math.max(1, Math.floor(input.experience / 100) + 1),
    coins: input.coins,
    experience: input.experience,
    protectionUntil: input.protectionUntil,
    dog: {
      isActive: dogActive,
      protectionUntil: input.protectionUntil,
    },
  };
}

export function mapFarmSlotSummary(input: FarmSnapshotSlotInput): FarmSlotSummary {
  const availableActions = resolveAvailableActions(input);

  return {
    slotId: input.calculated.slot.slotId,
    cropId: input.calculated.slot.cropId,
    plantedAt: input.calculated.slot.plantedAt,
    maturedAt: input.calculated.slot.readyAt,
    withersAt: input.calculated.slot.withersAt,
    status: input.calculated.slot.status,
    stage: input.calculated.slot.stage,
    health: input.calculated.slot.health,
    locked: input.locked,
    availableActions,
  };
}

function resolveAvailableActions(input: FarmSnapshotSlotInput): readonly FarmOperateAction[] {
  if (input.locked) {
    return [];
  }

  const status = input.calculated.slot.status;
  const hasCrop = input.calculated.crop !== null;

  if (input.isOwner) {
    if (!hasCrop || status === 'empty') {
      return ['plant'];
    }

    if (status === 'growing') {
      return ['water', 'removeGrass', 'removeWorms', 'fertilize'];
    }

    if (status === 'mature') {
      return ['harvest'];
    }

    if (status === 'withered') {
      return ['clearDeadCrop'];
    }

    return [];
  }

  if (!input.canVisit || !hasCrop) {
    return [];
  }

  if (status === 'growing') {
    return ['help', 'throwWorms'];
  }

  if (status === 'mature') {
    return ['steal'];
  }

  return [];
}
