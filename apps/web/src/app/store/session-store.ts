import { useSyncExternalStore } from 'react';

export interface SessionState {
  token: string | null;
  userId: string | null;
  displayName: string | null;
}

const defaultState: SessionState = {
  token: null,
  userId: null,
  displayName: null,
};

let state: SessionState = defaultState;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionStoreSnapshot(): SessionState {
  return state;
}

export const sessionActions = {
  setSession(next: SessionState) {
    state = next;
    emit();
  },
  clear() {
    state = defaultState;
    emit();
  },
};

export function useSessionStore(): SessionState {
  return useSyncExternalStore(subscribe, useSessionStoreSnapshot, useSessionStoreSnapshot);
}
