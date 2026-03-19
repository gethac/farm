import { randomUUID } from 'node:crypto';
import { itemRules } from '@qq-classic-farm/config';
import type { EventMessageName, FarmSummary, InventoryEntrySummary, InventorySellRequest } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';
import { runInTransaction } from '../../lib/transactions';
import { mapFarmSummary } from '../farm/farm-snapshot-mapper';
import { FarmOperationError } from '../farm/farm-operation-service';

interface FarmRow {
  farm_id: string;
  owner_user_id: string;
  nickname: string;
  coins: number;
  experience: number;
}

interface InventoryRow {
  id: string;
  item_id: string;
  quantity: number;
}

export interface InventorySellResult {
  farm: FarmSummary;
  inventory: readonly InventoryEntrySummary[];
  affectedEventNames: readonly EventMessageName[];
}

export interface InventoryService {
  list(userId: string): readonly InventoryEntrySummary[];
  sell(userId: string, request: InventorySellRequest): InventorySellResult;
}

export function createInventoryService(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
): InventoryService {
  return {
    list(userId) {
      return listInventory(userId);
    },

    sell(userId, request) {
      return runInTransaction(database, () => {
        const quantity = normalizeQuantity(request.quantity);
        const itemRule = itemRules.find((item) => item.itemId === request.itemId);
        if (!itemRule || itemRule.sellPrice <= 0) {
          throw new FarmOperationError('CONFLICT', 'Item cannot be sold');
        }

        const inventoryRow = requireInventoryEntry(userId, itemRule.itemId);
        if (inventoryRow.quantity < quantity) {
          throw new FarmOperationError('CONFLICT', 'Not enough inventory to sell');
        }

        const saleValue = itemRule.sellPrice * quantity;
        database.prepare(`
          UPDATE farms
          SET coins = coins + @saleValue,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = @userId
        `).run({ userId, saleValue });

        const remaining = inventoryRow.quantity - quantity;
        if (remaining > 0) {
          database.prepare(`
            UPDATE inventory_entries
            SET quantity = @quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
          `).run({ id: inventoryRow.id, quantity: remaining });
        } else {
          database.prepare(`
            DELETE FROM inventory_entries
            WHERE id = @id
          `).run({ id: inventoryRow.id });
        }

        insertNotification({
          userId,
          notificationType: 'inventory-transaction',
          title: '出售成功',
          body: `出售了 ${quantity} 个 ${itemRule.name}`,
          sourceTable: 'inventory_entries',
          sourceId: inventoryRow.id,
        });

        return {
          farm: buildFarmSummary(userId, now),
          inventory: listInventory(userId),
          affectedEventNames: ['inventory:list', 'notice:new'],
        };
      });
    },
  };

  function listInventory(userId: string): readonly InventoryEntrySummary[] {
    const rows = database.prepare(`
      SELECT item_id, quantity
      FROM inventory_entries
      WHERE user_id = @userId AND quantity > 0
      ORDER BY item_id ASC
    `).all({ userId }) as Array<{ item_id: string; quantity: number }>;

    return rows.map((row) => ({
      itemId: row.item_id,
      quantity: row.quantity,
    }));
  }

  function requireInventoryEntry(userId: string, itemId: string): InventoryRow {
    const rows = database.prepare(`
      SELECT id, item_id, quantity
      FROM inventory_entries
      WHERE user_id = @userId AND item_id = @itemId
      LIMIT 1
    `).all({ userId, itemId }) as InventoryRow[];

    const entry = rows[0];
    if (!entry) {
      throw new FarmOperationError('CONFLICT', 'Inventory item not found');
    }

    return entry;
  }

  function requireFarm(userId: string): FarmRow {
    const rows = database.prepare(`
      SELECT
        farms.id AS farm_id,
        users.id AS owner_user_id,
        users.display_name AS nickname,
        farms.coins,
        farms.experience
      FROM farms
      INNER JOIN users ON users.id = farms.user_id
      WHERE farms.user_id = @userId
      LIMIT 1
    `).all({ userId }) as FarmRow[];

    const farm = rows[0];
    if (!farm) {
      throw new FarmOperationError('NOT_FOUND', 'Farm not found');
    }

    return farm;
  }

  function buildFarmSummary(userId: string, clock: () => Date): FarmSummary {
    const farm = requireFarm(userId);
    return mapFarmSummary({
      farmId: farm.farm_id,
      ownerUserId: farm.owner_user_id,
      nickname: farm.nickname,
      coins: farm.coins,
      experience: farm.experience,
      protectionUntil: null,
      currentTime: clock(),
    });
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
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new FarmOperationError('BAD_REQUEST', 'quantity must be a positive integer');
  }

  return value;
}
