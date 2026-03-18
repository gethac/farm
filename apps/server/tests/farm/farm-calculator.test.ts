import { describe, expect, it } from 'vitest';
import { cropRules, systemRules } from '@qq-classic-farm/config';
import { calculateFarmSlotState } from '../../src/modules/farm/farm-calculator';

const riceRule = cropRules[0];

describe('farm calculator', () => {
  it('derives the growing stage from planted time and current time', () => {
    const result = calculateFarmSlotState({
      slot: {
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        plantedAt: new Date('2026-03-18T00:00:00.000Z'),
        waterLevel: 3,
        grassLevel: 0,
        wormLevel: 0,
      },
      cropRule: riceRule,
      currentTime: new Date('2026-03-18T00:03:00.000Z'),
      systemRule: systemRules,
    });

    const crop = result.crop;
    expect(crop).not.toBeNull();
    if (!crop) {
      throw new Error('expected crop state');
    }

    expect(result.slot.status).toBe('growing');
    expect(result.slot.stage).toBe(1);
    expect(crop.readyAt).toBe('2026-03-18T00:10:00.000Z');
    expect(crop.withersAt).toBe('2026-03-18T00:30:00.000Z');
  });

  it('switches to withered after the wither window ends', () => {
    const result = calculateFarmSlotState({
      slot: {
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        plantedAt: new Date('2026-03-18T00:00:00.000Z'),
        waterLevel: 3,
        grassLevel: 0,
        wormLevel: 0,
      },
      cropRule: riceRule,
      currentTime: new Date('2026-03-18T00:31:00.000Z'),
      systemRule: systemRules,
    });

    const crop = result.crop;
    expect(crop).not.toBeNull();
    if (!crop) {
      throw new Error('expected crop state');
    }

    expect(result.slot.status).toBe('withered');
    expect(result.slot.stage).toBe(4);
    expect(crop.status).toBe('withered');
  });

  it('reduces final yield when the slot health is degraded', () => {
    const result = calculateFarmSlotState({
      slot: {
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        plantedAt: new Date('2026-03-18T00:00:00.000Z'),
        waterLevel: 0,
        grassLevel: 2,
        wormLevel: 1,
      },
      cropRule: riceRule,
      currentTime: new Date('2026-03-18T00:10:00.000Z'),
      systemRule: systemRules,
    });

    const crop = result.crop;
    expect(crop).not.toBeNull();
    if (!crop) {
      throw new Error('expected crop state');
    }

    expect(crop.healthCoefficient).toBe(0.45);
    expect(crop.yield).toBe(1);
  });
});
