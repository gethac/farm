import { describe, expect, it } from 'vitest';
import type { ErrorEnvelope, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T01:00:00.000Z');
const riceRule = cropRules[0];

describe('farm operations: steal, help, throw worms', () => {
  it('supports friend interactions and enforces steal caps', async () => {
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
      const visitorResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Visitor',
          password: 'secret123',
        },
      });

      const owner = ownerResponse.json() as { user: { id: string } };
      const visitor = visitorResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-owner', @userId, 'Owner Farm', 100, 120)
      `).run({ userId: owner.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES
          ('slot-steal', 'farm-owner', 0, 'crop-steal', 0),
          ('slot-help', 'farm-owner', 1, 'crop-help', 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        )
        VALUES
          (
            'crop-steal',
            'farm-owner',
            'slot-steal',
            @cropId,
            '2026-03-19T00:45:00.000Z',
            '2026-03-19T00:55:00.000Z',
            '2026-03-19T01:15:00.000Z',
            'ready',
            '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}'
          ),
          (
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
      `).run({
        userIdA: owner.user.id,
        userIdB: visitor.user.id,
      });

      const session = app.sessionStore.create({
        userId: visitor.user.id,
        displayName: visitor.user.displayName,
        requestId: 'friend-visit',
      });

      const stealResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-steal',
        message: 'farm:operate',
        payload: {
          action: 'steal',
          farmId: 'farm-owner',
          slotId: 'slot-steal',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-steal',
          quantity: 5,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(stealResponse.message).not.toBe('error');
      const stolen = stealResponse as ResponseEnvelope<'farm:operate'>;
      expect(stolen.payload.affectedEventNames).toEqual([
        'farm:slotUpdated',
        'inventory:list',
        'task:updated',
        'notice:new',
      ]);

      const firstStealInventory = database.prepare(`
        SELECT quantity
        FROM inventory_entries
        WHERE user_id = @userId AND item_id = @itemId
      `).all({ userId: visitor.user.id, itemId: riceRule.cropId }) as Array<{ quantity: number }>;
      expect(firstStealInventory[0]?.quantity).toBe(2);

      const firstStealMeta = database.prepare(`
        SELECT meta_json
        FROM crop_instances
        WHERE id = 'crop-steal'
      `).all() as Array<{ meta_json: string }>;
      expect(JSON.parse(firstStealMeta[0]?.meta_json ?? '{}')).toMatchObject({
        stolenQuantity: 2,
      });

      const secondStealResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-steal-again',
        message: 'farm:operate',
        payload: {
          action: 'steal',
          farmId: 'farm-owner',
          slotId: 'slot-steal',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-steal',
          quantity: 2,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(secondStealResponse.message).not.toBe('error');

      const secondStealInventory = database.prepare(`
        SELECT quantity
        FROM inventory_entries
        WHERE user_id = @userId AND item_id = @itemId
      `).all({ userId: visitor.user.id, itemId: riceRule.cropId }) as Array<{ quantity: number }>;
      expect(secondStealInventory[0]?.quantity).toBe(3);

      const helpResponse = app.realtimeRouter.handle(session, {
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
      const helped = helpResponse as ResponseEnvelope<'farm:operate'>;
      expect(helped.payload.affectedEventNames).toEqual([
        'farm:slotUpdated',
        'notice:new',
      ]);
      expect(helped.payload.slots[1]).toMatchObject({
        slotId: 'slot-help',
        status: 'growing',
        health: 100,
      });

      const helpMetaRows = database.prepare(`
        SELECT meta_json
        FROM crop_instances
        WHERE id = 'crop-help'
      `).all() as Array<{ meta_json: string }>;
      expect(JSON.parse(helpMetaRows[0]?.meta_json ?? '{}')).toMatchObject({
        waterLevel: 3,
        grassLevel: 0,
        wormLevel: 0,
      });

      const throwWormsResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-throw-worms',
        message: 'farm:operate',
        payload: {
          action: 'throwWorms',
          farmId: 'farm-owner',
          slotId: 'slot-help',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-help',
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(throwWormsResponse.message).not.toBe('error');

      const throwWormsMetaRows = database.prepare(`
        SELECT meta_json
        FROM crop_instances
        WHERE id = 'crop-help'
      `).all() as Array<{ meta_json: string }>;
      expect(JSON.parse(throwWormsMetaRows[0]?.meta_json ?? '{}')).toMatchObject({
        wormLevel: 1,
      });

      const exhaustedStealResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-steal-empty',
        message: 'farm:operate',
        payload: {
          action: 'steal',
          farmId: 'farm-owner',
          slotId: 'slot-steal',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-steal',
          quantity: 1,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(exhaustedStealResponse.message).toBe('error');
      expect((exhaustedStealResponse as ErrorEnvelope).error.code).toBe('CONFLICT');
    } finally {
      await close();
    }
  });

  it('rejects non-friend and self-targeted friend actions', async () => {
    const { app, database, close } = await createTestApp({ now: () => currentTime });

    try {
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Solo Owner',
          password: 'secret123',
        },
      });
      const strangerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Stranger',
          password: 'secret123',
        },
      });

      const owner = ownerResponse.json() as { user: { id: string; displayName: string } };
      const stranger = strangerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-solo', @userId, 'Solo Farm', 100, 50)
      `).run({ userId: owner.user.id });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES ('slot-1', 'farm-solo', 0, 'crop-1', 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        )
        VALUES (
          'crop-1',
          'farm-solo',
          'slot-1',
          @cropId,
          '2026-03-19T00:50:00.000Z',
          '2026-03-19T01:10:00.000Z',
          '2026-03-19T01:30:00.000Z',
          'planted',
          '{"waterLevel":1,"grassLevel":1,"wormLevel":0,"stolenQuantity":0}'
        )
      `).run({ cropId: riceRule.cropId });

      const strangerSession = app.sessionStore.create({
        userId: stranger.user.id,
        displayName: stranger.user.displayName,
        requestId: 'stranger-session',
      });
      const ownerSession = app.sessionStore.create({
        userId: owner.user.id,
        displayName: owner.user.displayName,
        requestId: 'owner-session',
      });

      const nonFriendResponse = app.realtimeRouter.handle(strangerSession, {
        requestId: 'req-non-friend-help',
        message: 'farm:operate',
        payload: {
          action: 'help',
          farmId: 'farm-solo',
          slotId: 'slot-1',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-1',
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(nonFriendResponse.message).toBe('error');
      expect((nonFriendResponse as ErrorEnvelope).error.code).toBe('FORBIDDEN');

      const selfStealResponse = app.realtimeRouter.handle(ownerSession, {
        requestId: 'req-self-steal',
        message: 'farm:operate',
        payload: {
          action: 'steal',
          farmId: 'farm-solo',
          slotId: 'slot-1',
          targetUserId: owner.user.id,
          targetSlotId: 'slot-1',
          quantity: 1,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(selfStealResponse.message).toBe('error');
      expect((selfStealResponse as ErrorEnvelope).error.code).toBe('FORBIDDEN');
    } finally {
      await close();
    }
  });
});
