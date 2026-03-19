import { randomUUID } from 'node:crypto';
import type { NotificationSummary } from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';

interface NotificationRow {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface NotificationService {
  create(input: {
    userId: string;
    notificationType: string;
    title: string;
    body: string;
    sourceTable?: string | null;
    sourceId?: string | null;
    meta?: Record<string, unknown>;
  }): string;
  list(userId: string): readonly NotificationSummary[];
}

export function createNotificationService(database: DatabaseClient): NotificationService {
  return {
    create(input) {
      const id = randomUUID();
      database.prepare(`
        INSERT INTO notifications (
          id, user_id, notification_type, title, body, source_table, source_id, meta_json
        ) VALUES (
          @id, @userId, @notificationType, @title, @body, @sourceTable, @sourceId, @metaJson
        )
      `).run({
        id,
        userId: input.userId,
        notificationType: input.notificationType,
        title: input.title,
        body: input.body,
        sourceTable: input.sourceTable ?? null,
        sourceId: input.sourceId ?? null,
        metaJson: JSON.stringify(input.meta ?? {}),
      });
      return id;
    },

    list(userId) {
      const rows = database.prepare(`
        SELECT id, notification_type, title, body, created_at, read_at
        FROM notifications
        WHERE user_id = @userId
        ORDER BY created_at DESC, id DESC
      `).all({ userId }) as NotificationRow[];

      return rows.map((row) => ({
        noticeId: row.id,
        notificationType: row.notification_type,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        isRead: row.read_at !== null,
      }));
    },
  };
}
