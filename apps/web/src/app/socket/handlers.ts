import type { EventEnvelope } from '@qq-classic-farm/protocol';
import { gameActions } from '../store/game-store';

export function handleSocketEvent(event: EventEnvelope) {
  gameActions.applyRealtimeEvent(event);
  return event;
}
