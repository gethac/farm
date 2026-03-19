import { systemRules } from '@qq-classic-farm/config';
import type { FarmSlotSummary, FarmSummary } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';
import { createFarmRepository, type CropInstanceRow, type FarmSlotRow } from './farm-repository';
import { mapFarmSlotSummary, mapFarmSummary } from './farm-snapshot-mapper';

interface FarmOwnerRow {
  farm_id: string;
  owner_user_id: string;
  nickname: string;
  coins: number;
  experience: number;
}

interface FarmQuerySnapshot {
  farm: FarmSummary;
  slots: readonly FarmSlotSummary[];
}

export interface FarmUserSnapshot extends FarmQuerySnapshot {
  isFriend: boolean;
  canVisit: boolean;
}

export interface FarmQueryService {
  getMine(userId: string): FarmQuerySnapshot;
  getUser(viewerUserId: string, targetUserId: string): FarmUserSnapshot;
}

export function createFarmQueryService(database: DatabaseClient, now: () => Date = () => new Date()): FarmQueryService {
  const repository = createFarmRepository(database);

  return {
    getMine(userId) {
      const ownerFarm = findFarmByOwnerUserId(database, userId);
      if (!ownerFarm) {
        throw new Error(`Farm not found for user ${userId}`);
      }

      return buildSnapshot({
        repository,
        ownerFarm,
        currentTime: now(),
        isOwner: true,
        canVisit: true,
      });
    },

    getUser(viewerUserId, targetUserId) {
      const ownerFarm = findFarmByOwnerUserId(database, targetUserId);
      if (!ownerFarm) {
        throw new Error(`Farm not found for user ${targetUserId}`);
      }

      const isOwner = viewerUserId === targetUserId;
      const isFriend = isOwner ? false : areUsersFriends(database, viewerUserId, targetUserId);
      const canVisit = isOwner || isFriend;
      const snapshot = buildSnapshot({
        repository,
        ownerFarm,
        currentTime: now(),
        isOwner,
        canVisit,
      });

      return {
        ...snapshot,
        isFriend,
        canVisit,
      };
    },
  };
}

function buildSnapshot(input: {
  repository: ReturnType<typeof createFarmRepository>;
  ownerFarm: FarmOwnerRow;
  currentTime: Date;
  isOwner: boolean;
  canVisit: boolean;
}): FarmQuerySnapshot {
  const slots = input.repository.listSlotsByFarmId(input.ownerFarm.farm_id);
  const cropRows = input.repository.listCropInstancesByFarmId(input.ownerFarm.farm_id);
  const cropBySlotId = new Map<string, CropInstanceRow>();

  for (const cropRow of cropRows) {
    if (cropRow.farm_slot_id) {
      cropBySlotId.set(cropRow.farm_slot_id, cropRow);
    }
  }

  const slotSummaries = slots.map((slotRow) => {
    const cropRow = cropBySlotId.get(slotRow.id) ?? null;
    const calculated = input.repository.calculateSlotState({
      slotRow,
      cropRow,
      currentTime: input.currentTime,
      systemRule: systemRules,
      slotLevels: resolveSlotLevels(cropRow),
    });

    return mapFarmSlotSummary({
      calculated,
      locked: slotRow.locked === 1,
      isOwner: input.isOwner,
      canVisit: input.canVisit,
    });
  });

  const farm = mapFarmSummary({
    farmId: input.ownerFarm.farm_id,
    ownerUserId: input.ownerFarm.owner_user_id,
    nickname: input.ownerFarm.nickname,
    coins: input.ownerFarm.coins,
    experience: input.ownerFarm.experience,
    protectionUntil: null,
    currentTime: input.currentTime,
  });

  return {
    farm,
    slots: slotSummaries,
  };
}

function findFarmByOwnerUserId(database: DatabaseClient, userId: string): FarmOwnerRow | null {
  const rows = database.prepare(`
    SELECT
      farms.id AS farm_id,
      users.id AS owner_user_id,
      users.display_name AS nickname,
      farms.coins AS coins,
      farms.experience AS experience
    FROM farms
    INNER JOIN users ON users.id = farms.user_id
    WHERE farms.user_id = @userId
    LIMIT 1
  `).all({ userId }) as FarmOwnerRow[];

  return rows[0] ?? null;
}

function areUsersFriends(database: DatabaseClient, userIdA: string, userIdB: string): boolean {
  const rows = database.prepare(`
    SELECT id
    FROM friendships
    WHERE status = 'accepted'
      AND ((user_id_a = @userIdA AND user_id_b = @userIdB)
        OR (user_id_a = @userIdB AND user_id_b = @userIdA))
    LIMIT 1
  `).all({ userIdA, userIdB }) as Array<{ id: string }>;

  return rows.length > 0;
}

function resolveSlotLevels(cropRow: CropInstanceRow | null): { waterLevel: number; grassLevel: number; wormLevel: number } {
  if (!cropRow) {
    return {
      waterLevel: 3,
      grassLevel: 0,
      wormLevel: 0,
    };
  }

  const meta = safeParseJson(cropRow.meta_json);
  return {
    waterLevel: toFiniteNumber(meta.waterLevel, 3),
    grassLevel: toFiniteNumber(meta.grassLevel, 0),
    wormLevel: toFiniteNumber(meta.wormLevel, 0),
  };
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
