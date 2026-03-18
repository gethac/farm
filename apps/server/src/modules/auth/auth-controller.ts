import type { AuthService } from './auth-service';

export interface AuthControllerApp {
  post(path: string, handler: (request: { body?: unknown }, reply: { code(statusCode: number): { send(payload: unknown): unknown } }) => Promise<unknown> | unknown): void;
}

export function registerAuthController(app: AuthControllerApp, authService: AuthService): void {
  app.post('/auth/register', async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { displayName?: string; password?: string };
      const result = authService.register({
        displayName: body.displayName ?? '',
        password: body.password ?? '',
      });

      return reply.code(200).send(result);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post('/auth/login', async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { displayName?: string; password?: string };
      const result = authService.login({
        displayName: body.displayName ?? '',
        password: body.password ?? '',
      });

      return reply.code(200).send(result);
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });
}

function sendAuthError(reply: { code(statusCode: number): { send(payload: unknown): unknown } }, error: unknown) {
  if (isAuthError(error)) {
    return reply.code(error.statusCode).send({ error: error.message });
  }

  return reply.code(500).send({ error: 'Internal Server Error' });
}

function isAuthError(error: unknown): error is { statusCode: number; message: string } {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'message' in error;
}
