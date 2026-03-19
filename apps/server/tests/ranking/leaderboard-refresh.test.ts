import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../src/lib/test-app';
import { createRankingService } from '../../src/modules/ranking/ranking-service';

describe('leaderboard refresh', () => {
  it('refreshes snapshot leaderboards from farm metrics and lists ranked entries', async () => {
    const { app, database, close } = await createTestApp();

    try {
      const alphaResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Alpha', password: 'secret123' },
      });
      const betaResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Beta', password: 'secret123' },
      });
      const gammaResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { displayName: 'Gamma', password: 'secret123' },
      });

      const alpha = alphaResponse.json() as { user: { id: string } };
      const beta = betaResponse.json() as { user: { id: string } };
      const gamma = gammaResponse.json() as { user: { id: string } };

      database.prepare(`
        INSERT INTO farms (id, user_id, name, coins, experience)
        VALUES
          ('farm-alpha', @alphaId, 'Alpha Farm', 500, 120),
          ('farm-beta', @betaId, 'Beta Farm', 250, 350),
          ('farm-gamma', @gammaId, 'Gamma Farm', 700, 200)
      `).run({ alphaId: alpha.user.id, betaId: beta.user.id, gammaId: gamma.user.id });

      const rankingService = createRankingService(database);
      const refreshResult = rankingService.refreshAll();
      expect(refreshResult.updatedEntryCount).toBe(6);

      const coinEntries = rankingService.list('coins-all-time');
      expect(coinEntries).toEqual([
        { rank: 1, userId: gamma.user.id, nickname: 'Gamma', value: 700 },
        { rank: 2, userId: alpha.user.id, nickname: 'Alpha', value: 500 },
        { rank: 3, userId: beta.user.id, nickname: 'Beta', value: 250 },
      ]);

      const expEntries = rankingService.list('experience-all-time');
      expect(expEntries).toEqual([
        { rank: 1, userId: beta.user.id, nickname: 'Beta', value: 350 },
        { rank: 2, userId: gamma.user.id, nickname: 'Gamma', value: 200 },
        { rank: 3, userId: alpha.user.id, nickname: 'Alpha', value: 120 },
      ]);
    } finally {
      await close();
    }
  });
});
