import type { DatabaseClient } from '../../db/client';
import type { NotificationService } from './notification-service';

interface VisitRow {
  id: string;
  visitor_user_id: string;
  visited_user_id: string;
}

interface InteractionRow {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  interaction_type: 'steal' | 'help';
  amount: number;
}

interface UserRow {
  id: string;
  display_name: string;
}

export interface NotificationBackfill {
  runOnce(): {
    createdNotificationCount: number;
  };
}

export function createNotificationBackfill(dependencies: {
  database: DatabaseClient;
  notificationService: NotificationService;
}): NotificationBackfill {
  return {
    runOnce() {
      let createdNotificationCount = 0;

      const visitRows = dependencies.database.prepare(`
        SELECT id, visitor_user_id, visited_user_id
        FROM visit_logs
        ORDER BY visited_at ASC, id ASC
      `).all() as VisitRow[];

      for (const visit of visitRows) {
        if (hasNotification(dependencies.database, 'visit_logs', visit.id)) {
          continue;
        }

        const visitor = findUser(dependencies.database, visit.visitor_user_id);
        dependencies.notificationService.create({
          userId: visit.visited_user_id,
          notificationType: 'friend-visit',
          title: '好友来访',
          body: `${visitor?.display_name ?? '好友'} 访问了你的农场`,
          sourceTable: 'visit_logs',
          sourceId: visit.id,
        });
        createdNotificationCount += 1;
      }

      const interactionRows = dependencies.database.prepare(`
        SELECT id, actor_user_id, target_user_id, interaction_type, amount
        FROM interaction_logs
        ORDER BY created_at ASC, id ASC
      `).all() as InteractionRow[];

      for (const interaction of interactionRows) {
        if (hasNotification(dependencies.database, 'interaction_logs', interaction.id)) {
          continue;
        }

        const actor = findUser(dependencies.database, interaction.actor_user_id);
        const body = interaction.interaction_type === 'help'
          ? `${actor?.display_name ?? '好友'} 帮你照料了作物`
          : `${actor?.display_name ?? '好友'} 操作了你的作物，数量 ${interaction.amount}`;

        dependencies.notificationService.create({
          userId: interaction.target_user_id,
          notificationType: 'farm-interaction',
          title: '作物被操作',
          body,
          sourceTable: 'interaction_logs',
          sourceId: interaction.id,
        });
        createdNotificationCount += 1;
      }

      return { createdNotificationCount };
    },
  };
}

function hasNotification(database: DatabaseClient, sourceTable: string, sourceId: string): boolean {
  const rows = database.prepare(`
    SELECT id
    FROM notifications
    WHERE source_table = @sourceTable AND source_id = @sourceId
    LIMIT 1
  `).all({ sourceTable, sourceId }) as Array<{ id: string }>;

  return rows.length > 0;
}

function findUser(database: DatabaseClient, userId: string): UserRow | null {
  const rows = database.prepare(`
    SELECT id, display_name
    FROM users
    WHERE id = @userId
    LIMIT 1
  `).all({ userId }) as UserRow[];

  return rows[0] ?? null;
}
