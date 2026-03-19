import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T00:20:00.000Z');
const riceRule = cropRules[0];

describe('farm:getUser', () => {
  it('returns friend farm snapshots with visit permissions and visitor actions', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Owner',
          password: 'secret123',
        },
      });
      const viewerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Visitor',
          password: 'secret123',
        },
      });

      const owner = ownerResponse.json() as { user: { id: string } };
      const viewer = viewerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-owner', @userId, 'Owner Farm', 80, 120)
      `).run({ userId: owner.user.id });

      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES ('slot-1', 'farm-owner', 0, 'crop-1', 0)
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
          'crop-1',
          'farm-owner',
          'slot-1',
          @cropId,
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:10:00.000Z',
          '2026-03-19T00:30:00.000Z',
          'ready',
          '{}'
        )
      `).run({ cropId: riceRule.cropId });

      database.prepare(`
        INSERT INTO friendships (id, user_id_a, user_id_b, status, accepted_at)
        VALUES ('friendship-1', @userIdA, @userIdB, 'accepted', CURRENT_TIMESTAMP)
      `).run({
        userIdA: owner.user.id,
        userIdB: viewer.user.id,
      });

      const session = app.sessionStore.create({
        userId: viewer.user.id,
        displayName: viewer.user.displayName,
        requestId: 'session-get-user',
      });

      const response = app.realtimeRouter.handle(session, {
        requestId: 'req-get-user',
        message: 'farm:getUser',
        payload: {
          userId: owner.user.id,
        },
      } as RequestEnvelope<'farm:getUser'>);

      expect(response.message).not.toBe('error');
      const success = response as ResponseEnvelope<'farm:getUser'>;

      expect(success.payload.isFriend).toBe(true);
      expect(success.payload.canVisit).toBe(true);
      expect(success.payload.farm.ownerUserId).toBe(owner.user.id);
      expect(success.payload.slots[0]).toMatchObject({
        slotId: 'slot-1',
        cropId: riceRule.cropId,
        status: 'mature',
        locked: false,
      });
      expect(success.payload.slots[0]?.availableActions).toEqual(['steal']);
    } finally {
      await close();
    }
  });

  it('returns non-friend farms with canVisit=false and no available visitor actions', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Locked Owner',
          password: 'secret123',
        },
      });
      const viewerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Stranger',
          password: 'secret123',
        },
      });

      const owner = ownerResponse.json() as { user: { id: string } };
      const viewer = viewerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-locked', @userId, 'Locked Farm', 50, 30)
      `).run({ userId: owner.user.id });

      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES ('slot-1', 'farm-locked', 0, 'crop-1', 0)
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
          'crop-1',
          'farm-locked',
          'slot-1',
          @cropId,
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:10:00.000Z',
          '2026-03-19T00:30:00.000Z',
          'ready',
          '{}'
        )
      `).run({ cropId: riceRule.cropId });

      const session = app.sessionStore.create({
        userId: viewer.user.id,
        displayName: viewer.user.displayName,
        requestId: 'session-get-user-stranger',
      });

      const response = app.realtimeRouter.handle(session, {
        requestId: 'req-get-user-stranger',
        message: 'farm:getUser',
        payload: {
          userId: owner.user.id,
        },
      } as RequestEnvelope<'farm:getUser'>);

      expect(response.message).not.toBe('error');
      const success = response as ResponseEnvelope<'farm:getUser'>;

      expect(success.payload.isFriend).toBe(false);
      expect(success.payload.canVisit).toBe(false);
      expect(success.payload.slots[0]?.availableActions).toEqual([]);
    } finally {
      await close();
    }
  });
});
