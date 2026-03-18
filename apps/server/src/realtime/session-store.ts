import { randomUUID } from 'node:crypto';

export interface SocketSession {
  sessionId: string;
  userId: string;
  displayName: string;
  requestId: string;
  socket?: { destroy(): void };
}

export class SessionStore {
  private readonly sessionsById = new Map<string, SocketSession>();
  private readonly sessionIdBySocket = new WeakMap<object, string>();

  create(session: Omit<SocketSession, 'sessionId'>): SocketSession {
    const created = {
      ...session,
      sessionId: randomUUID(),
    };

    this.sessionsById.set(created.sessionId, created);
    return created;
  }

  attach(socket: object, session: SocketSession): void {
    const stored = {
      ...session,
      socket: socket as { destroy(): void },
    };

    this.sessionsById.set(session.sessionId, stored);
    this.sessionIdBySocket.set(socket, session.sessionId);
  }

  get(sessionId: string): SocketSession | undefined {
    return this.sessionsById.get(sessionId);
  }

  getBySocket(socket: object): SocketSession | undefined {
    const sessionId = this.sessionIdBySocket.get(socket);
    return sessionId ? this.sessionsById.get(sessionId) : undefined;
  }

  findByUserId(userId: string): SocketSession | undefined {
    for (const session of this.sessionsById.values()) {
      if (session.userId === userId) {
        return session;
      }
    }

    return undefined;
  }

  deleteBySocket(socket: object): void {
    const sessionId = this.sessionIdBySocket.get(socket);
    if (!sessionId) {
      return;
    }

    this.sessionIdBySocket.delete(socket);
    this.sessionsById.delete(sessionId);
  }

  values(): SocketSession[] {
    return Array.from(this.sessionsById.values());
  }
}

export function createSessionStore(): SessionStore {
  return new SessionStore();
}
