import { runInTransaction } from '../../lib/transactions';
import type {
  FriendAcceptSummary,
  FriendRequestCreatedSummary,
  FriendRequestSummary,
  FriendRemoveSummary,
  FriendSummary,
  SocialVisitSummary,
} from '@qq-classic-farm/protocol';
import type { DatabaseClient } from '../../db/client';
import { FarmOperationError } from '../farm/farm-operation-service';
import type { NotificationService } from '../notifications/notification-service';
import type { ActivityLogRepository } from './activity-log-repository';
import type { FriendshipRepository } from './friendship-repository';

interface UserRow {
  id: string;
  display_name: string;
}

export interface SocialService {
  listFriends(userId: string): {
    friends: readonly FriendSummary[];
    pendingReceived: readonly FriendRequestSummary[];
    pendingSent: readonly FriendRequestSummary[];
  };
  sendRequest(userId: string, input: { targetUserId: string; message?: string }): FriendRequestCreatedSummary;
  acceptRequest(userId: string, input: { requestId: string }): FriendAcceptSummary;
  removeFriend(userId: string, input: { targetUserId: string }): FriendRemoveSummary;
  visitFriend(userId: string, input: { targetUserId: string }): SocialVisitSummary;
}

export function createSocialService(dependencies: {
  database: DatabaseClient;
  friendshipRepository: FriendshipRepository;
  activityLogRepository: ActivityLogRepository;
  notificationService: NotificationService;
}): SocialService {
  const { database, friendshipRepository, activityLogRepository, notificationService } = dependencies;

  return {
    listFriends(userId) {
      const friends = friendshipRepository.listAcceptedFriends(userId).map((friendship) => {
        const friendUserId = friendship.user_id_a === userId ? friendship.user_id_b : friendship.user_id_a;
        const friend = requireUser(friendUserId);
        const latestVisit = activityLogRepository.findLatestVisit(userId, friendUserId);

        return {
          userId: friend.id,
          nickname: friend.display_name,
          canVisit: true,
          lastVisitAt: latestVisit?.visited_at ?? null,
        } satisfies FriendSummary;
      });

      const pendingReceived = friendshipRepository.listPendingReceived(userId).map((request) => {
        const requester = requireUser(request.requester_user_id);
        return {
          requestId: request.id,
          requesterUserId: requester.id,
          requesterNickname: requester.display_name,
          addresseeUserId: request.addressee_user_id,
          message: request.message,
          status: request.status,
          requestedAt: request.requested_at,
        } satisfies FriendRequestSummary;
      });

      const pendingSent = friendshipRepository.listPendingSent(userId).map((request) => {
        const requester = requireUser(request.requester_user_id);
        return {
          requestId: request.id,
          requesterUserId: requester.id,
          requesterNickname: requester.display_name,
          addresseeUserId: request.addressee_user_id,
          message: request.message,
          status: request.status,
          requestedAt: request.requested_at,
        } satisfies FriendRequestSummary;
      });

      return {
        friends,
        pendingReceived,
        pendingSent,
      };
    },

    sendRequest(userId, input) {
      return runInTransaction(database, () => {
        if (userId === input.targetUserId) {
          throw new FarmOperationError('FORBIDDEN', 'Cannot add yourself as a friend');
        }
        requireUser(userId);
        const targetUser = requireUser(input.targetUserId);

        if (friendshipRepository.areUsersFriends(userId, input.targetUserId)) {
          throw new FarmOperationError('CONFLICT', 'Users are already friends');
        }

        const requestId = friendshipRepository.createRequest({
          requesterUserId: userId,
          addresseeUserId: input.targetUserId,
          message: normalizeOptionalMessage(input.message),
        });

        notificationService.create({
          userId: input.targetUserId,
          notificationType: 'friend-request',
          title: '新的好友申请',
          body: `${requireUser(userId).display_name} 想添加你为好友`,
          sourceTable: 'friendship_requests',
          sourceId: requestId,
        });

        void targetUser;
        return {
          requestId,
          affectedEventNames: ['friends:list', 'notice:new'],
        };
      });
    },

    acceptRequest(userId, input) {
      return runInTransaction(database, () => {
        const request = friendshipRepository.findRequestById(input.requestId);
        if (!request || request.status !== 'pending') {
          throw new FarmOperationError('NOT_FOUND', 'Friend request not found');
        }
        if (request.addressee_user_id !== userId) {
          throw new FarmOperationError('FORBIDDEN', 'Only the addressee can accept this request');
        }

        friendshipRepository.acceptRequest(request.id);
        const friendshipId = friendshipRepository.createFriendship({
          userIdA: request.requester_user_id,
          userIdB: request.addressee_user_id,
        });

        notificationService.create({
          userId: request.requester_user_id,
          notificationType: 'friend-accept',
          title: '好友申请已通过',
          body: `${requireUser(userId).display_name} 已通过你的好友申请`,
          sourceTable: 'friendships',
          sourceId: friendshipId,
        });

        return {
          friendshipId,
          affectedEventNames: ['friends:list', 'notice:new'],
        };
      });
    },

    removeFriend(userId, input) {
      return runInTransaction(database, () => {
        const friendship = friendshipRepository.findAcceptedFriendship(userId, input.targetUserId);
        if (!friendship) {
          throw new FarmOperationError('NOT_FOUND', 'Friendship not found');
        }

        friendshipRepository.markFriendshipRemoved(friendship.id);

        return {
          removedUserId: input.targetUserId,
          affectedEventNames: ['friends:list'],
        };
      });
    },

    visitFriend(userId, input) {
      return runInTransaction(database, () => {
        if (!friendshipRepository.areUsersFriends(userId, input.targetUserId)) {
          throw new FarmOperationError('FORBIDDEN', 'Friendship required for visiting');
        }

        const visitor = requireUser(userId);
        const targetUser = requireUser(input.targetUserId);
        const visitId = activityLogRepository.createVisit({
          visitorUserId: userId,
          visitedUserId: input.targetUserId,
        });

        notificationService.create({
          userId: input.targetUserId,
          notificationType: 'friend-visit',
          title: '好友来访',
          body: `${visitor.display_name} 访问了你的农场`,
          sourceTable: 'visit_logs',
          sourceId: visitId,
        });

        void targetUser;
        return {
          visitId,
          affectedEventNames: ['social:interactionReceived', 'notice:new'],
        };
      });
    },
  };

  function requireUser(userId: string): UserRow {
    const rows = database.prepare(`
      SELECT id, display_name
      FROM users
      WHERE id = @userId
      LIMIT 1
    `).all({ userId }) as UserRow[];

    const user = rows[0];
    if (!user) {
      throw new FarmOperationError('NOT_FOUND', 'User not found');
    }

    return user;
  }
}

function normalizeOptionalMessage(value: string | undefined): string | null {
  const message = value?.trim();
  return message ? message : null;
}
