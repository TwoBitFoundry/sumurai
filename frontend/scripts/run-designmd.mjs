import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const originalArgs = process.argv.slice(2);
const args =
  originalArgs[0] === 'export' &&
  originalArgs[1] === '--format' &&
  originalArgs[2] === 'css-tailwind'
    ? ['export', '--format', 'tailwind', ...originalArgs.slice(3)]
    : originalArgs;

const pathResult = spawnSync('designmd', args, { stdio: 'inherit' });

if (pathResult.error?.code !== 'ENOENT') {
  process.exit(pathResult.status ?? 1);
}

const npmEnv = { ...process.env };
delete npmEnv.npm_config_prefix;
delete npmEnv.npm_config_global_prefix;
delete npmEnv.npm_config_globalconfig;
delete npmEnv.npm_config_local_prefix;

const npmRootResult = spawnSync('npm', ['config', 'get', 'prefix', '--location=global'], {
  encoding: 'utf8',
  env: npmEnv,
});

if (npmRootResult.status !== 0) {
  process.stderr.write(npmRootResult.stderr || 'Unable to resolve global npm root.\n');
  process.exit(npmRootResult.status ?? 1);
}

const npmPrefix = npmRootResult.stdout.trim();
const npmExecRoot = process.env.npm_execpath
  ? resolve(dirname(process.env.npm_execpath), '..', '..')
  : '';
const roots = [
  join(npmPrefix, 'lib', 'node_modules'),
  process.env.HOMEBREW_PREFIX ? join(process.env.HOMEBREW_PREFIX, 'lib', 'node_modules') : '',
  npmExecRoot,
].filter(Boolean);
const cliPath = roots
  .map((root) => join(root, '@google', 'design.md', 'dist', 'index.js'))
  .find((candidate) => existsSync(candidate));

if (!cliPath) {
  process.stderr.write('Unable to find global design.md CLI.\n');
  process.exit(1);
}

const nodeResult = spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit' });
process.exit(nodeResult.status ?? 1);
