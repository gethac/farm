import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { EventEnvelope, FarmSlotSummary, FriendSummary } from '@qq-classic-farm/protocol';
import { FarmScreen } from './FarmScreen';
import { createInitialGameState, reduceRealtimeEvent } from '../../app/store/game-store';

const sampleFriends: FriendSummary[] = [
  { userId: 'friend-1', nickname: 'friend-a', canVisit: true, lastVisitAt: null },
  { userId: 'friend-2', nickname: 'friend-b', canVisit: true, lastVisitAt: null },
];

const slotUpdatedEvent: EventEnvelope<'farm:slotUpdated'> = {
  message: 'farm:slotUpdated',
  payload: {
    farmId: 'farm-me',
    slot: {
      slotId: 'slot-2',
      cropId: 'corn',
      plantedAt: '2026-03-19T10:00:00.000Z',
      maturedAt: '2026-03-19T11:00:00.000Z',
      withersAt: '2026-03-19T14:00:00.000Z',
      status: 'mature',
      stage: 3,
      health: 92,
      locked: false,
      availableActions: ['harvest'],
    },
  },
};

describe('farm screen', () => {
  test('renders slots action sheet and updates after farm realtime events', () => {
    const initialState = createInitialGameState();
    const selectedState = {
      ...initialState,
      farm: {
        ...initialState.farm,
        nickname: 'my-farm',
      },
      friends: sampleFriends,
      selectedSlotId: 'slot-2',
    };

    const initialHtml = renderToStaticMarkup(
      <FarmScreen
        farm={selectedState.farm}
        slots={selectedState.slots}
        selectedSlotId={selectedState.selectedSlotId}
        friends={selectedState.friends}
        onSelectSlot={() => undefined}
        onSelectFriend={() => undefined}
        onCloseActionSheet={() => undefined}
        onAction={() => undefined}
        onRefresh={() => undefined}
      />,
    );

    expect(initialHtml).toContain('my-farm');
    expect(initialHtml).toContain('friend-a');
    expect(initialHtml).toContain('friend-b');
    expect(initialHtml).toContain('action-sheet__button');

    const updatedState = reduceRealtimeEvent(selectedState, slotUpdatedEvent);
    const updatedSlot = updatedState.slots.find((slot) => slot.slotId === 'slot-2') as FarmSlotSummary;
    expect(updatedSlot.status).toBe('mature');
    expect(updatedSlot.availableActions).toContain('harvest');

    const updatedHtml = renderToStaticMarkup(
      <FarmScreen
        farm={updatedState.farm}
        slots={updatedState.slots}
        selectedSlotId={updatedState.selectedSlotId}
        friends={updatedState.friends}
        onSelectSlot={() => undefined}
        onSelectFriend={() => undefined}
        onCloseActionSheet={() => undefined}
        onAction={() => undefined}
        onRefresh={() => undefined}
      />,
    );

    expect(updatedHtml).toContain('farm-slot-card--mature');
    expect(updatedHtml).toContain('action-sheet__button');
  });
});
