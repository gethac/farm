import type { ShopItemSummary } from '@qq-classic-farm/protocol';

const shopLabels: Record<string, string> = {
  'seed-corn': '玉米种子',
  'seed-rice': '水稻种子',
  'water-can': '水壶',
};

const categoryLabels: Record<ShopItemSummary['category'], string> = {
  seed: '种子',
  tool: '工具',
  consumable: '消耗品',
};

export function ShopSheet(props: { items: readonly ShopItemSummary[]; onPurchase(itemId: string): void }) {
  return (
    <section className="content-panel" aria-label="商店">
      <div className="content-header">
        <strong>种子商店</strong>
        <span>购买种子和基础道具</span>
      </div>
      <div className="list-panel">
        {props.items.map((item) => {
          const label = shopLabels[item.itemId] ?? item.name;
          return (
            <article key={item.itemId} className="list-card">
              <strong>{label}</strong>
              <span>{categoryLabels[item.category] ?? item.category}</span>
              <em>{item.price} 金币</em>
              <button type="button" className="list-card__action" onClick={() => props.onPurchase(item.itemId)}>
                {`购买 ${label}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
