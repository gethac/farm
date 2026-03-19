import { defineConfig } from 'vite';

const appRoot = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

export default defineConfig({
  root: appRoot,
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: `${appRoot}/dist`,
    emptyOutDir: true,
  },
});
