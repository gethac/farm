import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test } from 'vitest';
import { App } from '../../app/App';
import { gameActions } from '../../app/store/game-store';
import { sessionActions } from '../../app/store/session-store';
import { completeAuth, hydratePersistedSession, createMemoryStorage } from './AuthGate';

function createFetchStub(result: { token: string; user: { id: string; displayName: string } }) {
  return async () => ({
    ok: true,
    async json() {
      return result;
    },
  });
}

describe('auth flow', () => {
  beforeEach(() => {
    sessionActions.clear();
    gameActions.reset();
  });

  test('registers logs in persists token and redirects into the farm home screen', async () => {
    const storage = createMemoryStorage();

    await completeAuth(
      'register',
      { displayName: '农友阿布', password: 'pw123456' },
      {
        fetch: createFetchStub({
          token: 'register-token',
          user: { id: 'user-register', displayName: '农友阿布' },
        }),
        storage,
      },
    );

    expect(storage.getItem('qq-classic-farm:session')).toContain('register-token');

    sessionActions.clear();
    hydratePersistedSession(storage);
    expect(renderToStaticMarkup(<App />)).toContain('我的农场');

    sessionActions.clear();
    await completeAuth(
      'login',
      { displayName: '农友阿布', password: 'pw123456' },
      {
        fetch: createFetchStub({
          token: 'login-token',
          user: { id: 'user-register', displayName: '农友阿布' },
        }),
        storage,
      },
    );

    expect(storage.getItem('qq-classic-farm:session')).toContain('login-token');
    expect(renderToStaticMarkup(<App />)).toContain('我的农场');
  });
});
