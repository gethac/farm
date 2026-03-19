import { describe, expect, it } from 'vitest';
import net from 'node:net';
import crypto from 'node:crypto';
import { createTestApp } from '../../src/lib/test-app';

function performUpgrade(port: number, path: string): Promise<{ headers: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const key = crypto.randomBytes(16).toString('base64');
    let buffer = '';
    const timeout = setTimeout(() => {
      reject(new Error(`upgrade timeout for ${path}: ${buffer.slice(0, 200)}`));
      socket.destroy();
    }, 2000);

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.on('connect', () => {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          'Host: 127.0.0.1',
          'Connection: Upgrade',
          'Upgrade: websocket',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'),
      );
    });

    socket.on('data', (chunk) => {
      buffer += String(chunk);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headers = buffer.slice(0, headerEnd);
      clearTimeout(timeout);
      socket.end();
      resolve({ headers });
    });
  });
}

describe('socket auth', () => {
  it('rejects missing tokens and accepts authenticated sessions with request ids', async () => {
    const { app, port, close } = await createTestApp({ listen: true });

    try {
      const missingToken = await performUpgrade(port, '/realtime?requestId=missing-token-test');
      expect(missingToken.headers).toContain('401');

      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          displayName: 'Grace Hopper',
          password: 'secret123',
        },
      });

      const registerBody = registerResponse.json() as { token: string; user: { id: string } };

      const authenticated = await performUpgrade(
        port,
        `/realtime?token=${encodeURIComponent(registerBody.token)}&requestId=session-test-1`,
      );

      expect(authenticated.headers).toContain('101 Switching Protocols');

      const session = app.sessionStore.findByUserId(registerBody.user.id);
      expect(session).toBeDefined();
      expect(session?.requestId).toBe('session-test-1');
      expect(session?.userId).toBe(registerBody.user.id);
    } finally {
      await close();
    }
  });
});
