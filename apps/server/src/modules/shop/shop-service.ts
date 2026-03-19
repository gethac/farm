import { randomUUID } from 'node:crypto';
import { itemRules, type ItemRule } from '@qq-classic-farm/config';
import type { EventMessageName, FarmSummary, InventoryEntrySummary, ShopItemSummary, ShopPurchaseRequest } from '@qq-classic-farm/protocol';
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

type BuyableItemRule = ItemRule & { category: 'seed' | 'tool' | 'consumable' };

export interface ShopPurchaseResult {
  farm: FarmSummary;
  inventory: readonly InventoryEntrySummary[];
  affectedEventNames: readonly EventMessageName[];
}

export interface ShopService {
  list(): readonly ShopItemSummary[];
  purchase(userId: string, request: ShopPurchaseRequest): ShopPurchaseResult;
}

export function createShopService(
  database: DatabaseClient,
  now: () => Date = () => new Date(),
): ShopService {
  return {
    list() {
      return itemRules
        .filter(isBuyableItemRule)
        .map((item) => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          category: item.category,
        }));
    },

    purchase(userId, request) {
      return runInTransaction(database, () => {
        const quantity = normalizeQuantity(request.quantity);
        const itemRule = itemRules.find((item): item is BuyableItemRule => item.itemId === request.itemId && isBuyableItemRule(item));
        if (!itemRule) {
          throw new FarmOperationError('NOT_FOUND', 'Shop item not found');
        }

        const farm = requireFarm(userId);
        const totalPrice = itemRule.price * quantity;
        if (farm.coins < totalPrice) {
          throw new FarmOperationError('CONFLICT', 'Not enough coins');
        }

        database.prepare(`
          UPDATE farms
          SET coins = coins - @totalPrice,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = @farmId
        `).run({ farmId: farm.farm_id, totalPrice });

        upsertInventory(userId, itemRule.itemId, quantity);
        insertNotification({
          userId,
          notificationType: 'shop-transaction',
          title: '购买成功',
          body: `购买了 ${quantity} 个 ${itemRule.name}`,
          sourceTable: 'inventory_entries',
        });

        return {
          farm: buildFarmSummary(userId, now),
          inventory: listInventory(userId),
          affectedEventNames: ['inventory:list', 'notice:new'],
        };
      });
    },
  };

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

  function upsertInventory(userId: string, itemId: string, quantity: number): void {
    const existingRows = database.prepare(`
      SELECT id, item_id, quantity
      FROM inventory_entries
      WHERE user_id = @userId AND item_id = @itemId
      LIMIT 1
    `).all({ userId, itemId }) as InventoryRow[];
    const existing = existingRows[0];

    if (existing) {
      database.prepare(`
        UPDATE inventory_entries
        SET quantity = quantity + @quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id: existing.id, quantity });
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

function isBuyableItemRule(item: ItemRule): item is BuyableItemRule {
  return item.price > 0 && item.category !== 'reward';
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new FarmOperationError('BAD_REQUEST', 'quantity must be a positive integer');
  }

  return value;
}
