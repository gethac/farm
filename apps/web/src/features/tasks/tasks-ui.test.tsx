import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AppShell } from '../../app/App';
import { createAppRoutes } from '../../app/router';
import { createInitialGameState, reduceRealtimeEvent } from '../../app/store/game-store';
import type { EventEnvelope } from '@qq-classic-farm/protocol';

const session = {
  token: 'token-1',
  userId: 'user-1',
  displayName: '农场主',
};

const taskUpdatedEvent: EventEnvelope<'task:updated'> = {
  message: 'task:updated',
  payload: {
    taskId: 'new-player-plant-first-crop',
    progress: 1,
    target: 1,
  },
};

const noticeEvent: EventEnvelope<'notice:new'> = {
  message: 'notice:new',
  payload: {
    noticeId: 'notice-2',
    kind: 'task',
    message: '任务奖励可以领取了',
  },
};

describe('tasks and utility panels', () => {
  test('opens tasks ranking and notifications panels and refreshes after realtime events', () => {
    const baseState = createInitialGameState();

    const tasksHtml = renderToStaticMarkup(
      <AppShell session={session} game={{ ...baseState, activeTab: 'tasks' }} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(tasksHtml).toContain('任务清单');
    expect(tasksHtml).toContain('新手种下第一株作物');

    const rankingHtml = renderToStaticMarkup(
      <AppShell session={session} game={{ ...baseState, activeTab: 'ranking' }} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(rankingHtml).toContain('金币排行榜');
    expect(rankingHtml).toContain('第 1 名');

    const withTaskUpdate = reduceRealtimeEvent({ ...baseState, activeTab: 'tasks' }, taskUpdatedEvent);
    const updatedTasksHtml = renderToStaticMarkup(
      <AppShell session={session} game={withTaskUpdate} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(updatedTasksHtml).toContain('1 / 1');

    const withNoticeUpdate = reduceRealtimeEvent({ ...baseState, notificationsOpen: true }, noticeEvent);
    const noticesHtml = renderToStaticMarkup(
      <AppShell session={session} game={withNoticeUpdate} routes={createAppRoutes()} onNavigate={() => undefined} />,
    );
    expect(noticesHtml).toContain('最新提醒');
    expect(noticesHtml).toContain('任务奖励可以领取了');
  });
});
