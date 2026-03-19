import type { ErrorEnvelope, ProtocolErrorCode, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import type { FarmQueryService } from '../modules/farm/farm-query-service';
import type { SocketSession } from './session-store';

export interface RealtimeRouter {
  handle(session: SocketSession, request: RequestEnvelope): ResponseEnvelope | ErrorEnvelope;
}

export function createRealtimeRouter(dependencies: { farmQueryService: FarmQueryService }): RealtimeRouter {
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
          default:
            return createErrorEnvelope(request.requestId, 'BAD_REQUEST', `Unsupported realtime request: ${request.message}`);
        }
      } catch (error) {
        return createErrorEnvelope(
          request.requestId,
          'NOT_FOUND',
          error instanceof Error ? error.message : 'Realtime request failed',
        );
      }
    },
  };
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
