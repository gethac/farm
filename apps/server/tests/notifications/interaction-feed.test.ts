import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T01:00:00.000Z');
const riceRule = cropRules[0];

describe('notification interaction feed', () => {
  it('lists friend request, visit and farm interaction notifications', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Owner', password: 'secret123' },
      });
      const friendResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Friend', password: 'secret123' },
      });

      const owner = ownerResponse.json() as { user: { id: string; displayName: string } };
      const friend = friendResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES
          ('farm-owner', @ownerId, 'Owner Farm', 100, 0),
          ('farm-friend', @friendId, 'Friend Farm', 100, 0)
      `).run({ ownerId: owner.user.id, friendId: friend.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES ('slot-help', 'farm-owner', 0, 'crop-help', 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        ) VALUES (
          'crop-help',
          'farm-owner',
          'slot-help',
          @cropId,
          '2026-03-19T00:56:00.000Z',
          '2026-03-19T01:06:00.000Z',
          '2026-03-19T01:26:00.000Z',
          'planted',
          '{"waterLevel":0,"grassLevel":2,"wormLevel":1,"stolenQuantity":0}'
        )
      `).run({ cropId: riceRule.cropId });
      database.prepare(`
        INSERT INTO friendships (id, user_id_a, user_id_b, status, accepted_at)
        VALUES ('friendship-1', @userIdA, @userIdB, 'accepted', CURRENT_TIMESTAMP)
      `).run({ userIdA: owner.user.id, userIdB: friend.user.id });

      const friendSession = app.sessionStore.create({
        userId: friend.user.id,
        displayName: friend.user.displayName,
        requestId: 'friend-session',
      });
      const ownerSession = app.sessionStore.create({
        userId: owner.user.id,
        displayName: owner.user.displayName,
        requestId: 'owner-session',
      });

      const visitResponse = app.realtimeRouter.handle(friendSession, {
        requestId: 'req-visit',
        message: 'social:visit',
        payload: {
          targetUserId: owner.user.id,
        },
      } as RequestEnvelope<'social:visit'>);
      expect(visitResponse.message).not.toBe('error');

      const helpResponse = app.realtimeRouter.handle(friendSession, {
        requestId: 'req-help',
        message: 'farm:operate',
        payload: {
          action: 'help',
          farmId: 'farm-owner',
          slotId: 'slot-help',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-help',
        },
      } as RequestEnvelope<'farm:operate'>);
      expect(helpResponse.message).not.toBe('error');

      const noticeListResponse = app.realtimeRouter.handle(ownerSession, {
        requestId: 'req-notice-list',
        message: 'notice:list',
        payload: {},
      } as RequestEnvelope<'notice:list'>);

      expect(noticeListResponse.message).not.toBe('error');
      const listed = noticeListResponse as ResponseEnvelope<'notice:list'>;
      expect(listed.payload.notices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ notificationType: 'friend-visit', title: '好友来访' }),
          expect.objectContaining({ notificationType: 'farm-interaction', title: '作物被操作' }),
        ]),
      );
    } finally {
      await close();
    }
  });
});
