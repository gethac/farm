import { describe, expect, it } from 'vitest';
import type { ErrorEnvelope, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T00:10:00.000Z');
const riceRule = cropRules[0];

describe('farm:getMine', () => {
  it('returns the owner farm snapshot with calculated slot state and available actions', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Ada Lovelace',
          password: 'secret123',
        },
      });

      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };
      const userId = registerBody.user.id;

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES (@id, @userId, @name, @coins, @experience)
      `).run({
        id: 'farm-ada',
        userId,
        name: 'Ada Farm',
        coins: 250,
        experience: 250,
      });

      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES
          ('slot-1', 'farm-ada', 0, 'crop-1', 0),
          ('slot-2', 'farm-ada', 1, NULL, 1)
      `).run();

      database.prepare(`
        INSERT INTO crop_instances (
          id,
          farm_id,
          farm_slot_id,
          crop_id,
          planted_at,
          ready_at,
          withers_at,
          status,
          meta_json
        )
        VALUES (
          @id,
          @farmId,
          @slotId,
          @cropId,
          @plantedAt,
          @readyAt,
          @withersAt,
          'planted',
          @metaJson
        )
      `).run({
        id: 'crop-1',
        farmId: 'farm-ada',
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        plantedAt: '2026-03-19T00:07:00.000Z',
        readyAt: '2026-03-19T00:17:00.000Z',
        withersAt: '2026-03-19T00:37:00.000Z',
        metaJson: JSON.stringify({ waterLevel: 0, grassLevel: 2, wormLevel: 1 }),
      });

      const session = app.sessionStore.create({
        userId,
        displayName: registerBody.user.displayName,
        requestId: 'session-get-mine',
      });

      const response = app.realtimeRouter.handle(session, {
        requestId: 'req-get-mine',
        message: 'farm:getMine',
        payload: {},
      } as RequestEnvelope<'farm:getMine'>);

      expect(response.message).not.toBe('error');
      const success = response as ResponseEnvelope<'farm:getMine'>;

      expect(success.payload.farm).toMatchObject({
        farmId: 'farm-ada',
        ownerUserId: userId,
        nickname: 'Ada Lovelace',
        coins: 250,
        experience: 250,
        level: 3,
      });
      expect(success.payload.farm.dog).toEqual({
        isActive: false,
        protectionUntil: null,
      });
      expect(success.payload.slots).toHaveLength(2);
      expect(success.payload.slots[0]).toMatchObject({
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        status: 'growing',
        stage: 1,
        health: 45,
        locked: false,
      });
      expect(success.payload.slots[0]?.availableActions).toEqual(['water', 'removeGrass', 'removeWorms', 'fertilize']);
      expect(success.payload.slots[1]).toMatchObject({
        slotId: 'slot-2',
        cropId: null,
        status: 'empty',
        locked: true,
      });
      expect(success.payload.slots[1]?.availableActions).toEqual([]);
    } finally {
      await close();
    }
  });
});
