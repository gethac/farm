import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';

describe('server env', () => {
  it('does not use a known hard-coded auth secret by default', () => {
    const env = loadEnv({});

    expect(env.authSecret).toBeTruthy();
    expect(env.authSecret).not.toBe('dev-auth-secret');
  });
});
