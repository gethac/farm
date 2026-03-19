import { afterEach, describe, expect, test } from 'vitest';
import { createTestApp, type TestApp } from '../../src/lib/test-app';

describe('register bootstrap', () => {
  let fixture: TestApp | null = null;

  afterEach(async () => {
    await fixture?.close();
    fixture = null;
  });

  test('registering a user creates the default farm slots and starter inventory', async () => {
    fixture = await createTestApp({ bootstrapPlayerState: true });

    const response = await fixture.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        displayName: '新农友',
        password: 'pw123456',
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { user: { id: string } };

    const farmRows = fixture.database.prepare(`
      SELECT id, coins, experience
      FROM farms
      WHERE user_id = @userId
    `).all({ userId: payload.user.id }) as Array<{ id: string; coins: number; experience: number }>;
    expect(farmRows).toHaveLength(1);
    expect(farmRows[0]?.coins).toBeGreaterThanOrEqual(0);

    const slotRows = fixture.database.prepare(`
      SELECT id
      FROM farm_slots
      WHERE farm_id = @farmId
      ORDER BY slot_index ASC
    `).all({ farmId: farmRows[0]?.id }) as Array<{ id: string }>;
    expect(slotRows).toHaveLength(6);

    const inventoryRows = fixture.database.prepare(`
      SELECT item_id, quantity
      FROM inventory_entries
      WHERE user_id = @userId
    `).all({ userId: payload.user.id }) as Array<{ item_id: string; quantity: number }>;
    expect(inventoryRows.some((row) => row.item_id === 'seed-corn' && row.quantity > 0)).toBe(true);
  });
});
