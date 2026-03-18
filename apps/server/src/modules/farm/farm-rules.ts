import type { CropRule, SystemRule } from '@qq-classic-farm/config';
import { toEpochMs } from '../../lib/time';

export type FarmDroughtState = 'normal' | 'dry';
export type FarmGrassState = 'clear' | 'overgrown';
export type FarmWormState = 'clear' | 'infested';

export interface FarmConditionInput {
  waterLevel: number;
  grassLevel: number;
  wormLevel: number;
}

export interface FarmConditionStates {
  droughtState: FarmDroughtState;
  grassState: FarmGrassState;
  wormState: FarmWormState;
}

export interface CropGrowthStageInput {
  plantedAt: Date | string | number;
  currentTime: Date | string | number;
  cropRule: CropRule;
  systemRule: SystemRule;
}

export interface CropHealthCoefficientInput extends FarmConditionStates {
  baseCoefficient?: number;
}

export function deriveFarmConditionStates(input: FarmConditionInput): FarmConditionStates {
  return {
    droughtState: input.waterLevel <= 0 ? 'dry' : 'normal',
    grassState: input.grassLevel >= 2 ? 'overgrown' : 'clear',
    wormState: input.wormLevel >= 1 ? 'infested' : 'clear',
  };
}

export function calculateCropGrowthStage(input: CropGrowthStageInput): number {
  const plantedAt = toEpochMs(input.plantedAt);
  const currentTime = toEpochMs(input.currentTime);
  const growthDurationMs = resolveGrowthDurationMs(input.cropRule, input.systemRule);

  if (currentTime <= plantedAt) {
    return 0;
  }

  const elapsedMs = currentTime - plantedAt;
  if (elapsedMs >= growthDurationMs) {
    return 4;
  }

  const stageDurationMs = growthDurationMs / 4;
  return Math.min(3, Math.floor(elapsedMs / stageDurationMs));
}

export function calculateCropHealthCoefficient(input: CropHealthCoefficientInput): number {
  const baseCoefficient = input.baseCoefficient ?? 1;
  let coefficient = baseCoefficient;

  if (input.droughtState === 'dry') {
    coefficient -= 0.15;
  }

  if (input.grassState === 'overgrown') {
    coefficient -= 0.2;
  }

  if (input.wormState === 'infested') {
    coefficient -= 0.2;
  }

  return clampCoefficient(roundToTwoDecimals(coefficient));
}

export function calculateCropYield(baseYield: number, healthCoefficient: number): number {
  if (baseYield <= 0 || healthCoefficient <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(baseYield * healthCoefficient));
}

function resolveGrowthDurationMs(cropRule: CropRule, systemRule: SystemRule): number {
  return cropRule.growthDurationMs > 0 ? cropRule.growthDurationMs : systemRule.cropGrowthDurationMs;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampCoefficient(value: number): number {
  return Math.max(0, Math.min(1, value));
}
