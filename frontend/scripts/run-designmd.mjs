import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const originalArgs = process.argv.slice(2);
const quiet = originalArgs[0] === '--quiet';
const commandArgs = quiet ? originalArgs.slice(1) : originalArgs;
const args =
  commandArgs[0] === 'export' &&
  commandArgs[1] === '--format' &&
  commandArgs[2] === 'css-tailwind'
    ? ['export', '--format', 'tailwind', ...commandArgs.slice(3)]
    : commandArgs;

const stdio = quiet ? 'pipe' : 'inherit';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const localCliPath = join(scriptDir, '..', 'node_modules', '@google', 'design.md', 'dist', 'index.js');

function exitFromResult(result) {
  if (quiet && result.status !== 0) {
    process.stdout.write(result.stdout?.toString() ?? '');
    process.stderr.write(result.stderr?.toString() ?? '');
  }
  process.exit(result.status ?? 1);
}

if (existsSync(localCliPath)) {
  const nodeResult = spawnSync(process.execPath, [localCliPath, ...args], { stdio });
  exitFromResult(nodeResult);
}

const pathResult = spawnSync('designmd', args, { stdio });

if (pathResult.error?.code !== 'ENOENT') {
  exitFromResult(pathResult);
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

const nodeResult = spawnSync(process.execPath, [cliPath, ...args], { stdio });
exitFromResult(nodeResult);
