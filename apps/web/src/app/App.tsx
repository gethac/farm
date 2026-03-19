import { useEffect } from 'react';
import { createAppRoutes, type AppRoute } from './router';
import { useGameStore, gameActions, type GameState } from './store/game-store';
import { useSessionStore, type SessionState } from './store/session-store';
import { socketClient } from './socket/client';

const routes = createAppRoutes();

export interface SocketSessionController {
  connect(token: string): void;
  disconnect(): void;
}

export function syncSocketSession(token: string | null, controller: SocketSessionController) {
  if (!token) {
    controller.disconnect();
    return;
  }

  controller.connect(token);
}

export function App() {
  const session = useSessionStore();
  const game = useGameStore();

  useEffect(() => {
    syncSocketSession(session.token, socketClient);
    return () => {
      socketClient.disconnect();
    };
  }, [session.token]);

  return (
    <AppShell
      session={session}
      game={game}
      routes={routes}
      onNavigate={(tabId) => gameActions.setActiveTab(tabId)}
    />
  );
}

export function AppShell(props: {
  session: SessionState;
  game: GameState;
  routes: readonly AppRoute[];
  onNavigate(tabId: AppRoute['id']): void;
}) {
  const currentRoute = props.routes.find((route) => route.id === props.game.activeTab) ?? props.routes[0];

  return (
    <div className="app-shell">
      <div className="app-bg app-bg--sky" />
      <div className="app-bg app-bg--glow" />
      <main className="mobile-frame">
        <header className="top-bar">
          <div className="avatar-badge" aria-hidden="true">
            农
          </div>
          <div className="profile-copy">
            <strong>{props.session.displayName ?? '游客'}</strong>
            <span>Lv.{props.game.level} 农场新星</span>
          </div>
          <div className="stat-chip">
            <span>金币</span>
            <strong>{props.game.coins}</strong>
          </div>
          <div className="stat-chip">
            <span>经验</span>
            <strong>{props.game.experience}</strong>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="hero-kicker">QQ经典农场</p>
            <h1>我的农场</h1>
            <p>{currentRoute.description}</p>
          </div>
          <div className="hero-scene" aria-hidden="true">
            <div className="scene-sun" />
            <div className="scene-cloud scene-cloud--left" />
            <div className="scene-cloud scene-cloud--right" />
            <div className="scene-hill" />
            <div className="scene-field">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section className="content-panel" aria-label={currentRoute.label}>
          <div className="content-header">
            <strong>{currentRoute.label}</strong>
            <span>移动端经典界面骨架已接入</span>
          </div>
          <div className="farm-grid" aria-hidden="true">
            <span className="farm-grid__slot farm-grid__slot--active" />
            <span className="farm-grid__slot" />
            <span className="farm-grid__slot farm-grid__slot--ready" />
            <span className="farm-grid__slot" />
            <span className="farm-grid__slot" />
            <span className="farm-grid__slot farm-grid__slot--locked" />
          </div>
        </section>

        <nav className="bottom-nav" aria-label="主导航">
          {props.routes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={route.id === props.game.activeTab ? 'nav-button nav-button--active' : 'nav-button'}
              onClick={() => props.onNavigate(route.id)}
            >
              <span>{route.icon}</span>
              <strong>{route.label}</strong>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
