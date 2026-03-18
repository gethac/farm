import type { CropRule, SystemRule } from '@qq-classic-farm/config';
import { calculateCropGrowthStage, calculateCropHealthCoefficient, calculateCropYield, deriveFarmConditionStates } from './farm-rules';
import { toIsoString, toEpochMs } from '../../lib/time';

export type FarmSlotStatus = 'empty' | 'growing' | 'mature' | 'withered';

export interface FarmSlotStateInput {
  slot: {
    slotId: string;
    cropId: string | null;
    plantedAt: Date | string | number | null;
    waterLevel: number;
    grassLevel: number;
    wormLevel: number;
  };
  cropRule: CropRule;
  currentTime: Date | string | number;
  systemRule: SystemRule;
}

export interface CalculatedFarmCropState {
  cropId: string;
  plantedAt: string;
  readyAt: string;
  withersAt: string;
  status: Exclude<FarmSlotStatus, 'empty'>;
  stage: number;
  healthCoefficient: number;
  yield: number;
}

export interface CalculatedFarmSlotState {
  slot: {
    slotId: string;
    cropId: string | null;
    plantedAt: string | null;
    readyAt: string | null;
    withersAt: string | null;
    status: FarmSlotStatus;
    stage: number;
    health: number;
  };
  crop: CalculatedFarmCropState | null;
}

export function calculateFarmSlotState(input: FarmSlotStateInput): CalculatedFarmSlotState {
  const plantedAt = input.slot.plantedAt;
  if (!input.slot.cropId || plantedAt == null) {
    return {
      slot: {
        slotId: input.slot.slotId,
        cropId: null,
        plantedAt: null,
        readyAt: null,
        withersAt: null,
        status: 'empty',
        stage: 0,
        health: 100,
      },
      crop: null,
    };
  }

  const plantedAtMs = toEpochMs(plantedAt);
  const readyAtMs = plantedAtMs + resolveGrowthDurationMs(input.cropRule, input.systemRule);
  const withersAtMs = readyAtMs + resolveWitherDurationMs(input.cropRule, input.systemRule);
  const currentTimeMs = toEpochMs(input.currentTime);
  const stage = calculateCropGrowthStage({
    plantedAt,
    currentTime: input.currentTime,
    cropRule: input.cropRule,
    systemRule: input.systemRule,
  });
  const status = resolveSlotStatus(currentTimeMs, readyAtMs, withersAtMs);
  const cropStatus = status === 'empty' ? 'growing' : status;
  const conditions = deriveFarmConditionStates(input.slot);
  const healthCoefficient = calculateCropHealthCoefficient(conditions);
  const health = Math.round(healthCoefficient * 100);
  const yieldAmount = cropStatus === 'mature' ? calculateCropYield(input.cropRule.yield, healthCoefficient) : 0;

  return {
    slot: {
      slotId: input.slot.slotId,
      cropId: input.slot.cropId,
      plantedAt: toIsoString(plantedAtMs),
      readyAt: toIsoString(readyAtMs),
      withersAt: toIsoString(withersAtMs),
      status,
      stage,
      health,
    },
    crop: {
      cropId: input.cropRule.cropId,
      plantedAt: toIsoString(plantedAtMs),
      readyAt: toIsoString(readyAtMs),
      withersAt: toIsoString(withersAtMs),
      status: cropStatus,
      stage,
      healthCoefficient,
      yield: yieldAmount,
    },
  };
}

function resolveGrowthDurationMs(cropRule: CropRule, systemRule: SystemRule): number {
  return cropRule.growthDurationMs > 0 ? cropRule.growthDurationMs : systemRule.cropGrowthDurationMs;
}

function resolveWitherDurationMs(cropRule: CropRule, systemRule: SystemRule): number {
  return cropRule.witherDurationMs > 0 ? cropRule.witherDurationMs : systemRule.cropWitherDurationMs;
}

function resolveSlotStatus(currentTimeMs: number, readyAtMs: number, withersAtMs: number): FarmSlotStatus {
  if (currentTimeMs < readyAtMs) {
    return 'growing';
  }

  if (currentTimeMs < withersAtMs) {
    return 'mature';
  }

  return 'withered';
}
