declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare const process: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  exitCode?: number;
};

declare const Buffer: any;

declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string | URL, encoding: string): string;
  export function rmSync(path: string, options?: { force?: boolean; recursive?: boolean }): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): {
      run(bindings?: Record<string, unknown>): unknown;
      all(bindings?: Record<string, unknown>): unknown[];
    };
  }
}

declare module 'fastify' {
  export interface FastifyLikeApp {
    get(path: string, handler: () => Promise<unknown>): void;
    listen(options: { host: string; port: number }): Promise<void>;
  }

  export default function Fastify(options: { logger?: boolean }): FastifyLikeApp;
}

declare module 'node:crypto' {
  export function randomBytes(size: number): { toString(encoding: string): string };
  export function randomUUID(): string;
  export function pbkdf2Sync(password: string, salt: string, iterations: number, keylen: number, digest: string): { toString(encoding: string): string };
  export function createHash(algorithm: string): { update(data: string): { digest(encoding: string): string } };
  export function createHmac(algorithm: string, key: string): { update(data: string): { digest(encoding: string): string } };
}

declare module 'node:net' {
  export class Socket {
    on(event: string, listener: (...args: unknown[]) => void): Socket;
    write(data: string | Uint8Array): void;
    end(data?: string): void;
    destroy(): void;
  }

  export function createConnection(options: { host: string; port: number }): Socket;
}

