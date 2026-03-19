import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../src/lib/test-app';
import { createNotificationService } from '../../src/modules/notifications/notification-service';
import { createNotificationBackfill } from '../../src/modules/notifications/notification-backfill';

const now = new Date('2026-03-19T01:00:00.000Z');

describe('notification backfill', () => {
  it('backfills notifications from historical visits and interactions without duplicates', async () => {
    const { app, database, close } = await createTestApp({ now: () => now });

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

      const owner = ownerResponse.json() as { user: { id: string } };
      const friend = friendResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO visit_logs (id, visitor_user_id, visited_user_id, visit_type, source, meta_json)
        VALUES ('visit-1', @visitorUserId, @visitedUserId, 'visit', 'manual', '{}')
      `).run({ visitorUserId: friend.user.id, visitedUserId: owner.user.id });
      database.prepare(`
        INSERT INTO interaction_logs (id, visit_log_id, actor_user_id, target_user_id, interaction_type, amount, payload_json)
        VALUES ('interaction-1', 'visit-1', @actorUserId, @targetUserId, 'help', 1, '{}')
      `).run({ actorUserId: friend.user.id, targetUserId: owner.user.id });

      const notificationService = createNotificationService(database);
      const backfill = createNotificationBackfill({
        database,
        notificationService,
      });

      const firstRun = backfill.runOnce();
      const secondRun = backfill.runOnce();

      expect(firstRun.createdNotificationCount).toBe(2);
      expect(secondRun.createdNotificationCount).toBe(0);

      const notificationRows = database.prepare(`
        SELECT notification_type, title, source_table, source_id
        FROM notifications
        WHERE user_id = @userId
        ORDER BY source_table ASC, source_id ASC
      `).all({ userId: owner.user.id }) as Array<{
        notification_type: string;
        title: string;
        source_table: string;
        source_id: string;
      }>;
      expect(notificationRows).toEqual([
        {
          notification_type: 'farm-interaction',
          title: '作物被操作',
          source_table: 'interaction_logs',
          source_id: 'interaction-1',
        },
        {
          notification_type: 'friend-visit',
          title: '好友来访',
          source_table: 'visit_logs',
          source_id: 'visit-1',
        },
      ]);
    } finally {
      await close();
    }
  });
});
