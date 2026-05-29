import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const version = process.argv[2];

if (!version) {
  throw new Error('Missing release version');
}

async function updateJson(filePath) {
  const contents = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(contents);
  data.version = version;
  if (data.packages && data.packages['']) {
    data.packages[''].version = version;
  }
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateToml(filePath) {
  let contents = await fs.readFile(filePath, 'utf8');
  contents = contents.replace(/^version = ".*"$/m, `version = "${version}"`);
  await fs.writeFile(filePath, contents);
}

async function updateCargoLock(filePath, packageName) {
  let contents = await fs.readFile(filePath, 'utf8');
  contents = contents.replace(
    new RegExp(`(name = "${packageName}"\\nversion = )"[^"]*"`),
    `$1"${version}"`
  );
  await fs.writeFile(filePath, contents);
}

await updateJson(path.join(root, 'package.json'));
await updateJson(path.join(root, 'frontend', 'package.json'));
await updateToml(path.join(root, 'backend', 'Cargo.toml'));
await updateCargoLock(path.join(root, 'Cargo.lock'), 'sumurai-backend');
await exec('bun', ['install', '--lockfile-only'], { cwd: root });
await exec('bun', ['install', '--lockfile-only'], { cwd: path.join(root, 'frontend') });
