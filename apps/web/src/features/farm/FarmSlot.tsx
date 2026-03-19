import type { FarmSlotSummary } from '@qq-classic-farm/protocol';

const cropLabels: Record<string, string> = {
  rice: '小麦',
  corn: '玉米',
};

const statusLabels: Record<FarmSlotSummary['status'], string> = {
  empty: '空地',
  growing: '生长中',
  mature: '可收获',
  withered: '已枯萎',
};

export function FarmSlot(props: {
  slot: FarmSlotSummary;
  slotNumber: number;
  isSelected: boolean;
  onSelect(slotId: string): void;
}) {
  const cropLabel = props.slot.cropId ? cropLabels[props.slot.cropId] ?? props.slot.cropId : '未种植';
  const className = [
    'farm-slot-card',
    `farm-slot-card--${props.slot.locked ? 'locked' : props.slot.status}`,
    props.isSelected ? 'farm-slot-card--selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      aria-label={`地块 ${props.slotNumber}`}
      className={className}
      onClick={() => props.onSelect(props.slot.slotId)}
    >
      <strong>{props.slot.locked ? '未解锁' : cropLabel}</strong>
      <span>{props.slot.locked ? '敬请期待' : statusLabels[props.slot.status]}</span>
      <em>健康 {props.slot.health}%</em>
    </button>
  );
}
