import type {
  ErrorEnvelope,
  EventEnvelope,
  RequestEnvelope,
  RequestMessageName,
  RequestPayloadMap,
  ResponseEnvelope,
  ResponsePayloadMap,
} from '@qq-classic-farm/protocol';

type SocketListener = (event: EventEnvelope) => void;

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

class SocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<SocketListener>();
  private pending = new Map<string, PendingRequest>();
  private connectionPromise: Promise<void> | null = null;
  private requestCounter = 0;

  connect(token: string): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    if (this.socket && this.connectionPromise) {
      return this.connectionPromise;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${window.location.host}/realtime?token=${encodeURIComponent(token)}`);
    this.connectionPromise = new Promise((resolve, reject) => {
      const activeSocket = this.socket;
      if (!activeSocket) {
        resolve();
        return;
      }

      activeSocket.addEventListener('open', () => resolve(), { once: true });
      activeSocket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), { once: true });
      activeSocket.addEventListener('close', () => {
        if (this.socket === activeSocket) {
          this.socket = null;
          this.connectionPromise = null;
        }
      });
      activeSocket.addEventListener('message', (event) => {
        this.handleMessage(String(event.data));
      });
    });

    return this.connectionPromise;
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.connectionPromise = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error('WebSocket disconnected'));
    }
    this.pending.clear();
  }

  async request<Name extends RequestMessageName>(message: Name, payload: RequestPayloadMap[Name]): Promise<ResponsePayloadMap[Name]> {
    if (!this.socket) {
      throw new Error('WebSocket is not connected');
    }

    await this.connectionPromise;
    const requestId = `req-${Date.now()}-${this.requestCounter += 1}`;
    const envelope: RequestEnvelope<Name> = {
      requestId,
      message,
      payload,
    };

    return new Promise<ResponsePayloadMap[Name]>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.socket?.send(JSON.stringify(envelope));
    });
  }

  subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleMessage(rawMessage: string) {
    try {
      const payload = JSON.parse(rawMessage) as ResponseEnvelope | EventEnvelope | ErrorEnvelope;
      if ('requestId' in payload && payload.requestId && this.pending.has(payload.requestId)) {
        const pending = this.pending.get(payload.requestId)!;
        this.pending.delete(payload.requestId);

        if (payload.message === 'error') {
          pending.reject(new Error(payload.error.message));
          return;
        }

        pending.resolve(payload.payload);
        return;
      }

      if ('message' in payload && 'payload' in payload) {
        this.listeners.forEach((listener) => listener(payload as EventEnvelope));
      }
    } catch {
      // Ignore malformed frames for now.
    }
  }
}

export const socketClient = new SocketClient();
export type { RequestEnvelope, ResponseEnvelope, EventEnvelope };
