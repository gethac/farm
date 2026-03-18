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

declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string | URL, encoding: string): string;
  export function rmSync(path: string, options?: { force?: boolean }): void;
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
