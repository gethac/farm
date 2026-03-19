import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AppShell } from '../../app/App';
import { createAppRoutes } from '../../app/router';
import { createInitialGameState } from '../../app/store/game-store';

const session = {
  token: 'token-1',
  userId: 'user-1',
  displayName: '农场主',
};

describe('social side panels', () => {
  test('opens shop inventory and friends drawer panels', () => {
    const baseState = createInitialGameState();

    const shopHtml = renderToStaticMarkup(
      <AppShell session={session} game={{ ...baseState, activeTab: 'shop' }} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(shopHtml).toContain('种子商店');
    expect(shopHtml).toContain('玉米种子');

    const inventoryHtml = renderToStaticMarkup(
      <AppShell session={session} game={{ ...baseState, activeTab: 'inventory' }} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(inventoryHtml).toContain('仓库背包');
    expect(inventoryHtml).toContain('小麦');

    const friendsHtml = renderToStaticMarkup(
      <AppShell session={session} game={{ ...baseState, activeTab: 'friends' }} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(friendsHtml).toContain('好友列表');
    expect(friendsHtml).toContain('小葵');
  });
});
