import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const [workspaceDir, scriptName, ...rest] = process.argv.slice(2);
const separatorIndex = rest.indexOf('--');
const scriptArgs = separatorIndex >= 0 ? rest.slice(separatorIndex + 1) : rest;

if (!workspaceDir || !scriptName) {
  console.error('run-workspace-script requires <workspaceDir> <scriptName>');
  process.exit(1);
}

const manifestPath = resolve(repoRoot, workspaceDir, 'package.json');
if (!existsSync(manifestPath)) {
  console.log(`${workspaceDir} is not created yet`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', scriptName, '--', ...scriptArgs], {
  cwd: resolve(repoRoot, workspaceDir),
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
