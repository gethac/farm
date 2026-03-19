import { afterEach, describe, expect, test } from 'vitest';
import crypto from 'node:crypto';
import net from 'node:net';
import type { RequestEnvelope, ResponseEnvelope } from '@qq-classic-farm/protocol';
import { createTestApp, type TestApp } from '../../src/lib/test-app';

type BinaryBuffer = ReturnType<typeof Buffer.alloc>;

function encodeClientTextFrame(payload: string): BinaryBuffer {
  const payloadBuffer = Buffer.from(payload, 'utf8');
  const mask = Buffer.from(crypto.randomBytes(4));
  const header = payloadBuffer.length < 126 ? Buffer.alloc(2) : Buffer.alloc(4);
  header[0] = 0x81;
  if (payloadBuffer.length < 126) {
    header[1] = 0x80 | payloadBuffer.length;
  } else {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payloadBuffer.length, 2);
  }

  const maskedPayload = Buffer.from(payloadBuffer);
  for (let index = 0; index < maskedPayload.length; index += 1) {
    maskedPayload[index] = maskedPayload[index]! ^ mask[index % 4]!;
  }

  return Buffer.concat([header, mask, maskedPayload]);
}

function tryDecodeServerTextFrame(buffer: BinaryBuffer): { payload: string; remaining: BinaryBuffer } | null {
  if (buffer.length < 2) {
    return null;
  }

  let payloadLength = buffer[1]! & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  }

  if (buffer.length < offset + payloadLength) {
    return null;
  }

  return {
    payload: buffer.subarray(offset, offset + payloadLength).toString('utf8'),
    remaining: buffer.subarray(offset + payloadLength),
  };
}

async function connectAndRequest<TMessage extends RequestEnvelope['message']>(
  port: number,
  token: string,
  request: RequestEnvelope<TMessage>,
): Promise<ResponseEnvelope<TMessage>> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const key = crypto.randomBytes(16).toString('base64');
    let upgraded = false;
    let rawBuffer = Buffer.alloc(0);

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('socket response timeout'));
    }, 4000);

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on('connect', () => {
      socket.write([
        `GET /realtime?token=${encodeURIComponent(token)}&requestId=realtime-test HTTP/1.1`,
        'Host: 127.0.0.1',
        'Connection: Upgrade',
        'Upgrade: websocket',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'));
    });

    socket.on('data', (chunk) => {
      rawBuffer = Buffer.concat([rawBuffer, Buffer.from(chunk as Uint8Array)]);
      if (!upgraded) {
        const headerEnd = rawBuffer.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd === -1) {
          return;
        }

        const headers = rawBuffer.subarray(0, headerEnd).toString('utf8');
        if (!headers.includes('101 Switching Protocols')) {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error(`upgrade failed: ${headers}`));
          return;
        }

        upgraded = true;
        rawBuffer = rawBuffer.subarray(headerEnd + 4);
        socket.write(encodeClientTextFrame(JSON.stringify(request)));
      }

      if (upgraded) {
        const frame = tryDecodeServerTextFrame(rawBuffer);
        if (!frame) {
          return;
        }

        clearTimeout(timeout);
        socket.end();
        resolve(JSON.parse(frame.payload) as ResponseEnvelope<TMessage>);
      }
    });
  });
}

describe('realtime request handling', () => {
  let fixture: TestApp | null = null;

  afterEach(async () => {
    await fixture?.close();
    fixture = null;
  });

  test('responds to farm:getMine over websocket after authentication', async () => {
    fixture = await createTestApp({ listen: true, bootstrapPlayerState: true });
    const registerResponse = await fixture.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        displayName: '实时农友',
        password: 'pw123456',
      },
    });

    const registerBody = registerResponse.json() as { token: string };
    const response = await connectAndRequest(fixture.port, registerBody.token, {
      requestId: 'farm-mine-1',
      message: 'farm:getMine',
      payload: {},
    });

    expect(response.requestId).toBe('farm-mine-1');
    expect(response.message).toBe('farm:getMine');
    expect(response.payload.farm.ownerUserId).toBeDefined();
    expect(response.payload.slots.length).toBeGreaterThan(0);
  });
});

