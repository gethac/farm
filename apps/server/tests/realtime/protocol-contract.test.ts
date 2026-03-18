import { describe, expect, it } from 'vitest';
import { events, requests } from '../../../../packages/protocol/src';

const requiredMessageNames = [
  'farm:getMine',
  'farm:getUser',
  'farm:operate',
  'shop:list',
  'inventory:list',
  'friends:list',
  'tasks:list',
  'ranking:list',
] as const;

describe('shared realtime protocol contract', () => {
  it('exposes the required request message names', () => {
    for (const messageName of requiredMessageNames) {
      expect(requests).toHaveProperty(messageName);
    }
  });

  it('exposes the required event message names', () => {
    for (const messageName of requiredMessageNames) {
      expect(events).toHaveProperty(messageName);
    }
  });
});
