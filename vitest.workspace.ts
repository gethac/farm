import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'server',
      include: ['apps/server/tests/**/*.test.ts'],
    },
  },
  './apps/web/vitest.config.ts',
]);
