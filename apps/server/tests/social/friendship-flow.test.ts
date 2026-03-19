import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp } from '../../src/lib/test-app';

describe('social friendship flow', () => {
  it('sends requests, accepts friendships, lists friends, and removes friends', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const aliceResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Alice', password: 'secret123' },
      });
      const bobResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Bob', password: 'secret123' },
      });

      const alice = aliceResponse.json() as { user: { id: string; displayName: string } };
      const bob = bobResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES
          ('farm-alice', @aliceId, 'Alice Farm', 100, 0),
          ('farm-bob', @bobId, 'Bob Farm', 100, 0)
      `).run({ aliceId: alice.user.id, bobId: bob.user.id });

      const aliceSession = app.sessionStore.create({
        userId: alice.user.id,
        displayName: alice.user.displayName,
        requestId: 'alice-session',
      });
      const bobSession = app.sessionStore.create({
        userId: bob.user.id,
        displayName: bob.user.displayName,
        requestId: 'bob-session',
      });

      const requestResponse = app.realtimeRouter.handle(aliceSession, {
        requestId: 'req-friend-request',
        message: 'friends:request',
        payload: {
          targetUserId: bob.user.id,
          message: '加个好友',
        },
      } as RequestEnvelope<'friends:request'>);

      expect(requestResponse.message).not.toBe('error');
      const requested = requestResponse as ResponseEnvelope<'friends:request'>;
      expect(requested.payload.affectedEventNames).toEqual(['friends:list', 'notice:new']);

      const requestRows = database.prepare(`
        SELECT id, requester_user_id, addressee_user_id, status, message
        FROM friendship_requests
      `).all() as Array<{
        id: string;
        requester_user_id: string;
        addressee_user_id: string;
        status: string;
        message: string;
      }>;
      expect(requestRows).toEqual([
        {
          id: requested.payload.requestId,
          requester_user_id: alice.user.id,
          addressee_user_id: bob.user.id,
          status: 'pending',
          message: '加个好友',
        },
      ]);

      const acceptResponse = app.realtimeRouter.handle(bobSession, {
        requestId: 'req-friend-accept',
        message: 'friends:accept',
        payload: {
          requestId: requested.payload.requestId,
        },
      } as RequestEnvelope<'friends:accept'>);

      expect(acceptResponse.message).not.toBe('error');
      const accepted = acceptResponse as ResponseEnvelope<'friends:accept'>;
      expect(accepted.payload.affectedEventNames).toEqual(['friends:list', 'notice:new']);

      const friendshipRows = database.prepare(`
        SELECT id, user_id_a, user_id_b, status
        FROM friendships
      `).all() as Array<{ id: string; user_id_a: string; user_id_b: string; status: string }>;
      expect(friendshipRows).toEqual([
        {
          id: accepted.payload.friendshipId,
          user_id_a: alice.user.id,
          user_id_b: bob.user.id,
          status: 'accepted',
        },
      ]);

      const listResponse = app.realtimeRouter.handle(aliceSession, {
        requestId: 'req-friends-list',
        message: 'friends:list',
        payload: {},
      } as RequestEnvelope<'friends:list'>);

      expect(listResponse.message).not.toBe('error');
      const listed = listResponse as ResponseEnvelope<'friends:list'>;
      expect(listed.payload.friends).toEqual([
        expect.objectContaining({
          userId: bob.user.id,
          nickname: 'Bob',
          canVisit: true,
        }),
      ]);

      const removeResponse = app.realtimeRouter.handle(aliceSession, {
        requestId: 'req-friend-remove',
        message: 'friends:remove',
        payload: {
          targetUserId: bob.user.id,
        },
      } as RequestEnvelope<'friends:remove'>);

      expect(removeResponse.message).not.toBe('error');

      const removedListResponse = app.realtimeRouter.handle(aliceSession, {
        requestId: 'req-friends-list-empty',
        message: 'friends:list',
        payload: {},
      } as RequestEnvelope<'friends:list'>);
      expect(removedListResponse.message).not.toBe('error');
      expect((removedListResponse as ResponseEnvelope<'friends:list'>).payload.friends).toEqual([]);
    } finally {
      await close();
    }
  });
});
