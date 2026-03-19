import { randomUUID } from 'node:crypto';
import { cropRules, systemRules } from '@qq-classic-farm/config';
import type { EventMessageName, FarmOperateRequest, ProtocolErrorCode } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';
import { runInTransaction } from '../../lib/transactions';
import { createFarmRepository, type CropInstanceRow } from './farm-repository';
import { buildAffectedEventNames } from './farm-events';
import { createTaskProgressor } from '../tasks/task-progressor';

interface FarmRow {
  id: string;
  user_id: string;
  coins: number;
  experience: number;
}

interface InventoryEntryRow {
  id: string;
  quantity: number;
}

interface TaskRuleRow {
  task_id: string;
  target: number;
}

interface TaskProgressRow {
  id: string;
  progress: number;
  status: 'locked' | 'active' | 'completed' | 'claimed';
}

export interface FarmOperationResult {
  farmOwnerUserId: string;
  farmId: string;
  affectedEventNames: readonly EventMessageName[];
}

export class FarmOperationError extends Error {
  constructor(
    public readonly code: ProtocolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FarmOperationError';
  }
}

export interface FarmOperationService {
  execute(userId: string, request: FarmOperateRequest): FarmOperationResult;
}

export function createFarmOperationService(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
): FarmOperationService {
  const repository = createFarmRepository(database);
  const taskProgressor = createTaskProgressor(database, now);

  return {
    execute(userId, request) {
      return runInTransaction(database, () => {
        switch (request.action) {
          case 'plant':
            return handlePlant(userId, request);
          case 'water':
            return handleSelfCare(userId, request, (meta) => ({ ...meta, waterLevel: 3 }));
          case 'removeGrass':
            return handleSelfCare(userId, request, (meta) => ({ ...meta, grassLevel: 0 }));
          case 'removeWorms':
            return handleSelfCare(userId, request, (meta) => ({ ...meta, wormLevel: 0 }));
          case 'fertilize':
            return handleSelfCare(userId, request, (meta) => ({
              ...meta,
              waterLevel: 3,
              grassLevel: 0,
              wormLevel: 0,
              fertilized: true,
            }));
          case 'harvest':
            return handleHarvest(userId, request);
          case 'clearDeadCrop':
            return handleClearDeadCrop(userId, request);
          case 'steal':
            return handleSteal(userId, request);
          case 'help':
            return handleHelp(userId, request);
          case 'throwWorms':
            return handleThrowWorms(userId, request);
          default:
            throw new FarmOperationError('BAD_REQUEST', `Unsupported farm action: ${(request as { action: string }).action}`);
        }
      });
    },
  };

  function handlePlant(userId: string, request: Extract<FarmOperateRequest, { action: 'plant' }>): FarmOperationResult {
    const farm = requireOwnedFarm(request.farmId, userId);
    const slot = requireSlot(request.farmId, request.slotId);

    if (slot.locked === 1) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot plant in a locked slot');
    }
    if (slot.crop_instance_id) {
      throw new FarmOperationError('CONFLICT', 'Slot already contains a crop');
    }

    const cropRule = cropRules.find((rule) => rule.seedItemId === request.itemId);
    if (!cropRule) {
      throw new FarmOperationError('BAD_REQUEST', 'Unknown seed item');
    }

    decrementInventory(userId, request.itemId, 1);

    const plantedAt = now();
    const cropInstanceId = randomUUID();
    const readyAt = new Date(plantedAt.getTime() + cropRule.growthDurationMs);
    const withersAt = new Date(readyAt.getTime() + cropRule.witherDurationMs);

    database.prepare(`
      INSERT INTO crop_instances (
        id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
      ) VALUES (
        @id, @farmId, @slotId, @cropId, @plantedAt, @readyAt, @withersAt, 'planted', @metaJson
      )
    `).run({
      id: cropInstanceId,
      farmId: request.farmId,
      slotId: request.slotId,
      cropId: cropRule.cropId,
      plantedAt: plantedAt.toISOString(),
      readyAt: readyAt.toISOString(),
      withersAt: withersAt.toISOString(),
      metaJson: JSON.stringify({ waterLevel: 3, grassLevel: 0, wormLevel: 0, stolenQuantity: 0 }),
    });

    database.prepare(`
      UPDATE farm_slots
      SET crop_instance_id = @cropInstanceId, updated_at = CURRENT_TIMESTAMP
      WHERE id = @slotId
    `).run({ cropInstanceId, slotId: request.slotId });

    taskProgressor.recordEvent(userId, 'plant', 1);

    return {
      farmOwnerUserId: farm.user_id,
      farmId: farm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleSelfCare(
    userId: string,
    request:
      | Extract<FarmOperateRequest, { action: 'water' }>
      | Extract<FarmOperateRequest, { action: 'removeGrass' }>
      | Extract<FarmOperateRequest, { action: 'removeWorms' }>
      | Extract<FarmOperateRequest, { action: 'fertilize' }>,
    updateMeta: (meta: Record<string, unknown>) => Record<string, unknown>,
  ): FarmOperationResult {
    const farm = requireOwnedFarm(request.farmId, userId);
    const slot = requireSlot(request.farmId, request.slotId);
    const cropRow = requireActiveCropForSlot(slot.id);
    requireSlotStatus(slot, cropRow, 'growing');

    updateCropMeta(cropRow, updateMeta);
    if (request.action === 'water') {
      taskProgressor.recordEvent(userId, 'water', 1);
    }

    return {
      farmOwnerUserId: farm.user_id,
      farmId: farm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleHarvest(userId: string, request: Extract<FarmOperateRequest, { action: 'harvest' }>): FarmOperationResult {
    const farm = requireOwnedFarm(request.farmId, userId);
    const slot = requireSlot(request.farmId, request.slotId);
    const cropRow = requireActiveCropForSlot(slot.id);
    const cropRule = repository.findCropRule(cropRow.crop_id);
    if (!cropRule) {
      throw new FarmOperationError('NOT_FOUND', `Missing crop rule for ${cropRow.crop_id}`);
    }

    const calculated = calculateSlot(slot, cropRow);
    if (calculated.slot.status !== 'mature') {
      throw new FarmOperationError('CONFLICT', 'Crop is not ready to harvest');
    }

    incrementInventory(userId, cropRule.cropId, calculated.crop?.yield ?? 0);
    archiveCropFromSlot(cropRow.id, slot.id);

    return {
      farmOwnerUserId: farm.user_id,
      farmId: farm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleClearDeadCrop(userId: string, request: Extract<FarmOperateRequest, { action: 'clearDeadCrop' }>): FarmOperationResult {
    const farm = requireOwnedFarm(request.farmId, userId);
    const slot = requireSlot(request.farmId, request.slotId);
    const cropRow = requireActiveCropForSlot(slot.id);
    const calculated = calculateSlot(slot, cropRow);

    if (calculated.slot.status !== 'withered') {
      throw new FarmOperationError('CONFLICT', 'Crop is not withered');
    }

    archiveCropFromSlot(cropRow.id, slot.id);

    return {
      farmOwnerUserId: farm.user_id,
      farmId: farm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleSteal(userId: string, request: Extract<FarmOperateRequest, { action: 'steal' }>): FarmOperationResult {
    if (userId === request.targetUserId) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot steal from your own farm');
    }

    const targetFarm = requireOwnedFarm(request.farmId, request.targetUserId);
    requireFriendship(userId, request.targetUserId);
    const targetSlot = requireSlot(targetFarm.id, request.targetSlotId);
    if (targetSlot.locked === 1) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot interact with a locked slot');
    }

    const cropRow = requireActiveCropForSlot(targetSlot.id);
    const cropRule = repository.findCropRule(cropRow.crop_id);
    if (!cropRule) {
      throw new FarmOperationError('NOT_FOUND', `Missing crop rule for ${cropRow.crop_id}`);
    }

    const calculated = calculateSlot(targetSlot, cropRow);
    if (calculated.slot.status !== 'mature') {
      throw new FarmOperationError('CONFLICT', 'Target crop is not stealable');
    }

    const meta = parseMeta(cropRow.meta_json);
    const stolenQuantity = readNumber(meta.stolenQuantity, 0);
    const availableQuantity = Math.max(0, (calculated.crop?.yield ?? 0) - stolenQuantity);
    const stealQuantity = Math.min(request.quantity, systemRules.stealCapPerVisit, availableQuantity);
    if (stealQuantity <= 0) {
      throw new FarmOperationError('CONFLICT', 'No crop quantity left to steal');
    }

    updateCropMeta(cropRow, (currentMeta) => ({
      ...currentMeta,
      stolenQuantity: readNumber(currentMeta.stolenQuantity, 0) + stealQuantity,
    }));
    incrementInventory(userId, cropRule.cropId, stealQuantity);
    insertInteractionLog({
      actorUserId: userId,
      targetUserId: request.targetUserId,
      interactionType: 'steal',
      amount: stealQuantity,
      payload: {
        farmId: targetFarm.id,
        slotId: targetSlot.id,
        cropId: cropRule.cropId,
      },
    });
    insertNotification({
      userId: request.targetUserId,
      notificationType: 'farm-interaction',
      title: '作物被操作',
      body: `${findDisplayName(userId)} 偷走了 ${stealQuantity} 份 ${cropRule.name}`,
      sourceTable: 'interaction_logs',
    });

    return {
      farmOwnerUserId: targetFarm.user_id,
      farmId: targetFarm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleHelp(userId: string, request: Extract<FarmOperateRequest, { action: 'help' }>): FarmOperationResult {
    if (userId === request.targetUserId) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot perform this action on your own farm');
    }

    const targetFarm = requireOwnedFarm(request.farmId, request.targetUserId);
    requireFriendship(userId, request.targetUserId);
    const targetSlot = requireSlot(targetFarm.id, request.targetSlotId);
    if (targetSlot.locked === 1) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot interact with a locked slot');
    }

    const cropRow = requireActiveCropForSlot(targetSlot.id);
    requireSlotStatus(targetSlot, cropRow, 'growing');
    updateCropMeta(cropRow, (meta) => ({ ...meta, waterLevel: 3, grassLevel: 0, wormLevel: 0 }));
    insertInteractionLog({
      actorUserId: userId,
      targetUserId: request.targetUserId,
      interactionType: 'help',
      amount: 1,
      payload: {
        farmId: targetFarm.id,
        slotId: targetSlot.id,
      },
    });
    insertNotification({
      userId: request.targetUserId,
      notificationType: 'farm-interaction',
      title: '作物被操作',
      body: `${findDisplayName(userId)} 帮你照料了作物`,
      sourceTable: 'interaction_logs',
    });

    return {
      farmOwnerUserId: targetFarm.user_id,
      farmId: targetFarm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function handleThrowWorms(userId: string, request: Extract<FarmOperateRequest, { action: 'throwWorms' }>): FarmOperationResult {
    if (userId === request.targetUserId) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot perform this action on your own farm');
    }

    const targetFarm = requireOwnedFarm(request.farmId, request.targetUserId);
    requireFriendship(userId, request.targetUserId);
    const targetSlot = requireSlot(targetFarm.id, request.targetSlotId);
    if (targetSlot.locked === 1) {
      throw new FarmOperationError('FORBIDDEN', 'Cannot interact with a locked slot');
    }

    const cropRow = requireActiveCropForSlot(targetSlot.id);
    requireSlotStatus(targetSlot, cropRow, 'growing');
    updateCropMeta(cropRow, (meta) => ({
      ...meta,
      wormLevel: readNumber(meta.wormLevel, 0) + 1,
    }));
    insertNotification({
      userId: request.targetUserId,
      notificationType: 'farm-interaction',
      title: '作物被操作',
      body: `${findDisplayName(userId)} 对你的作物扔了虫子`,
      sourceTable: 'crop_instances',
      sourceId: cropRow.id,
    });

    return {
      farmOwnerUserId: targetFarm.user_id,
      farmId: targetFarm.id,
      affectedEventNames: buildAffectedEventNames(request.action),
    };
  }

  function requireOwnedFarm(farmId: string, ownerUserId: string): FarmRow {
    const rows = database.prepare(`
      SELECT id, user_id, coins, experience
      FROM farms
      WHERE id = @farmId AND user_id = @ownerUserId
      LIMIT 1
    `).all({ farmId, ownerUserId }) as FarmRow[];

    const farm = rows[0];
    if (!farm) {
      throw new FarmOperationError('NOT_FOUND', 'Farm not found');
    }

    return farm;
  }

  function requireSlot(farmId: string, slotId: string) {
    const rows = database.prepare(`
      SELECT id, farm_id, slot_index, crop_instance_id, locked, created_at, updated_at
      FROM farm_slots
      WHERE id = @slotId AND farm_id = @farmId
      LIMIT 1
    `).all({ slotId, farmId });

    const slot = rows[0] as ReturnType<typeof repository.listSlotsByFarmId>[number] | undefined;
    if (!slot) {
      throw new FarmOperationError('NOT_FOUND', 'Farm slot not found');
    }

    return slot;
  }

  function requireActiveCropForSlot(slotId: string): CropInstanceRow {
    const rows = database.prepare(`
      SELECT id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, harvested_at, status, meta_json
      FROM crop_instances
      WHERE farm_slot_id = @slotId AND status != 'harvested'
      ORDER BY planted_at DESC
      LIMIT 1
    `).all({ slotId }) as CropInstanceRow[];

    const crop = rows[0];
    if (!crop) {
      throw new FarmOperationError('CONFLICT', 'No active crop exists for this slot');
    }

    return crop;
  }

  function requireFriendship(userIdA: string, userIdB: string): void {
    const rows = database.prepare(`
      SELECT id
      FROM friendships
      WHERE status = 'accepted'
        AND ((user_id_a = @userIdA AND user_id_b = @userIdB)
          OR (user_id_a = @userIdB AND user_id_b = @userIdA))
      LIMIT 1
    `).all({ userIdA, userIdB }) as Array<{ id: string }>;

    if (rows.length === 0) {
      throw new FarmOperationError('FORBIDDEN', 'Friendship required for this action');
    }
  }

  function requireSlotStatus(
    slot: ReturnType<typeof repository.listSlotsByFarmId>[number],
    cropRow: CropInstanceRow,
    expectedStatus: 'growing' | 'mature' | 'withered',
  ): void {
    const calculated = calculateSlot(slot, cropRow);
    if (calculated.slot.status !== expectedStatus) {
      throw new FarmOperationError('CONFLICT', `Crop is not ${expectedStatus}`);
    }
  }

  function calculateSlot(slot: ReturnType<typeof repository.listSlotsByFarmId>[number], cropRow: CropInstanceRow) {
    return repository.calculateSlotState({
      slotRow: slot,
      cropRow,
      currentTime: now(),
      systemRule: systemRules,
      slotLevels: resolveSlotLevels(cropRow),
    });
  }

  function updateCropMeta(cropRow: CropInstanceRow, updater: (meta: Record<string, unknown>) => Record<string, unknown>): void {
    const meta = parseMeta(cropRow.meta_json);
    const nextMeta = updater(meta);

    database.prepare(`
      UPDATE crop_instances
      SET meta_json = @metaJson
      WHERE id = @cropInstanceId
    `).run({
      cropInstanceId: cropRow.id,
      metaJson: JSON.stringify(nextMeta),
    });
  }

  function archiveCropFromSlot(cropInstanceId: string, slotId: string): void {
    database.prepare(`
      UPDATE crop_instances
      SET harvested_at = @harvestedAt,
          status = 'harvested',
          farm_slot_id = NULL
      WHERE id = @cropInstanceId
    `).run({
      cropInstanceId,
      harvestedAt: now().toISOString(),
    });

    database.prepare(`
      UPDATE farm_slots
      SET crop_instance_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = @slotId
    `).run({ slotId });
  }

  function decrementInventory(userId: string, itemId: string, quantity: number): void {
    const row = findInventoryEntry(userId, itemId);
    if (!row || row.quantity < quantity) {
      throw new FarmOperationError('CONFLICT', `Insufficient inventory for ${itemId}`);
    }

    database.prepare(`
      UPDATE inventory_entries
      SET quantity = quantity - @quantity,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id: row.id, quantity });
  }

  function incrementInventory(userId: string, itemId: string, quantity: number): void {
    if (quantity <= 0) {
      return;
    }

    const row = findInventoryEntry(userId, itemId);
    if (row) {
      database.prepare(`
        UPDATE inventory_entries
        SET quantity = quantity + @quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id: row.id, quantity });
      return;
    }

    database.prepare(`
      INSERT INTO inventory_entries (id, user_id, item_id, quantity)
      VALUES (@id, @userId, @itemId, @quantity)
    `).run({
      id: randomUUID(),
      userId,
      itemId,
      quantity,
    });
  }

  function findInventoryEntry(userId: string, itemId: string): InventoryEntryRow | null {
    const rows = database.prepare(`
      SELECT id, quantity
      FROM inventory_entries
      WHERE user_id = @userId AND item_id = @itemId
      LIMIT 1
    `).all({ userId, itemId }) as InventoryEntryRow[];

    return rows[0] ?? null;
  }

  function advanceTaskProgress(userId: string, taskId: string, amount: number): void {
    if (amount <= 0) {
      return;
    }

    const taskRule = database.prepare(`
      SELECT task_id, target
      FROM tasks
      WHERE task_id = @taskId
      LIMIT 1
    `).all({ taskId }) as TaskRuleRow[];
    const rule = taskRule[0];
    if (!rule) {
      return;
    }

    const progressRows = database.prepare(`
      SELECT id, progress, status
      FROM task_progress
      WHERE user_id = @userId AND task_id = @taskId
      LIMIT 1
    `).all({ userId, taskId }) as TaskProgressRow[];
    const existing = progressRows[0];
    const nextProgress = Math.min(rule.target, (existing?.progress ?? 0) + amount);
    const nextStatus = nextProgress >= rule.target ? 'completed' : 'active';
    const completedAt = nextStatus === 'completed' ? now().toISOString() : null;

    if (existing) {
      database.prepare(`
        UPDATE task_progress
        SET progress = @progress,
            status = @status,
            completed_at = COALESCE(completed_at, @completedAt),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id: existing.id,
        progress: nextProgress,
        status: nextStatus,
        completedAt,
      });
      return;
    }

    database.prepare(`
      INSERT INTO task_progress (id, user_id, task_id, progress, status, completed_at)
      VALUES (@id, @userId, @taskId, @progress, @status, @completedAt)
    `).run({
      id: randomUUID(),
      userId,
      taskId,
      progress: nextProgress,
      status: nextStatus,
      completedAt,
    });
  }

  function insertInteractionLog(input: {
    actorUserId: string;
    targetUserId: string;
    interactionType: 'steal' | 'help';
    amount: number;
    payload: Record<string, unknown>;
  }): string {
    const id = randomUUID();
    database.prepare(`
      INSERT INTO interaction_logs (
        id, visit_log_id, actor_user_id, target_user_id, interaction_type, amount, payload_json
      ) VALUES (
        @id, NULL, @actorUserId, @targetUserId, @interactionType, @amount, @payloadJson
      )
    `).run({
      id,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      interactionType: input.interactionType,
      amount: input.amount,
      payloadJson: JSON.stringify(input.payload),
    });
    return id;
  }

  function insertNotification(input: {
    userId: string;
    notificationType: string;
    title: string;
    body: string;
    sourceTable?: string | null;
    sourceId?: string | null;
  }): void {
    database.prepare(`
      INSERT INTO notifications (
        id, user_id, notification_type, title, body, source_table, source_id, meta_json
      ) VALUES (
        @id, @userId, @notificationType, @title, @body, @sourceTable, @sourceId, '{}'
      )
    `).run({
      id: randomUUID(),
      userId: input.userId,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      sourceTable: input.sourceTable ?? null,
      sourceId: input.sourceId ?? null,
    });
  }

  function findDisplayName(userId: string): string {
    const rows = database.prepare(`
      SELECT display_name
      FROM users
      WHERE id = @userId
      LIMIT 1
    `).all({ userId }) as Array<{ display_name: string }>;

    return rows[0]?.display_name ?? '好友';
  }
}

function parseMeta(metaJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metaJson) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveSlotLevels(cropRow: CropInstanceRow): { waterLevel: number; grassLevel: number; wormLevel: number } {
  const meta = parseMeta(cropRow.meta_json);
  return {
    waterLevel: readNumber(meta.waterLevel, 3),
    grassLevel: readNumber(meta.grassLevel, 0),
    wormLevel: readNumber(meta.wormLevel, 0),
  };
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

