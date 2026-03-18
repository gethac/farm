import type { CropRule, SystemRule } from '@qq-classic-farm/config';
import { cropRules } from '@qq-classic-farm/config';
import type { DatabaseClient } from '../../db/client';
import { calculateFarmSlotState, type CalculatedFarmSlotState, type FarmSlotStateInput } from './farm-calculator';

export interface FarmSlotRow {
  id: string;
  farm_id: string;
  slot_index: number;
  crop_instance_id: string | null;
  locked: number;
  created_at: string;
  updated_at: string;
}

export interface CropInstanceRow {
  id: string;
  farm_id: string;
  farm_slot_id: string | null;
  crop_id: string;
  planted_at: string;
  ready_at: string;
  withers_at: string;
  harvested_at: string | null;
  status: 'planted' | 'ready' | 'withered' | 'harvested';
  meta_json: string;
}

export interface FarmRepository {
  listSlotsByFarmId(farmId: string): FarmSlotRow[];
  listCropInstancesByFarmId(farmId: string): CropInstanceRow[];
  findCropRule(cropId: string): CropRule | null;
  calculateSlotState(input: {
    slotRow: FarmSlotRow;
    cropRow: CropInstanceRow | null;
    currentTime: Date | string | number;
    systemRule: SystemRule;
    slotLevels: { waterLevel: number; grassLevel: number; wormLevel: number };
  }): CalculatedFarmSlotState;
}

export function createFarmRepository(database: DatabaseClient): FarmRepository {
  return {
    listSlotsByFarmId(farmId) {
      return database
        .prepare(
          `
            SELECT id, farm_id, slot_index, crop_instance_id, locked, created_at, updated_at
            FROM farm_slots
            WHERE farm_id = @farmId
            ORDER BY slot_index ASC
          `,
        )
        .all({ farmId }) as FarmSlotRow[];
    },

    listCropInstancesByFarmId(farmId) {
      return database
        .prepare(
          `
            SELECT id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, harvested_at, status, meta_json
            FROM crop_instances
            WHERE farm_id = @farmId
            ORDER BY planted_at ASC
          `,
        )
        .all({ farmId }) as CropInstanceRow[];
    },

    findCropRule(cropId) {
      return cropRules.find((rule) => rule.cropId === cropId) ?? null;
    },

    calculateSlotState(input) {
      const cropRule = input.cropRow ? this.findCropRule(input.cropRow.crop_id) : null;
      if (!cropRule) {
        return {
          slot: {
            slotId: input.slotRow.id,
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

      const calculationInput: FarmSlotStateInput = {
        slot: {
          slotId: input.slotRow.id,
          cropId: cropRule.cropId,
          plantedAt: input.cropRow?.planted_at ?? null,
          waterLevel: input.slotLevels.waterLevel,
          grassLevel: input.slotLevels.grassLevel,
          wormLevel: input.slotLevels.wormLevel,
        },
        cropRule,
        currentTime: input.currentTime,
        systemRule: input.systemRule,
      };

      return calculateFarmSlotState(calculationInput);
    },
  };
}
