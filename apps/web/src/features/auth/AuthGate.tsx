import { startTransition, useEffect, useState } from 'react';
import { sessionActions, useSessionStore, type SessionState } from '../../app/store/session-store';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';

const SESSION_STORAGE_KEY = 'qq-classic-farm:session';

type AuthMode = 'login' | 'register';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    displayName: string;
  };
  error?: string;
}

interface AuthCredentials {
  displayName: string;
  password: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface AuthDependencies {
  fetch?: (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
    ok: boolean;
    json(): Promise<AuthResponse>;
  }>;
  storage?: StorageLike | null;
}

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

export async function completeAuth(mode: AuthMode, credentials: AuthCredentials, dependencies: AuthDependencies = {}): Promise<SessionState> {
  const fetchImpl = dependencies.fetch ?? getBrowserFetch();
  if (!fetchImpl) {
    throw new Error('Fetch API unavailable');
  }

  const response = await fetchImpl(`/auth/${mode}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? '认证失败');
  }

  const nextSession: SessionState = {
    token: result.token,
    userId: result.user.id,
    displayName: result.user.displayName,
  };

  writePersistedSession(dependencies.storage ?? getBrowserStorage(), nextSession);
  startTransition(() => {
    sessionActions.setSession(nextSession);
  });
  return nextSession;
}

export function hydratePersistedSession(storage: StorageLike | null = getBrowserStorage()): SessionState | null {
  const nextSession = readPersistedSession(storage);
  if (!nextSession) {
    return null;
  }

  startTransition(() => {
    sessionActions.setSession(nextSession);
  });
  return nextSession;
}

export function clearPersistedSession(storage: StorageLike | null = getBrowserStorage()) {
  storage?.removeItem(SESSION_STORAGE_KEY);
  startTransition(() => {
    sessionActions.clear();
  });
}

export function AuthGate() {
  const session = useSessionStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session.token) {
      hydratePersistedSession();
    }
  }, [session.token]);

  async function handleSubmit(event?: { preventDefault(): void }) {
    event?.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await completeAuth(mode, { displayName, password });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '认证失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  const screenProps = {
    displayName,
    password,
    errorMessage,
    isSubmitting,
    onDisplayNameChange: setDisplayName,
    onPasswordChange: setPassword,
    onSubmit: handleSubmit,
  };

  return mode === 'login'
    ? (
      <LoginScreen
        {...screenProps}
        onSwitchMode={() => setMode('register')}
      />
    )
    : (
      <RegisterScreen
        {...screenProps}
        onSwitchMode={() => setMode('login')}
      />
    );
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function getBrowserFetch() {
  if (typeof fetch !== 'function') {
    return null;
  }

  return (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => fetch(input, init as RequestInit);
}

function writePersistedSession(storage: StorageLike | null, session: SessionState) {
  storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readPersistedSession(storage: StorageLike | null): SessionState | null {
  const rawValue = storage?.getItem(SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SessionState>;
    if (typeof parsed.token !== 'string' || typeof parsed.userId !== 'string' || typeof parsed.displayName !== 'string') {
      return null;
    }

    return {
      token: parsed.token,
      userId: parsed.userId,
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}
