import type { InventoryEntrySummary } from '@qq-classic-farm/protocol';

const inventoryLabels: Record<string, string> = {
  rice: '小麦',
  corn: '玉米',
  'seed-corn': '玉米种子',
  'seed-rice': '水稻种子',
  'water-can': '水壶',
};

export function InventorySheet(props: { items: readonly InventoryEntrySummary[] }) {
  return (
    <section className="content-panel" aria-label="仓库">
      <div className="content-header">
        <strong>仓库背包</strong>
        <span>查看种子、道具和农产品数量</span>
      </div>
      <div className="list-panel">
        {props.items.map((item) => (
          <article key={item.itemId} className="list-card">
            <strong>{inventoryLabels[item.itemId] ?? item.itemId}</strong>
            <span>库存</span>
            <em>{item.quantity}</em>
          </article>
        ))}
      </div>
    </section>
  );
}
