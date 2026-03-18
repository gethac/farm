import { describe, expect, it } from 'vitest';
import { cropRules, systemRules } from '@qq-classic-farm/config';
import {
  calculateCropGrowthStage,
  calculateCropHealthCoefficient,
  calculateCropYield,
  deriveFarmConditionStates,
} from '../../src/modules/farm/farm-rules';

const riceRule = cropRules[0];

describe('farm rules', () => {
  it('derives drought, grass, and worm states from slot severity values', () => {
    const states = deriveFarmConditionStates({
      waterLevel: 0,
      grassLevel: 2,
      wormLevel: 1,
    });

    expect(states).toEqual({
      droughtState: 'dry',
      grassState: 'overgrown',
      wormState: 'infested',
    });
  });

  it('reduces health coefficient for drought, grass, and worm pressure', () => {
    const coefficient = calculateCropHealthCoefficient({
      droughtState: 'dry',
      grassState: 'overgrown',
      wormState: 'infested',
    });

    expect(coefficient).toBe(0.45);
  });

  it('rounds yield down after health reduction', () => {
    expect(calculateCropYield(riceRule.yield, 0.45)).toBe(1);
  });

  it('advances crop growth stages as the growth window elapses', () => {
    expect(
      calculateCropGrowthStage({
        plantedAt: new Date('2026-03-18T00:00:00.000Z'),
        currentTime: new Date('2026-03-18T00:03:00.000Z'),
        cropRule: riceRule,
        systemRule: systemRules,
      }),
    ).toBe(1);
  });
});
