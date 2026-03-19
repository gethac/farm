import type { EventEnvelope, RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';

type SocketListener = (event: EventEnvelope) => void;

class SocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<SocketListener>();

  connect(token: string) {
    if (typeof window === 'undefined' || this.socket) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as EventEnvelope;
        this.listeners.forEach((listener) => listener(payload));
      } catch {
        // Ignore malformed frames for now.
      }
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  send(request: RequestEnvelope) {
    this.socket?.send(JSON.stringify(request));
  }

  subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const socketClient = new SocketClient();
export type { RequestEnvelope, ResponseEnvelope, EventEnvelope };
