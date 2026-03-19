import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const args = process.argv.slice(2);
let requestedCwd = '.';
let separatorIndex = args.indexOf('--');

if (args[0] === '--cwd') {
  requestedCwd = args[1] ?? '.';
  separatorIndex = args.indexOf('--', 2);
}

const commandArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args;
const command = commandArgs.join(' ').trim();

if (!command) {
  console.error('windows-ascii-runner requires a command');
  process.exit(1);
}

const targetCwd = resolve(repoRoot, requestedCwd);

if (process.platform !== 'win32' || process.env.ASCII_DRIVE_MAPPED === '1') {
  process.exit(run(command, targetCwd));
}

const drive = acquireDrive(repoRoot);
if (!drive) {
  process.exit(run(command, targetCwd));
}

try {
  const mappedCwd = `${drive}:\\${toWindowsRelative(targetCwd)}`;
  process.exit(run(command, mappedCwd, { ASCII_DRIVE_MAPPED: '1' }));
} finally {
  spawnSync('cmd', ['/d', '/s', '/c', `subst ${drive}: /D`], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

function acquireDrive(rootPath) {
  for (const drive of ['X', 'Y', 'Z', 'W', 'V', 'U']) {
    const result = spawnSync('cmd', ['/d', '/s', '/c', `subst ${drive}: "${rootPath}"`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    if (result.status === 0) {
      return drive;
    }
  }

  return null;
}

function run(commandText, cwd, extraEnv = {}) {
  const result = spawnSync('cmd', ['/d', '/s', '/c', commandText], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  return result.status ?? 1;
}

function toWindowsRelative(targetPath) {
  const relativePath = relative(repoRoot, targetPath);
  if (!relativePath) {
    return '';
  }

  return relativePath.replaceAll('/', '\\');
}
