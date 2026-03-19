import { afterEach, describe, expect, test } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp, type TestApp } from '../src/lib/test-app';

describe('test helper routes', () => {
  let fixture: TestApp | null = null;

  afterEach(async () => {
    await fixture?.close();
    fixture = null;
  });

  test('grant-friendship creates an accepted friendship by display names', async () => {
    fixture = await createTestApp({ bootstrapPlayerState: true, testMode: true });

    await fixture.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Alice', password: 'secret123' },
    });
    await fixture.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Bob', password: 'secret123' },
    });

    const response = await fixture.app.inject({
      method: 'POST',
      url: '/test/grant-friendship',
      payload: { displayNameA: 'Alice', displayNameB: 'Bob' },
    });

    expect(response.statusCode).toBe(200);

    const rows = fixture.database.prepare(`
      SELECT user_id_a, user_id_b, status
      FROM friendships
    `).all() as Array<{ user_id_a: string; user_id_b: string; status: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('accepted');
  });

  test('mature-slot prepares growing and mature crops for e2e flows', async () => {
    fixture = await createTestApp({ bootstrapPlayerState: true, testMode: true });

    const response = await fixture.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Farmer', password: 'secret123' },
    });
    const payload = response.json() as { user: { id: string; displayName: string } };

    let helperResponse = await fixture.app.inject({
      method: 'POST',
      url: '/test/mature-slot',
      payload: { displayName: 'Farmer', slotIndex: 0, state: 'growing' },
    });
    expect(helperResponse.statusCode).toBe(200);

    helperResponse = await fixture.app.inject({
      method: 'POST',
      url: '/test/mature-slot',
      payload: { displayName: 'Farmer', slotIndex: 1 },
    });
    expect(helperResponse.statusCode).toBe(200);

    const session = fixture.app.sessionStore.create({
      userId: payload.user.id,
      displayName: payload.user.displayName,
      requestId: 'farmer-session',
    });
    const snapshot = fixture.app.realtimeRouter.handle(session, {
      requestId: 'req-mine',
      message: 'farm:getMine',
      payload: {},
    } as RequestEnvelope<'farm:getMine'>) as ResponseEnvelope<'farm:getMine'>;

    expect(snapshot.payload.slots[0]).toMatchObject({
      slotId: expect.any(String),
      status: 'growing',
      availableActions: ['water', 'removeGrass', 'removeWorms', 'fertilize'],
    });
    expect(snapshot.payload.slots[1]).toMatchObject({
      slotId: expect.any(String),
      status: 'mature',
      availableActions: ['harvest'],
    });
  });
});
