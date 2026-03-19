import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { cropRules } from '@qq-classic-farm/config';
import { createTestApp } from '../../src/lib/test-app';

const currentTime = new Date('2026-03-19T01:00:00.000Z');
const riceRule = cropRules[0];

describe('farm realtime event side effects', () => {
  it('returns affected event names and persists task progress plus notifications for operations', async () => {
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

      const owner = ownerResponse.json() as { user: { id: string; displayName: string } };
      const visitor = visitorResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES
          ('farm-owner', @ownerUserId, 'Owner Farm', 100, 0),
          ('farm-visitor', @visitorUserId, 'Visitor Farm', 100, 0)
      `).run({
        ownerUserId: owner.user.id,
        visitorUserId: visitor.user.id,
      });
      database.prepare(`
        INSERT INTO farm_slots (id, farm_id, slot_index, crop_instance_id, locked)
        VALUES
          ('owner-slot', 'farm-owner', 0, 'owner-crop', 0),
          ('visitor-slot', 'farm-visitor', 0, NULL, 0)
      `).run();
      database.prepare(`
        INSERT INTO crop_instances (
          id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, status, meta_json
        )
        VALUES (
          'owner-crop',
          'farm-owner',
          'owner-slot',
          @cropId,
          '2026-03-19T00:45:00.000Z',
          '2026-03-19T00:55:00.000Z',
          '2026-03-19T01:15:00.000Z',
          'ready',
          '{"waterLevel":3,"grassLevel":0,"wormLevel":0,"stolenQuantity":0}'
        )
      `).run({ cropId: riceRule.cropId });
      database.prepare(`
        INSERT INTO inventory_entries (id, user_id, item_id, quantity)
        VALUES ('seed-entry', @visitorUserId, @seedItemId, 1)
      `).run({
        visitorUserId: visitor.user.id,
        seedItemId: riceRule.seedItemId,
      });
      database.prepare(`
        INSERT INTO friendships (id, user_id_a, user_id_b, status, accepted_at)
        VALUES ('friendship-1', @userIdA, @userIdB, 'accepted', CURRENT_TIMESTAMP)
      `).run({
        userIdA: owner.user.id,
        userIdB: visitor.user.id,
      });

      const visitorSession = app.sessionStore.create({
        userId: visitor.user.id,
        displayName: visitor.user.displayName,
        requestId: 'visitor-session',
      });

      const plantResponse = app.realtimeRouter.handle(visitorSession, {
        requestId: 'req-plant',
        message: 'farm:operate',
        payload: {
          action: 'plant',
          farmId: 'farm-visitor',
          slotId: 'visitor-slot',
          itemId: riceRule.seedItemId,
        },
      } as RequestEnvelope<'farm:operate'>);

      expect(plantResponse.message).not.toBe('error');
      const planted = plantResponse as ResponseEnvelope<'farm:operate'>;
      expect(planted.payload.affectedEventNames).toEqual([
        'farm:slotUpdated',
        'inventory:list',
        'task:updated',
      ]);

      const taskProgressRows = database.prepare(`
        SELECT task_id, progress, status
        FROM task_progress
        WHERE user_id = @userId
        ORDER BY task_id ASC
      `).all({ userId: visitor.user.id }) as Array<{ task_id: string; progress: number; status: string }>;
      expect(taskProgressRows).toEqual([
        {
          task_id: 'new-player-plant-first-crop',
          progress: 1,
          status: 'completed',
        },
      ]);

      const stealResponse = app.realtimeRouter.handle(visitorSession, {
        requestId: 'req-steal',
        message: 'farm:operate',
        payload: {
          action: 'steal',
          farmId: 'farm-owner',
          slotId: 'owner-slot',
          targetUserId: owner.user.id,
          targetSlotId: 'owner-slot',
          quantity: 2,
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

      const interactionRows = database.prepare(`
        SELECT actor_user_id, target_user_id, interaction_type, amount
        FROM interaction_logs
        ORDER BY created_at ASC
      `).all() as Array<{
        actor_user_id: string;
        target_user_id: string;
        interaction_type: string;
        amount: number;
      }>;
      expect(interactionRows).toEqual([
        {
          actor_user_id: visitor.user.id,
          target_user_id: owner.user.id,
          interaction_type: 'steal',
          amount: 2,
        },
      ]);

      const notificationRows = database.prepare(`
        SELECT user_id, notification_type, title
        FROM notifications
        ORDER BY created_at ASC
      `).all() as Array<{ user_id: string; notification_type: string; title: string }>;
      expect(notificationRows).toEqual([
        {
          user_id: owner.user.id,
          notification_type: 'farm-interaction',
          title: '作物被操作',
        },
      ]);
    } finally {
      await close();
    }
  });
});
