import type { FarmSlotSummary, FarmSummary, FriendSummary } from '@qq-classic-farm/protocol';
import { FarmActionSheet } from './FarmActionSheet';
import { FarmFriendStrip } from './FarmFriendStrip';
import { FarmSlot } from './FarmSlot';

export function FarmScreen(props: {
  farm: FarmSummary;
  slots: readonly FarmSlotSummary[];
  selectedSlotId: string | null;
  friends: readonly FriendSummary[];
  onSelectSlot(slotId: string): void;
  onSelectFriend(userId: string): void;
  onCloseActionSheet(): void;
}) {
  const selectedSlot = props.slots.find((slot) => slot.slotId === props.selectedSlotId) ?? null;

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">QQ经典农场</p>
          <h1>{props.farm.nickname}</h1>
          <p>经典天空、远景、地块和好友条已经接入移动端布局，可继续叠加真实数据。</p>
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

      <FarmFriendStrip friends={props.friends} onSelectFriend={props.onSelectFriend} />

      <section className="content-panel" aria-label="农场地块">
        <div className="content-header">
          <strong>{props.farm.nickname}</strong>
          <span>点击地块后弹出快捷操作面板</span>
        </div>
        <div className="farm-slot-grid">
          {props.slots.map((slot) => (
            <FarmSlot
              key={slot.slotId}
              slot={slot}
              isSelected={slot.slotId === props.selectedSlotId}
              onSelect={props.onSelectSlot}
            />
          ))}
        </div>
      </section>

      <FarmActionSheet slot={selectedSlot} onClose={props.onCloseActionSheet} />
    </>
  );
}
