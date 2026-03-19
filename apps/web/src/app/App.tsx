import { useEffect } from 'react';
import { createAppRoutes, type AppRoute } from './router';
import { useGameStore, gameActions, type GameState } from './store/game-store';
import { useSessionStore, type SessionState } from './store/session-store';
import { socketClient } from './socket/client';
import { handleSocketEvent } from './socket/handlers';
import { AuthGate } from '../features/auth/AuthGate';
import { FarmTopBar } from '../features/farm/FarmTopBar';
import { FarmScreen } from '../features/farm/FarmScreen';

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
    const unsubscribe = socketClient.subscribe(handleSocketEvent);
    return () => {
      unsubscribe();
      socketClient.disconnect();
    };
  }, [session.token]);

  if (!session.token) {
    return <AuthGate />;
  }

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
        <FarmTopBar
          displayName={props.session.displayName ?? '游客'}
          level={props.game.level}
          coins={props.game.coins}
          experience={props.game.experience}
        />

        {props.game.activeTab === 'farm' ? (
          <FarmScreen
            farm={props.game.farm}
            slots={props.game.slots}
            selectedSlotId={props.game.selectedSlotId}
            friends={props.game.friends}
            onSelectSlot={(slotId) => gameActions.selectSlot(slotId)}
            onSelectFriend={(userId) => gameActions.selectFriend(userId)}
            onCloseActionSheet={() => gameActions.selectSlot(null)}
          />
        ) : (
          <section className="content-panel" aria-label={currentRoute.label}>
            <div className="content-header">
              <strong>{currentRoute.label}</strong>
              <span>{currentRoute.description}</span>
            </div>
            <div className="panel-placeholder">{currentRoute.label} 面板即将接入实时数据。</div>
          </section>
        )}

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
