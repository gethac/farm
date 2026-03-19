import { describe, expect, it } from 'vitest';
import type { ErrorEnvelope, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp } from '../../src/lib/test-app';

describe('social visit permissions', () => {
  it('allows visiting accepted friends and rejects strangers', async () => {
    const { app, database, close } = await createTestApp();

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
      const strangerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Stranger', password: 'secret123' },
      });

      const owner = ownerResponse.json() as { user: { id: string; displayName: string } };
      const friend = friendResponse.json() as { user: { id: string; displayName: string } };
      const stranger = strangerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES
          ('farm-owner', @ownerId, 'Owner Farm', 100, 0),
          ('farm-friend', @friendId, 'Friend Farm', 100, 0),
          ('farm-stranger', @strangerId, 'Stranger Farm', 100, 0)
      `).run({ ownerId: owner.user.id, friendId: friend.user.id, strangerId: stranger.user.id });
      database.prepare(`
        INSERT INTO friendships (id, user_id_a, user_id_b, status, accepted_at)
        VALUES ('friendship-1', @userIdA, @userIdB, 'accepted', CURRENT_TIMESTAMP)
      `).run({ userIdA: owner.user.id, userIdB: friend.user.id });

      const friendSession = app.sessionStore.create({
        userId: friend.user.id,
        displayName: friend.user.displayName,
        requestId: 'friend-session',
      });
      const strangerSession = app.sessionStore.create({
        userId: stranger.user.id,
        displayName: stranger.user.displayName,
        requestId: 'stranger-session',
      });

      const strangerVisitResponse = app.realtimeRouter.handle(strangerSession, {
        requestId: 'req-visit-stranger',
        message: 'social:visit',
        payload: {
          targetUserId: owner.user.id,
        },
      } as RequestEnvelope<'social:visit'>);

      expect(strangerVisitResponse.message).toBe('error');
      expect((strangerVisitResponse as ErrorEnvelope).error.code).toBe('FORBIDDEN');

      const friendVisitResponse = app.realtimeRouter.handle(friendSession, {
        requestId: 'req-visit-friend',
        message: 'social:visit',
        payload: {
          targetUserId: owner.user.id,
        },
      } as RequestEnvelope<'social:visit'>);

      expect(friendVisitResponse.message).not.toBe('error');
      const visited = friendVisitResponse as ResponseEnvelope<'social:visit'>;
      expect(visited.payload.affectedEventNames).toEqual(['social:interactionReceived', 'notice:new']);

      const visitRows = database.prepare(`
        SELECT id, visitor_user_id, visited_user_id, visit_type, source
        FROM visit_logs
      `).all() as Array<{
        id: string;
        visitor_user_id: string;
        visited_user_id: string;
        visit_type: string;
        source: string;
      }>;
      expect(visitRows).toEqual([
        {
          id: visited.payload.visitId,
          visitor_user_id: friend.user.id,
          visited_user_id: owner.user.id,
          visit_type: 'visit',
          source: 'manual',
        },
      ]);
    } finally {
      await close();
    }
  });
});
