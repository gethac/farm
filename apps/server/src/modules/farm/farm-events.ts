import type { EventMessageName, FarmOperateAction } from '@qq-classic-farm/protocol';

export function buildAffectedEventNames(action: FarmOperateAction): readonly EventMessageName[] {
  switch (action) {
    case 'plant':
      return ['farm:slotUpdated', 'inventory:list', 'task:updated'];
    case 'water':
    case 'removeGrass':
    case 'removeWorms':
    case 'fertilize':
      return ['farm:slotUpdated'];
    case 'harvest':
      return ['farm:slotUpdated', 'inventory:list', 'task:updated', 'notice:new'];
    case 'clearDeadCrop':
      return ['farm:slotUpdated'];
    case 'steal':
      return ['farm:slotUpdated', 'inventory:list', 'task:updated', 'notice:new'];
    case 'help':
      return ['farm:slotUpdated', 'notice:new'];
    case 'throwWorms':
      return ['farm:slotUpdated', 'notice:new'];
    default:
      return ['farm:slotUpdated'];
  }
}
