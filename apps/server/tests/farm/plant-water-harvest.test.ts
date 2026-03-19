import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T01:00:00.000Z');
const riceRule = cropRules[0];

describe('farm operations: plant, care, harvest', () => {
  it('plants a crop and supports care actions on the owner farm', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Farmer',
          password: 'secret123',
        },
      });
      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-1', @userId, 'Farm 1', 100, 90)
      `).run({ userId: registerBody.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES ('slot-1', 'farm-1', 0, NULL, 0)
      `).run();
      database.prepare(`
        INSERT INTO inventory_entries (id, user_id, item_id, quantity)
        VALUES ('inv-1', @userId, @itemId, 2)
      `).run({ userId: registerBody.user.id, itemId: riceRule.seedItemId });

      const session = app.sessionStore.create({
        userId: registerBody.user.id,
        displayName: registerBody.user.displayName,
        requestId: 'owner-session',
      });

      const plantResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-plant',
        message: 'farm:operate',
        payload: {
          action: 'plant',
          farmId: 'farm-1',
          slotId: 'slot-1',
          itemId: riceRule.seedItemId,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(plantResponse.message).not.toBe('error');
      const planted = plantResponse as ResponseEnvelope<'farm:operate'>;
      expect(planted.payload.slots[0]).toMatchObject({
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        status: 'growing',
      });

      database.prepare(`
        UPDATE crop_instances
        SET meta_json = @metaJson
        WHERE farm_slot_id = 'slot-1'
      `).run({ metaJson: JSON.stringify({ waterLevel: 0, grassLevel: 2, wormLevel: 1, stolenQuantity: 0 }) });

      for (const action of ['water', 'removeGrass', 'removeWorms', 'fertilize'] as const) {
        const response = app.realtimeRouter.handle(session, {
          requestId: `req-${action}`,
          message: 'farm:operate',
          payload: action === 'fertilize'
            ? { action, farmId: 'farm-1', slotId: 'slot-1', itemId: 'water-can' }
            : { action, farmId: 'farm-1', slotId: 'slot-1' },
        } as RequestEnvelope<'farm:operate'>);

        expect(response.message).not.toBe('error');
      }

      const latestSnapshot = app.realtimeRouter.handle(session, {
        requestId: 'req-mine-after-care',
        message: 'farm:getMine',
        payload: {},
      } as RequestEnvelope<'farm:getMine'>) as ResponseEnvelope<'farm:getMine'>;

      expect(latestSnapshot.payload.slots[0]).toMatchObject({
        slotId: 'slot-1',
        status: 'growing',
        health: 100,
      });

      const inventoryRows = database.prepare(`
        SELECT quantity FROM inventory_entries WHERE user_id = @userId AND item_id = @itemId
      `).all({ userId: registerBody.user.id, itemId: riceRule.seedItemId }) as Array<{ quantity: number }>;
      expect(inventoryRows[0]?.quantity).toBe(1);
    } finally {
      await close();
    }
  });

  it('harvests mature crops and clears withered crops', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Harvester',
          password: 'secret123',
        },
      });
      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-2', @userId, 'Farm 2', 100, 100)
      `).run({ userId: registerBody.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES
          ('slot-harvest', 'farm-2', 0, 'crop-harvest', 0),
          ('slot-wither', 'farm-2', 1, 'crop-wither', 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json)
        VALUES
          ('crop-harvest', 'farm-2', 'slot-harvest', @cropId, '2026-03-19T00:45:00.000Z', '2026-03-19T00:55:00.000Z', '2026-03-19T01:15:00.000Z', 'ready', '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}'),
          ('crop-wither', 'farm-2', 'slot-wither', @cropId, '2026-03-19T00:20:00.000Z', '2026-03-19T00:30:00.000Z', '2026-03-19T00:50:00.000Z', 'withered', '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}')
      `).run({ cropId: riceRule.cropId });

      const session = app.sessionStore.create({
        userId: registerBody.user.id,
        displayName: registerBody.user.displayName,
        requestId: 'harvest-session',
      });

      const harvestResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-harvest',
        message: 'farm:operate',
        payload: {
          action: 'harvest',
          farmId: 'farm-2',
          slotId: 'slot-harvest',
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(harvestResponse.message).not.toBe('error');
      const harvested = harvestResponse as ResponseEnvelope<'farm:operate'>;
      expect(harvested.payload.slots[0]).toMatchObject({
        slotId: 'slot-harvest',
        cropId: null,
        status: 'empty',
      });

      const inventoryRows = database.prepare(`
        SELECT quantity FROM inventory_entries WHERE user_id = @userId AND item_id = @itemId
      `).all({ userId: registerBody.user.id, itemId: riceRule.cropId }) as Array<{ quantity: number }>;
      expect(inventoryRows[0]?.quantity).toBe(3);

      const clearResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-clear-dead',
        message: 'farm:operate',
        payload: {
          action: 'clearDeadCrop',
          farmId: 'farm-2',
          slotId: 'slot-wither',
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(clearResponse.message).not.toBe('error');
      const cleared = clearResponse as ResponseEnvelope<'farm:operate'>;
      expect(cleared.payload.slots[1]).toMatchObject({
        slotId: 'slot-wither',
        cropId: null,
        status: 'empty',
      });
    } finally {
      await close();
    }
  });
});
