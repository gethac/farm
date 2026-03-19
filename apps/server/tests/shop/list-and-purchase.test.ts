import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp } from '../../src/lib/test-app';

describe('shop list and purchase', () => {
  it('lists buyable items and purchases seeds with coin deduction', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Buyer',
          password: 'secret123',
        },
      });
      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-buyer', @userId, 'Buyer Farm', 50, 0)
      `).run({ userId: registerBody.user.id });

      const session = app.sessionStore.create({
        userId: registerBody.user.id,
        displayName: registerBody.user.displayName,
        requestId: 'buyer-session',
      });

      const listResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-shop-list',
        message: 'shop:list',
        payload: {},
      } as RequestEnvelope<'shop:list'>);

      expect(listResponse.message).not.toBe('error');
      const listed = listResponse as ResponseEnvelope<'shop:list'>;
      expect(listed.payload.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'seed-rice', category: 'seed', price: 12 }),
          expect.objectContaining({ itemId: 'seed-corn', category: 'seed', price: 18 }),
        ]),
      );

      const purchaseResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-shop-purchase',
        message: 'shop:purchase',
        payload: {
          itemId: 'seed-rice',
          quantity: 2,
        },
      } as unknown as RequestEnvelope);

      expect(purchaseResponse.message).not.toBe('error');
      const purchased = purchaseResponse as ResponseEnvelope<'shop:purchase'>;
      expect(purchased.payload.farm.coins).toBe(26);
      expect(purchased.payload.inventory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'seed-rice', quantity: 2 }),
        ]),
      );
      expect(purchased.payload.affectedEventNames).toEqual(['inventory:list', 'notice:new']);

      const farmRows = database.prepare(`
        SELECT coins FROM farms WHERE id = 'farm-buyer'
      `).all() as Array<{ coins: number }>;
      expect(farmRows[0]?.coins).toBe(26);

      const inventoryRows = database.prepare(`
        SELECT item_id, quantity
        FROM inventory_entries
        WHERE user_id = @userId
      `).all({ userId: registerBody.user.id }) as Array<{ item_id: string; quantity: number }>;
      expect(inventoryRows).toEqual([
        {
          item_id: 'seed-rice',
          quantity: 2,
        },
      ]);

      const notificationRows = database.prepare(`
        SELECT notification_type, title
        FROM notifications
        WHERE user_id = @userId
      `).all({ userId: registerBody.user.id }) as Array<{ notification_type: string; title: string }>;
      expect(notificationRows).toEqual([
        {
          notification_type: 'shop-transaction',
          title: '¹ºÂò³É¹¦',
        },
      ]);
    } finally {
      await close();
    }
  });
});
