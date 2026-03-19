import type { ShopItemSummary } from '@qq-classic-farm/protocol';

export function ShopSheet(props: { items: readonly ShopItemSummary[] }) {
  return (
    <section className="content-panel" aria-label="商店">
      <div className="content-header">
        <strong>种子商店</strong>
        <span>购买种子和基础道具</span>
      </div>
      <div className="list-panel">
        {props.items.map((item) => (
          <article key={item.itemId} className="list-card">
            <strong>{item.name}</strong>
            <span>{item.category}</span>
            <em>{item.price} 金币</em>
          </article>
        ))}
      </div>
    </section>
  );
}
