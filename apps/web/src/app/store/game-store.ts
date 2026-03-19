import { useSyncExternalStore } from 'react';
import type { AppTabId } from '../router';

export interface GameState {
  activeTab: AppTabId;
  coins: number;
  experience: number;
  level: number;
}

const defaultState: GameState = {
  activeTab: 'farm',
  coins: 520,
  experience: 188,
  level: 6,
};

let state: GameState = defaultState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGameStoreSnapshot(): GameState {
  return state;
}

export const gameActions = {
  setActiveTab(activeTab: AppTabId) {
    state = { ...state, activeTab };
    emit();
  },
  reset() {
    state = defaultState;
    emit();
  },
};

export function useGameStore(): GameState {
  return useSyncExternalStore(subscribe, useGameStoreSnapshot, useGameStoreSnapshot);
}
