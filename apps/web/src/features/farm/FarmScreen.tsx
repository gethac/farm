import type { FarmOperateAction, FarmSlotSummary, FarmSummary, FriendSummary } from '@qq-classic-farm/protocol';
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
  onAction(action: FarmOperateAction, slotId: string): void;
  onRefresh(): void;
}) {
  const selectedSlot = props.slots.find((slot) => slot.slotId === props.selectedSlotId) ?? null;
  const isFriendFarm = props.farm.ownerUserId !== 'user-me' && props.farm.nickname !== '我的农场';

  return (
    <section className="farm-scene">
      <div className="farm-scene__background" aria-hidden="true">
        <div className="farm-scene__sky" />
        <div className="farm-scene__cloud farm-scene__cloud--left" />
        <div className="farm-scene__cloud farm-scene__cloud--right" />
        <div className="farm-scene__hill" />
        <div className="farm-scene__house" />
      </div>

      <div className="farm-scene__hud-copy">
        <p className="farm-scene__kicker">QQ经典农场</p>
        <h1>{props.farm.nickname}</h1>
        <p>{isFriendFarm ? '好友农场' : '2.5D 农场主界面'}</p>
      </div>

      <div className="farm-scene__side-actions">
        <button type="button" className="farm-scene__side-button" onClick={props.onRefresh}>刷新</button>
        <button type="button" className="farm-scene__side-button">任务</button>
        <button type="button" className="farm-scene__side-button">通知</button>
      </div>

      <FarmFriendStrip friends={props.friends} onSelectFriend={props.onSelectFriend} />

      <div className="farm-scene__plots" aria-label="农场地块">
        {props.slots.map((slot, index) => (
          <FarmSlot
            key={slot.slotId}
            slot={slot}
            slotNumber={index + 1}
            isSelected={slot.slotId === props.selectedSlotId}
            onSelect={props.onSelectSlot}
          />
        ))}
      </div>

      <FarmActionSheet slot={selectedSlot} onAction={props.onAction} onClose={props.onCloseActionSheet} />
    </section>
  );
}
