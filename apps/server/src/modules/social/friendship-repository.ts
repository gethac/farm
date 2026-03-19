import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '../../db/client';
import { FarmOperationError } from '../farm/farm-operation-service';

interface FriendshipRow {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: string;
  accepted_at: string | null;
}

interface FriendRequestRow {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  requested_at: string;
}

export interface FriendshipRepository {
  listAcceptedFriends(userId: string): FriendshipRow[];
  listPendingReceived(userId: string): FriendRequestRow[];
  listPendingSent(userId: string): FriendRequestRow[];
  createRequest(input: { requesterUserId: string; addresseeUserId: string; message: string | null }): string;
  findRequestById(requestId: string): FriendRequestRow | null;
  acceptRequest(requestId: string): void;
  createFriendship(input: { userIdA: string; userIdB: string }): string;
  findAcceptedFriendship(userIdA: string, userIdB: string): FriendshipRow | null;
  markFriendshipRemoved(friendshipId: string): void;
  areUsersFriends(userIdA: string, userIdB: string): boolean;
}

export function createFriendshipRepository(database: DatabaseClient): FriendshipRepository {
  return {
    listAcceptedFriends(userId) {
      return database.prepare(`
        SELECT id, user_id_a, user_id_b, status, accepted_at
        FROM friendships
        WHERE status = 'accepted'
          AND (user_id_a = @userId OR user_id_b = @userId)
        ORDER BY accepted_at DESC, created_at DESC
      `).all({ userId }) as FriendshipRow[];
    },

    listPendingReceived(userId) {
      return database.prepare(`
        SELECT id, requester_user_id, addressee_user_id, message, status, requested_at
        FROM friendship_requests
        WHERE addressee_user_id = @userId AND status = 'pending'
        ORDER BY requested_at DESC
      `).all({ userId }) as FriendRequestRow[];
    },

    listPendingSent(userId) {
      return database.prepare(`
        SELECT id, requester_user_id, addressee_user_id, message, status, requested_at
        FROM friendship_requests
        WHERE requester_user_id = @userId AND status = 'pending'
        ORDER BY requested_at DESC
      `).all({ userId }) as FriendRequestRow[];
    },

    createRequest(input) {
      const id = randomUUID();
      database.prepare(`
        INSERT INTO friendship_requests (
          id, requester_user_id, addressee_user_id, message, status
        ) VALUES (
          @id, @requesterUserId, @addresseeUserId, @message, 'pending'
        )
      `).run({
        id,
        requesterUserId: input.requesterUserId,
        addresseeUserId: input.addresseeUserId,
        message: input.message,
      });
      return id;
    },

    findRequestById(requestId) {
      const rows = database.prepare(`
        SELECT id, requester_user_id, addressee_user_id, message, status, requested_at
        FROM friendship_requests
        WHERE id = @requestId
        LIMIT 1
      `).all({ requestId }) as FriendRequestRow[];

      return rows[0] ?? null;
    },

    acceptRequest(requestId) {
      database.prepare(`
        UPDATE friendship_requests
        SET status = 'accepted',
            resolved_at = CURRENT_TIMESTAMP
        WHERE id = @requestId
      `).run({ requestId });
    },

    createFriendship(input) {
      const id = randomUUID();
      database.prepare(`
        INSERT INTO friendships (
          id, user_id_a, user_id_b, status, accepted_at
        ) VALUES (
          @id, @userIdA, @userIdB, 'accepted', CURRENT_TIMESTAMP
        )
      `).run({
        id,
        userIdA: input.userIdA,
        userIdB: input.userIdB,
      });
      return id;
    },

    findAcceptedFriendship(userIdA, userIdB) {
      const rows = database.prepare(`
        SELECT id, user_id_a, user_id_b, status, accepted_at
        FROM friendships
        WHERE status = 'accepted'
          AND ((user_id_a = @userIdA AND user_id_b = @userIdB)
            OR (user_id_a = @userIdB AND user_id_b = @userIdA))
        LIMIT 1
      `).all({ userIdA, userIdB }) as FriendshipRow[];

      return rows[0] ?? null;
    },

    markFriendshipRemoved(friendshipId) {
      database.prepare(`
        UPDATE friendships
        SET status = 'removed'
        WHERE id = @friendshipId
      `).run({ friendshipId });
    },

    areUsersFriends(userIdA, userIdB) {
      return this.findAcceptedFriendship(userIdA, userIdB) !== null;
    },
  };
}
