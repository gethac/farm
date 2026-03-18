import { createHash } from 'node:crypto';
import type { AuthService } from '../modules/auth/auth-service';
import type { SessionStore } from './session-store';

const websocketAcceptGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface SocketServerApp {
  server: {
    on(event: 'upgrade', listener: (request: { url?: string; headers: Record<string, string | string[] | undefined> }, socket: { write(data: string | Uint8Array): void; end(data?: string): void; destroy(): void; on(event: string, listener: (...args: unknown[]) => void): void }, head: Uint8Array) => void): void;
  };
}

export function registerSocketServer(app: SocketServerApp, authService: AuthService, sessionStore: SessionStore): void {
  app.server.on('upgrade', (request, socket, head) => {
    void head;

    const requestUrl = request.url ?? '/';
    const url = new URL(requestUrl, 'http://localhost');

    if (url.pathname !== '/realtime') {
      writeHttpResponse(socket, 404, 'Not Found');
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    const requestId = url.searchParams.get('requestId') ?? getHeaderValue(request.headers, 'x-request-id') ?? 'unknown-request';

    if (!token) {
      writeHttpResponse(socket, 401, 'Unauthorized');
      socket.destroy();
      return;
    }

    const user = authService.verifyToken(token);
    if (!user) {
      writeHttpResponse(socket, 401, 'Unauthorized');
      socket.destroy();
      return;
    }

    const key = getHeaderValue(request.headers, 'sec-websocket-key');
    if (!key) {
      writeHttpResponse(socket, 400, 'Bad Request');
      socket.destroy();
      return;
    }

    const accept = createHash('sha1').update(`${key}${websocketAcceptGuid}`).digest('base64');
    const session = sessionStore.create({
      userId: user.id,
      displayName: user.displayName,
      requestId,
    });

    sessionStore.attach(socket, session);

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        '',
      ].join('\r\n'),
    );

    socket.on('close', () => {
      sessionStore.deleteBySocket(socket);
    });
  });
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, headerName: string): string | undefined {
  const value = headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function writeHttpResponse(socket: { write(data: string | Uint8Array): void; end(data?: string): void }, statusCode: number, statusText: string): void {
  socket.end(
    [
      `HTTP/1.1 ${statusCode} ${statusText}`,
      'Connection: close',
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n'),
  );
}
