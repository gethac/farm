export type AppTabId = 'farm' | 'shop' | 'inventory' | 'tasks' | 'friends' | 'ranking';

export interface AppRoute {
  id: AppTabId;
  label: string;
  icon: string;
  description: string;
}

export function createAppRoutes(): readonly AppRoute[] {
  return [
    { id: 'farm', label: '农场', icon: '田', description: '经典天空、远景和地块区域作为首页主视图。' },
    { id: 'shop', label: '商店', icon: '店', description: '种子、道具和后续购买动作从这里进入。' },
    { id: 'inventory', label: '仓库', icon: '仓', description: '展示种子、道具和农产品库存。' },
    { id: 'tasks', label: '任务', icon: '卷', description: '新手任务、日常任务和成就入口。' },
    { id: 'friends', label: '好友', icon: '友', description: '查看好友、访问农场和互动记录。' },
    { id: 'ranking', label: '排行', icon: '榜', description: '查看金币榜、等级榜等排行榜快照。' },
  ];
}
