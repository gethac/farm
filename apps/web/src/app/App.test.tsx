import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AppShell, syncSocketSession } from './App';
import { createAppRoutes } from './router';
import { gameActions, useGameStoreSnapshot } from './store/game-store';
import { sessionActions, useSessionStoreSnapshot } from './store/session-store';

const connectMock = vi.fn();
const disconnectMock = vi.fn();

describe('App shell', () => {
  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
    sessionActions.clear();
    gameActions.reset();
  });

  test('renders game shell structure and connects socket after authentication', () => {
    sessionActions.setSession({
      token: 'token-123',
      userId: 'user-1',
      displayName: '农场主',
    });

    const html = renderToStaticMarkup(
      <AppShell
        session={useSessionStoreSnapshot()}
        game={useGameStoreSnapshot()}
        routes={createAppRoutes()}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain('farm-hud-top');
    expect(html).toContain('farm-bottom-nav');
    expect(html).toContain('farm-shell__overlay');
    expect(html).toContain('farm-scene');
    expect(html).toContain('农场主');
    expect(html).toContain('金币');
    expect(html).toContain('经验');
    expect(html).toContain('商店');
    expect(html).toContain('仓库');
    expect(html).toContain('任务');
    expect(html).toContain('好友');
    expect(html).toContain('排行');
    expect(html).toContain('我的农场');

    syncSocketSession('token-123', {
      connect: connectMock,
      disconnect: disconnectMock,
    });

    expect(connectMock).toHaveBeenCalledWith('token-123');
    expect(disconnectMock).not.toHaveBeenCalled();
  });
});
