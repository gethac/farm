import type { FarmOperateAction, FarmSlotSummary } from '@qq-classic-farm/protocol';

const actionLabels: Record<FarmOperateAction, string> = {
  plant: '播种',
  water: '浇水',
  removeGrass: '除草',
  removeWorms: '除虫',
  fertilize: '施肥',
  harvest: '收获',
  clearDeadCrop: '铲除',
  steal: '偷菜',
  help: '帮忙',
  throwWorms: '放虫',
};

export function FarmActionSheet(props: {
  slot: FarmSlotSummary | null;
  onAction(action: FarmOperateAction, slotId: string): void;
  onClose(): void;
}) {
  if (!props.slot) {
    return null;
  }

  return (
    <aside className="farm-action-sheet" aria-label="地块操作">
      <div className="farm-action-sheet__header">
        <strong>地块操作</strong>
        <button type="button" onClick={props.onClose}>关闭</button>
      </div>
      <div className="farm-plot-bubble">
        {props.slot.availableActions.map((action) => (
          <button
            key={action}
            type="button"
            className="farm-plot-bubble__button"
            onClick={() => props.onAction(action, props.slot!.slotId)}
          >
            {actionLabels[action]}
          </button>
        ))}
      </div>
      <div className="farm-action-sheet__actions">
        {props.slot.availableActions.map((action) => (
          <button
            key={`${action}-sheet`}
            type="button"
            className="farm-action-sheet__button"
            onClick={() => props.onAction(action, props.slot!.slotId)}
          >
            {actionLabels[action]}
          </button>
        ))}
      </div>
    </aside>
  );
}
