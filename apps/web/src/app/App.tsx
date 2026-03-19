import { useEffect } from 'react';
import type {
  FarmOperateAction,
  FriendSummary,
  InventoryEntrySummary,
  LeaderboardEntrySummary,
  NotificationSummary,
  ShopItemSummary,
  TaskSummary,
} from '@qq-classic-farm/protocol';
import { createAppRoutes, type AppRoute } from './router';
import { useGameStore, gameActions, type GameState } from './store/game-store';
import { useSessionStore, type SessionState } from './store/session-store';
import { socketClient } from './socket/client';
import { handleSocketEvent } from './socket/handlers';
import { AuthGate } from '../features/auth/AuthGate';
import { FarmTopBar } from '../features/farm/FarmTopBar';
import { FarmScreen } from '../features/farm/FarmScreen';
import { ShopSheet } from '../features/shop/ShopSheet';
import { InventorySheet } from '../features/inventory/InventorySheet';
import { FriendsDrawer } from '../features/social/FriendsDrawer';
import { TasksSheet } from '../features/tasks/TasksSheet';
import { RankingSheet } from '../features/ranking/RankingSheet';
import { NotificationsPanel } from '../features/notifications/NotificationsPanel';

const routes = createAppRoutes();

export interface SocketSessionController {
  connect(token: string): Promise<void> | void;
  disconnect(): void;
}

export function syncSocketSession(token: string | null, controller: SocketSessionController) {
  if (!token) {
    controller.disconnect();
    return;
  }

  return controller.connect(token);
}

export async function loadInitialGameState() {
  const [farmMine, shopList, inventoryList, friendsList, tasksList, rankingList, noticeList] = await Promise.all([
    socketClient.request('farm:getMine', {}),
    socketClient.request('shop:list', {}),
    socketClient.request('inventory:list', {}),
    socketClient.request('friends:list', {}),
    socketClient.request('tasks:list', {}),
    socketClient.request('ranking:list', { rankingId: 'coins-all-time' }),
    socketClient.request('notice:list', {}),
  ]);

  gameActions.hydrateFarm(farmMine.farm, farmMine.slots);
  gameActions.setShopItems(shopList.items as readonly ShopItemSummary[]);
  gameActions.setInventoryItems(inventoryList.items as readonly InventoryEntrySummary[]);
  gameActions.setFriends(friendsList.friends as readonly FriendSummary[]);
  gameActions.setTasks(tasksList.tasks as readonly TaskSummary[]);
  gameActions.setRankingEntries(rankingList.entries as readonly LeaderboardEntrySummary[]);
  gameActions.setNotices(noticeList.notices as readonly NotificationSummary[]);
}

export function App() {
  const session = useSessionStore();
  const game = useGameStore();

  useEffect(() => {
    const unsubscribe = socketClient.subscribe(handleSocketEvent);
    if (!session.token) {
      socketClient.disconnect();
      return () => unsubscribe();
    }

    void (async () => {
      try {
        await syncSocketSession(session.token, socketClient);
        await loadInitialGameState();
      } catch {
        // Keep fallback state for now when bootstrap requests fail.
      }
    })();

    return () => {
      unsubscribe();
      socketClient.disconnect();
    };
  }, [session.token]);

  if (!session.token) {
    return <AuthGate />;
  }

  async function refreshFarm(targetUserId?: string) {
    if (targetUserId) {
      const snapshot = await socketClient.request('farm:getUser', { userId: targetUserId });
      gameActions.hydrateFarm(snapshot.farm, snapshot.slots);
      gameActions.selectFriend(targetUserId);
      return;
    }

    const snapshot = await socketClient.request('farm:getMine', {});
    gameActions.hydrateFarm(snapshot.farm, snapshot.slots);
    gameActions.selectFriend(null);
  }

  async function refreshSecondaryData() {
    const [inventoryList, friendsList, tasksList, rankingList, noticeList] = await Promise.all([
      socketClient.request('inventory:list', {}),
      socketClient.request('friends:list', {}),
      socketClient.request('tasks:list', {}),
      socketClient.request('ranking:list', { rankingId: 'coins-all-time' }),
      socketClient.request('notice:list', {}),
    ]);
    gameActions.setInventoryItems(inventoryList.items as readonly InventoryEntrySummary[]);
    gameActions.setFriends(friendsList.friends as readonly FriendSummary[]);
    gameActions.setTasks(tasksList.tasks as readonly TaskSummary[]);
    gameActions.setRankingEntries(rankingList.entries as readonly LeaderboardEntrySummary[]);
    gameActions.setNotices(noticeList.notices as readonly NotificationSummary[]);
  }

  async function handlePurchase(itemId: string) {
    const result = await socketClient.request('shop:purchase', { itemId, quantity: 1 });
    gameActions.hydrateFarm(result.farm, game.slots);
    gameActions.setInventoryItems(result.inventory as readonly InventoryEntrySummary[]);
  }

  async function handleTaskClaim(taskId: string) {
    const result = await socketClient.request('tasks:claim', { taskId });
    gameActions.hydrateFarm(result.farm, game.slots);
    gameActions.setTasks(result.tasks as readonly TaskSummary[]);
    await refreshSecondaryData();
  }

  async function handleVisitFriend(userId: string) {
    await socketClient.request('social:visit', { targetUserId: userId });
    await refreshFarm(userId);
    gameActions.setActiveTab('farm');
  }

  async function handleFarmAction(action: FarmOperateAction, slotId: string) {
    const slot = game.slots.find((item) => item.slotId === slotId);
    if (!slot) {
      return;
    }

    const viewingFriendFarm = game.farm.ownerUserId !== session.userId;
    const payload = action === 'plant'
      ? { action, farmId: game.farm.farmId, slotId, itemId: 'seed-corn' as const }
      : action === 'fertilize'
        ? { action, farmId: game.farm.farmId, slotId, itemId: 'water-can' as const }
        : action === 'steal'
          ? { action, farmId: game.farm.farmId, slotId, targetUserId: game.farm.ownerUserId, targetSlotId: slotId, quantity: 1 }
          : action === 'help' || action === 'throwWorms'
            ? { action, farmId: game.farm.farmId, slotId, targetUserId: game.farm.ownerUserId, targetSlotId: slotId }
            : { action, farmId: game.farm.farmId, slotId };

    const result = await socketClient.request('farm:operate', payload as never);
    gameActions.hydrateFarm(result.farm, result.slots);
    gameActions.selectSlot(null);

    if (viewingFriendFarm) {
      await refreshSecondaryData();
      return;
    }

    await refreshSecondaryData();
  }

  return (
    <AppShell
      session={session}
      game={game}
      routes={routes}
      onNavigate={(tabId) => gameActions.setActiveTab(tabId)}
      onPurchase={handlePurchase}
      onTaskClaim={handleTaskClaim}
      onVisitFriend={handleVisitFriend}
      onFarmAction={handleFarmAction}
      onRefreshFarm={() => refreshFarm(game.farm.ownerUserId === session.userId ? undefined : game.farm.ownerUserId)}
    />
  );
}

export function AppShell(props: {
  session: SessionState;
  game: GameState;
  routes: readonly AppRoute[];
  onNavigate(tabId: AppRoute['id']): void;
  onPurchase?: (itemId: string) => Promise<void> | void;
  onTaskClaim?: (taskId: string) => Promise<void> | void;
  onVisitFriend?: (userId: string) => Promise<void> | void;
  onFarmAction?: (action: FarmOperateAction, slotId: string) => Promise<void> | void;
  onRefreshFarm?: () => Promise<void> | void;
}) {
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
          notificationCount={props.game.notices.filter((notice) => !notice.isRead).length}
          onOpenNotifications={() => gameActions.setNotificationsOpen(!props.game.notificationsOpen)}
        />

        {props.game.notificationsOpen ? <NotificationsPanel notices={props.game.notices} /> : null}

        {renderMainPanel(props)}

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

function renderMainPanel(props: {
  game: GameState;
  onPurchase?: (itemId: string) => Promise<void> | void;
  onTaskClaim?: (taskId: string) => Promise<void> | void;
  onVisitFriend?: (userId: string) => Promise<void> | void;
  onFarmAction?: (action: FarmOperateAction, slotId: string) => Promise<void> | void;
  onRefreshFarm?: () => Promise<void> | void;
}) {
  switch (props.game.activeTab) {
    case 'farm':
      return (
        <FarmScreen
          farm={props.game.farm}
          slots={props.game.slots}
          selectedSlotId={props.game.selectedSlotId}
          friends={props.game.friends}
          onSelectSlot={(slotId) => gameActions.selectSlot(slotId)}
          onSelectFriend={(userId) => {
            gameActions.selectFriend(userId);
            void props.onVisitFriend?.(userId);
          }}
          onCloseActionSheet={() => gameActions.selectSlot(null)}
          onAction={(action, slotId) => void props.onFarmAction?.(action, slotId)}
          onRefresh={() => void props.onRefreshFarm?.()}
        />
      );
    case 'shop':
      return <ShopSheet items={props.game.shopItems} onPurchase={(itemId) => void props.onPurchase?.(itemId)} />;
    case 'inventory':
      return <InventorySheet items={props.game.inventoryItems} />;
    case 'friends':
      return <FriendsDrawer friends={props.game.friends} onVisitFriend={(userId) => void props.onVisitFriend?.(userId)} />;
    case 'tasks':
      return <TasksSheet tasks={props.game.tasks} onClaim={(taskId) => void props.onTaskClaim?.(taskId)} />;
    case 'ranking':
      return <RankingSheet entries={props.game.rankingEntries} />;
    default:
      return null;
  }
}
