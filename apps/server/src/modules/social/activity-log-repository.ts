import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '../../db/client';

interface VisitRow {
  id: string;
  visitor_user_id: string;
  visited_user_id: string;
  visited_at: string;
  visit_type: string;
  source: string;
}

export interface ActivityLogRepository {
  createVisit(input: {
    visitorUserId: string;
    visitedUserId: string;
    source?: string;
    meta?: Record<string, unknown>;
  }): string;
  findLatestVisit(visitorUserId: string, visitedUserId: string): VisitRow | null;
}

export function createActivityLogRepository(database: DatabaseClient): ActivityLogRepository {
  return {
    createVisit(input) {
      const id = randomUUID();
      database.prepare(`
        INSERT INTO visit_logs (
          id, visitor_user_id, visited_user_id, visit_type, source, meta_json
        ) VALUES (
          @id, @visitorUserId, @visitedUserId, 'visit', @source, @metaJson
        )
      `).run({
        id,
        visitorUserId: input.visitorUserId,
        visitedUserId: input.visitedUserId,
        source: input.source ?? 'manual',
        metaJson: JSON.stringify(input.meta ?? {}),
      });
      return id;
    },

    findLatestVisit(visitorUserId, visitedUserId) {
      const rows = database.prepare(`
        SELECT id, visitor_user_id, visited_user_id, visited_at, visit_type, source
        FROM visit_logs
        WHERE visitor_user_id = @visitorUserId AND visited_user_id = @visitedUserId
        ORDER BY visited_at DESC, id DESC
        LIMIT 1
      `).all({ visitorUserId, visitedUserId }) as VisitRow[];

      return rows[0] ?? null;
    },
  };
}
