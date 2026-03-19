import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { cropRules } from '@qq-classic-farm/config';
import type { DatabaseClient } from './db/client';
import type { ServerEnv } from './env';
import { createAuthService } from './modules/auth/auth-service';
import { registerAuthController } from './modules/auth/auth-controller';
import { createFarmOperationService } from './modules/farm/farm-operation-service';
import { createFarmQueryService } from './modules/farm/farm-query-service';
import { createInventoryService } from './modules/inventory/inventory-service';
import { createNotificationService } from './modules/notifications/notification-service';
import { createRankingService } from './modules/ranking/ranking-service';
import { createShopService } from './modules/shop/shop-service';
import { createActivityLogRepository } from './modules/social/activity-log-repository';
import { createFriendshipRepository } from './modules/social/friendship-repository';
import { createSocialService } from './modules/social/social-service';
import { createTaskService } from './modules/tasks/task-service';
import { createRealtimeRouter, type RealtimeRouter } from './realtime/router';
import { createSessionStore, type SessionStore } from './realtime/session-store';
import { registerSocketServer } from './realtime/socket-server';

export interface AppContext {
  database: DatabaseClient;
  env: ServerEnv;
  now?: () => Date;
  bootstrapPlayerState?: boolean;
  testMode?: boolean;
}

export interface ServerApp {
  get(path: string, handler: () => Promise<unknown>): void;
  post(path: string, handler: (request: { body?: unknown }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) => Promise<unknown> | unknown): void;
  inject(args: { method: string; url: string; payload?: unknown }): Promise<{ statusCode: number; json(): unknown }>;
  listen(options: { host: string; port: number }): Promise<void>;
  close(): Promise<void>;
  server: {
    on(event: 'upgrade', listener: (request: { url?: string; headers: Record<string, string | string[] | undefined> }, socket: { write(data: string | Uint8Array): void; end(data?: string): void; destroy(): void; on(event: string, listener: (...args: unknown[]) => void): void }, head: Uint8Array) => void): void;
    address(): { port: number } | string | null;
  };
  sessionStore: SessionStore;
  realtimeRouter: RealtimeRouter;
}

interface UserRow {
  id: string;
  display_name: string;
}

interface FarmRow {
  id: string;
}

interface SlotRow {
  id: string;
  crop_instance_id: string | null;
}

interface CropRow {
  id: string;
}

export async function buildApp(context: AppContext): Promise<ServerApp> {
  const app = Fastify({ logger: false }) as ServerApp;
  const now = context.now ?? (() => new Date());

  const authService = createAuthService(context.database, context.env.authSecret, context.bootstrapPlayerState ?? true);
  const sessionStore = createSessionStore();
  const notificationService = createNotificationService(context.database);
  const taskService = createTaskService(context.database, now, notificationService);
  const rankingService = createRankingService(context.database);
  const farmQueryService = createFarmQueryService(context.database, now);
  const farmOperationService = createFarmOperationService(context.database, now);
  const inventoryService = createInventoryService(context.database, now);
  const shopService = createShopService(context.database, now);
  const friendshipRepository = createFriendshipRepository(context.database);
  const activityLogRepository = createActivityLogRepository(context.database);
  const socialService = createSocialService({
    database: context.database,
    friendshipRepository,
    activityLogRepository,
    notificationService,
  });
  const realtimeRouter = createRealtimeRouter({
    farmQueryService,
    farmOperationService,
    inventoryService,
    notificationService,
    rankingService,
    shopService,
    socialService,
    taskService,
  });

  app.sessionStore = sessionStore;
  app.realtimeRouter = realtimeRouter;

  registerAuthController(app, authService);
  registerSocketServer(app, authService, sessionStore, realtimeRouter);

  if (context.testMode ?? context.env.testMode) {
    registerTestRoutes(app, context.database, now);
  }

  app.get('/health', async () => ({ ok: true }));

  return app;
}

function registerTestRoutes(app: ServerApp, database: DatabaseClient, now: () => Date): void {
  app.post('/test/grant-friendship', async (request, reply) => {
    const body = (request.body ?? {}) as { displayNameA?: string; displayNameB?: string };
    const displayNameA = body.displayNameA?.trim();
    const displayNameB = body.displayNameB?.trim();

    if (!displayNameA || !displayNameB) {
      return reply.code(400).send({ error: 'displayNameA and displayNameB are required' });
    }

    const userA = findUserByDisplayName(database, displayNameA);
    const userB = findUserByDisplayName(database, displayNameB);
    if (!userA || !userB) {
      return reply.code(404).send({ error: 'User not found' });
    }

    ensureAcceptedFriendship(database, userA.id, userB.id);
    return { ok: true };
  });

  app.post('/test/mature-slot', async (request, reply) => {
    const body = (request.body ?? {}) as { displayName?: string; slotIndex?: number; state?: 'growing' | 'mature' };
    const displayName = body.displayName?.trim();
    const slotIndex = body.slotIndex;
    const state = body.state === 'growing' ? 'growing' : 'mature';

    if (!displayName || !Number.isInteger(slotIndex) || (slotIndex as number) < 0) {
      return reply.code(400).send({ error: 'displayName and non-negative slotIndex are required' });
    }

    const user = findUserByDisplayName(database, displayName);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const farm = findFarmByUserId(database, user.id);
    const slot = farm ? findSlotByIndex(database, farm.id, slotIndex as number) : null;
    if (!farm || !slot) {
      return reply.code(404).send({ error: 'Farm slot not found' });
    }

    seedSlotState(database, {
      farmId: farm.id,
      slotId: slot.id,
      existingCropId: slot.crop_instance_id,
      state,
      currentTime: now(),
    });

    return { ok: true };
  });
}

function findUserByDisplayName(database: DatabaseClient, displayName: string): UserRow | null {
  const rows = database.prepare(`
    SELECT id, display_name
    FROM users
    WHERE display_name = @displayName
    LIMIT 1
  `).all({ displayName }) as UserRow[];

  return rows[0] ?? null;
}

function findFarmByUserId(database: DatabaseClient, userId: string): FarmRow | null {
  const rows = database.prepare(`
    SELECT id
    FROM farms
    WHERE user_id = @userId
    LIMIT 1
  `).all({ userId }) as FarmRow[];

  return rows[0] ?? null;
}

function findSlotByIndex(database: DatabaseClient, farmId: string, slotIndex: number): SlotRow | null {
  const rows = database.prepare(`
    SELECT id, crop_instance_id
    FROM farm_slots
    WHERE farm_id = @farmId AND slot_index = @slotIndex
    LIMIT 1
  `).all({ farmId, slotIndex }) as SlotRow[];

  return rows[0] ?? null;
}

function ensureAcceptedFriendship(database: DatabaseClient, userIdA: string, userIdB: string): void {
  const existingRows = database.prepare(`
    SELECT id
    FROM friendships
    WHERE (user_id_a = @userIdA AND user_id_b = @userIdB)
       OR (user_id_a = @userIdB AND user_id_b = @userIdA)
    LIMIT 1
  `).all({ userIdA, userIdB }) as Array<{ id: string }>;
  const existing = existingRows[0];

  if (existing) {
    database.prepare(`
      UPDATE friendships
      SET status = 'accepted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id: existing.id });
    return;
  }

  database.prepare(`
    INSERT INTO friendships (id, user_id_a, user_id_b, status)
    VALUES (@id, @userIdA, @userIdB, 'accepted')
  `).run({
    id: randomUUID(),
    userIdA,
    userIdB,
  });
}

function seedSlotState(database: DatabaseClient, input: {
  farmId: string;
  slotId: string;
  existingCropId: string | null;
  state: 'growing' | 'mature';
  currentTime: Date;
}): void {
  const cropRule = cropRules.find((rule) => rule.cropId === 'corn') ?? cropRules[0];
  const existingRows = database.prepare(`
    SELECT id
    FROM crop_instances
    WHERE farm_slot_id = @slotId AND status != 'harvested'
    ORDER BY planted_at DESC
    LIMIT 1
  `).all({ slotId: input.slotId }) as CropRow[];
  const existingCrop = existingRows[0];
  const cropInstanceId = existingCrop?.id ?? input.existingCropId ?? randomUUID();

  const growingReadyAt = new Date(input.currentTime.getTime() + Math.max(60_000, Math.floor(cropRule.growthDurationMs / 3)));
  const growingPlantedAt = new Date(growingReadyAt.getTime() - cropRule.growthDurationMs);
  const matureReadyAt = new Date(input.currentTime.getTime() - 60_000);
  const maturePlantedAt = new Date(matureReadyAt.getTime() - cropRule.growthDurationMs);

  const plantedAt = input.state === 'growing' ? growingPlantedAt : maturePlantedAt;
  const readyAt = input.state === 'growing' ? growingReadyAt : matureReadyAt;
  const withersAt = new Date(readyAt.getTime() + cropRule.witherDurationMs);
  const status = input.state === 'growing' ? 'planted' : 'ready';
  const metaJson = JSON.stringify({
    waterLevel: input.state === 'growing' ? 1 : 3,
    grassLevel: 0,
    wormLevel: 0,
    fertilized: false,
    stolenQuantity: 0,
  });

  if (existingCrop) {
    database.prepare(`
      UPDATE crop_instances
      SET farm_id = @farmId,
          farm_slot_id = @slotId,
          crop_id = @cropId,
          planted_at = @plantedAt,
          ready_at = @readyAt,
          withers_at = @withersAt,
          harvested_at = NULL,
          status = @status,
          meta_json = @metaJson
      WHERE id = @id
    `).run({
      id: cropInstanceId,
      farmId: input.farmId,
      slotId: input.slotId,
      cropId: cropRule.cropId,
      plantedAt: plantedAt.toISOString(),
      readyAt: readyAt.toISOString(),
      withersAt: withersAt.toISOString(),
      status,
      metaJson,
    });
  } else {
    database.prepare(`
      INSERT INTO crop_instances (
        id, farm_id, farm_slot_id, crop_id, planted_at, ready_at, withers_at, harvested_at, status, meta_json
      ) VALUES (
        @id, @farmId, @slotId, @cropId, @plantedAt, @readyAt, @withersAt, NULL, @status, @metaJson
      )
    `).run({
      id: cropInstanceId,
      farmId: input.farmId,
      slotId: input.slotId,
      cropId: cropRule.cropId,
      plantedAt: plantedAt.toISOString(),
      readyAt: readyAt.toISOString(),
      withersAt: withersAt.toISOString(),
      status,
      metaJson,
    });
  }

  database.prepare(`
    UPDATE farm_slots
    SET crop_instance_id = @cropInstanceId,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @slotId
  `).run({ cropInstanceId, slotId: input.slotId });
}
