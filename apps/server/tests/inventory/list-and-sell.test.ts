import { describe, expect, it } from 'vitest';
import type { ErrorEnvelope, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp } from '../../src/lib/test-app';

describe('inventory list and sell', () => {
  it('lists inventory entries and sells harvested goods for coins', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Seller',
          password: 'secret123',
        },
      });
      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-seller', @userId, 'Seller Farm', 10, 0)
      `).run({ userId: registerBody.user.id });
      database.prepare(`
        INSERT INTO inventory_entries (id, user_id, item_id, quantity)
        VALUES
          ('entry-rice', @userId, 'rice', 5),
          ('entry-seed', @userId, 'seed-rice', 1)
      `).run({ userId: registerBody.user.id });

      const session = app.sessionStore.create({
        userId: registerBody.user.id,
        displayName: registerBody.user.displayName,
        requestId: 'seller-session',
      });

      const listResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-inventory-list',
        message: 'inventory:list',
        payload: {},
      } as RequestEnvelope<'inventory:list'>);

      expect(listResponse.message).not.toBe('error');
      const listed = listResponse as ResponseEnvelope<'inventory:list'>;
      expect(listed.payload.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'rice', quantity: 5 }),
          expect.objectContaining({ itemId: 'seed-rice', quantity: 1 }),
        ]),
      );

      const sellResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-inventory-sell',
        message: 'inventory:sell',
        payload: {
          itemId: 'rice',
          quantity: 3,
        },
      } as unknown as RequestEnvelope);

      expect(sellResponse.message).not.toBe('error');
      const sold = sellResponse as ResponseEnvelope<'inventory:sell'>;
      expect(sold.payload.farm.coins).toBe(34);
      expect(sold.payload.inventory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'rice', quantity: 2 }),
        ]),
      );
      expect(sold.payload.affectedEventNames).toEqual(['inventory:list', 'notice:new']);

      const farmRows = database.prepare(`
        SELECT coins FROM farms WHERE id = 'farm-seller'
      `).all() as Array<{ coins: number }>;
      expect(farmRows[0]?.coins).toBe(34);

      const inventoryRows = database.prepare(`
        SELECT item_id, quantity
        FROM inventory_entries
        WHERE user_id = @userId
        ORDER BY item_id ASC
      `).all({ userId: registerBody.user.id }) as Array<{ item_id: string; quantity: number }>;
      expect(inventoryRows).toEqual([
        {
          item_id: 'rice',
          quantity: 2,
        },
        {
          item_id: 'seed-rice',
          quantity: 1,
        },
      ]);

      const notificationRows = database.prepare(`
        SELECT notification_type, title
        FROM notifications
        WHERE user_id = @userId
      `).all({ userId: registerBody.user.id }) as Array<{ notification_type: string; title: string }>;
      expect(notificationRows).toEqual([
        {
          notification_type: 'inventory-transaction',
          title: '出售成功',
        },
      ]);
    } finally {
      await close();
    }
  });

  it('rejects selling more than the owned quantity', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Short Inventory',
          password: 'secret123',
        },
      });
      const registerBody = registerResponse.json() as { user: { id: string; displayName: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES ('farm-short', @userId, 'Short Farm', 10, 0)
      `).run({ userId: registerBody.user.id });
      database.prepare(`
        INSERT INTO inventory_entries (id, user_id, item_id, quantity)
        VALUES ('entry-rice', @userId, 'rice', 1)
      `).run({ userId: registerBody.user.id });

      const session = app.sessionStore.create({
        userId: registerBody.user.id,
        displayName: registerBody.user.displayName,
        requestId: 'short-session',
      });

      const sellResponse = app.realtimeRouter.handle(session, {
        requestId: 'req-inventory-sell-too-much',
        message: 'inventory:sell',
        payload: {
          itemId: 'rice',
          quantity: 2,
        },
      } as unknown as RequestEnvelope);

      expect(sellResponse.message).toBe('error');
      expect((sellResponse as ErrorEnvelope).error.code).toBe('CONFLICT');
    } finally {
      await close();
    }
  });
});
