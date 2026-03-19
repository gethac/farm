import type {
  ErrorEnvelope,
  FarmOperateRequest,
  FriendRequestAcceptRequest,
  FriendRequestCreateRequest,
  FriendRemoveRequest,
  InventorySellRequest,
  ProtocolErrorCode,
  RequestEnvelope,
  ResponseEnvelope,
  ShopPurchaseRequest,
  SocialVisitRequest,
  TaskClaimRequest,
} from '@qq-classic-farm/protocol';
import type { FarmOperationService } from '../modules/farm/farm-operation-service';
import type { FarmQueryService } from '../modules/farm/farm-query-service';
import type { InventoryService } from '../modules/inventory/inventory-service';
import type { NotificationService } from '../modules/notifications/notification-service';
import type { RankingService } from '../modules/ranking/ranking-service';
import type { ShopService } from '../modules/shop/shop-service';
import type { SocialService } from '../modules/social/social-service';
import type { TaskService } from '../modules/tasks/task-service';
import type { SocketSession } from './session-store';

export interface RealtimeRouter {
  handle(session: SocketSession, request: RequestEnvelope): ResponseEnvelope | ErrorEnvelope;
}

export function createRealtimeRouter(dependencies: {
  farmQueryService: FarmQueryService;
  farmOperationService: FarmOperationService;
  inventoryService: InventoryService;
  notificationService: NotificationService;
  rankingService: RankingService;
  shopService: ShopService;
  socialService: SocialService;
  taskService: TaskService;
}): RealtimeRouter {
  return {
    handle(session, request) {
      try {
        switch (request.message) {
          case 'farm:getMine': {
            const snapshot = dependencies.farmQueryService.getMine(session.userId);
            return {
              requestId: request.requestId,
              message: 'farm:getMine',
              payload: snapshot,
            };
          }
          case 'farm:getUser': {
            const payload = request.payload as { userId: string };
            const snapshot = dependencies.farmQueryService.getUser(session.userId, payload.userId);
            return {
              requestId: request.requestId,
              message: 'farm:getUser',
              payload: snapshot,
            };
          }
          case 'farm:operate': {
            const payload = request.payload as FarmOperateRequest;
            const operation = dependencies.farmOperationService.execute(session.userId, payload);
            const snapshot = operation.farmOwnerUserId === session.userId
              ? dependencies.farmQueryService.getMine(session.userId)
              : dependencies.farmQueryService.getUser(session.userId, operation.farmOwnerUserId);

            return {
              requestId: request.requestId,
              message: 'farm:operate',
              payload: {
                farm: snapshot.farm,
                slots: snapshot.slots,
                affectedEventNames: operation.affectedEventNames,
              },
            };
          }
          case 'shop:list': {
            return {
              requestId: request.requestId,
              message: 'shop:list',
              payload: {
                items: dependencies.shopService.list(),
              },
            };
          }
          case 'shop:purchase': {
            const payload = request.payload as ShopPurchaseRequest;
            return {
              requestId: request.requestId,
              message: 'shop:purchase',
              payload: dependencies.shopService.purchase(session.userId, payload),
            };
          }
          case 'inventory:list': {
            return {
              requestId: request.requestId,
              message: 'inventory:list',
              payload: {
                items: dependencies.inventoryService.list(session.userId),
              },
            };
          }
          case 'inventory:sell': {
            const payload = request.payload as InventorySellRequest;
            return {
              requestId: request.requestId,
              message: 'inventory:sell',
              payload: dependencies.inventoryService.sell(session.userId, payload),
            };
          }
          case 'friends:list': {
            return {
              requestId: request.requestId,
              message: 'friends:list',
              payload: dependencies.socialService.listFriends(session.userId),
            };
          }
          case 'friends:request': {
            const payload = request.payload as FriendRequestCreateRequest;
            return {
              requestId: request.requestId,
              message: 'friends:request',
              payload: dependencies.socialService.sendRequest(session.userId, payload),
            };
          }
          case 'friends:accept': {
            const payload = request.payload as FriendRequestAcceptRequest;
            return {
              requestId: request.requestId,
              message: 'friends:accept',
              payload: dependencies.socialService.acceptRequest(session.userId, payload),
            };
          }
          case 'friends:remove': {
            const payload = request.payload as FriendRemoveRequest;
            return {
              requestId: request.requestId,
              message: 'friends:remove',
              payload: dependencies.socialService.removeFriend(session.userId, payload),
            };
          }
          case 'social:visit': {
            const payload = request.payload as SocialVisitRequest;
            return {
              requestId: request.requestId,
              message: 'social:visit',
              payload: dependencies.socialService.visitFriend(session.userId, payload),
            };
          }
          case 'notice:list': {
            return {
              requestId: request.requestId,
              message: 'notice:list',
              payload: {
                notices: dependencies.notificationService.list(session.userId),
              },
            };
          }
          case 'tasks:list': {
            return {
              requestId: request.requestId,
              message: 'tasks:list',
              payload: {
                tasks: dependencies.taskService.list(session.userId),
              },
            };
          }
          case 'tasks:claim': {
            const payload = request.payload as TaskClaimRequest;
            return {
              requestId: request.requestId,
              message: 'tasks:claim',
              payload: dependencies.taskService.claimReward(session.userId, payload.taskId),
            };
          }
          case 'ranking:list': {
            const payload = request.payload as { rankingId?: string };
            const rankingId = payload.rankingId ?? 'coins-all-time';
            dependencies.rankingService.refresh(rankingId);
            return {
              requestId: request.requestId,
              message: 'ranking:list',
              payload: {
                entries: dependencies.rankingService.list(rankingId),
              },
            };
          }
          default:
            return createErrorEnvelope(request.requestId, 'BAD_REQUEST', `Unsupported realtime request: ${request.message}`);
        }
      } catch (error) {
        return createErrorEnvelope(request.requestId, getErrorCode(error), error instanceof Error ? error.message : 'Realtime request failed');
      }
    },
  };
}

function getErrorCode(error: unknown): ProtocolErrorCode {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code as ProtocolErrorCode;
  }

  return 'NOT_FOUND';
}

function createErrorEnvelope(requestId: string, code: ProtocolErrorCode, message: string): ErrorEnvelope {
  return {
    message: 'error',
    requestId,
    error: {
      code,
      message,
      requestId,
    },
  };
}
