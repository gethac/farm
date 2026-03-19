import { mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });

await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: 'dist/assets',
  entryNames: 'app',
  assetNames: 'assets/[name]',
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'info',
});

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>QQ经典农场</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`;

await writeFile('dist/index.html', html, 'utf8');
