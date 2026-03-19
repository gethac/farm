import { createHash } from 'node:crypto';
import type { ErrorEnvelope, RequestEnvelope } from '@qq-classic-farm/protocol';
import type { AuthService } from '../modules/auth/auth-service';
import type { RealtimeRouter } from './router';
import type { SessionStore } from './session-store';

const websocketAcceptGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
type BinaryBuffer = ReturnType<typeof Buffer.alloc>;

interface UpgradeSocket {
  write(data: string | Uint8Array): void;
  end(data?: string): void;
  destroy(): void;
  on(event: 'data' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

export interface SocketServerApp {
  server: {
    on(
      event: 'upgrade',
      listener: (
        request: { url?: string; headers: Record<string, string | string[] | undefined> },
        socket: UpgradeSocket,
        head: Uint8Array,
      ) => void,
    ): void;
  };
}

export function registerSocketServer(
  app: SocketServerApp,
  authService: AuthService,
  sessionStore: SessionStore,
  realtimeRouter: RealtimeRouter,
): void {
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
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'));

    let receiveBuffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      receiveBuffer = Buffer.concat([receiveBuffer, Buffer.from(chunk as Uint8Array)]);

      while (true) {
        const frame = tryReadFrame(receiveBuffer);
        if (!frame) {
          return;
        }

        receiveBuffer = frame.remaining;
        if (frame.opcode === 0x8) {
          socket.end();
          return;
        }

        if (frame.opcode !== 0x1) {
          continue;
        }

        try {
          const message = JSON.parse(frame.payload.toString('utf8')) as RequestEnvelope;
          const activeSession = sessionStore.getBySocket(socket);
          if (!activeSession) {
            socket.end();
            return;
          }

          const response = realtimeRouter.handle(activeSession, message);
          socket.write(encodeTextFrame(JSON.stringify(response)));
        } catch (error) {
          const fallbackResponse: ErrorEnvelope = {
            message: 'error',
            requestId: 'unknown-request',
            error: {
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : 'Malformed realtime payload',
              requestId: 'unknown-request',
            },
          };
          socket.write(encodeTextFrame(JSON.stringify(fallbackResponse)));
        }
      }
    });

    socket.on('close', () => {
      sessionStore.deleteBySocket(socket);
    });

    socket.on('error', () => {
      sessionStore.deleteBySocket(socket);
    });
  });
}

function tryReadFrame(buffer: BinaryBuffer): { opcode: number; payload: BinaryBuffer; remaining: BinaryBuffer } | null {
  if (buffer.length < 2) {
    return null;
  }

  const firstByte = buffer[0]!;
  const secondByte = buffer[1]!;
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    return null;
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + payloadLength) {
    return null;
  }

  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  offset += maskLength;
  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));

  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] = payload[index]! ^ mask[index % 4]!;
    }
  }

  return {
    opcode,
    payload,
    remaining: buffer.subarray(offset + payloadLength),
  };
}

function encodeTextFrame(payload: string): BinaryBuffer {
  const payloadBuffer = Buffer.from(payload, 'utf8');
  if (payloadBuffer.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payloadBuffer.length]), payloadBuffer]);
  }

  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payloadBuffer.length, 2);
  return Buffer.concat([header, payloadBuffer]);
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, headerName: string): string | undefined {
  const value = headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function writeHttpResponse(socket: { write(data: string | Uint8Array): void; end(data?: string): void }, statusCode: number, statusText: string): void {
  socket.end([
    `HTTP/1.1 ${statusCode} ${statusText}`,
    'Connection: close',
    'Content-Length: 0',
    '',
    '',
  ].join('\r\n'));
}
