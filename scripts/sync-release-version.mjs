import fs from 'node:fs/promises';
import path from 'node:path';

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
await updateJson(path.join(root, 'package-lock.json'));
await updateJson(path.join(root, 'frontend', 'package.json'));
await updateJson(path.join(root, 'frontend', 'package-lock.json'));
await updateToml(path.join(root, 'backend', 'Cargo.toml'));
await updateCargoLock(path.join(root, 'backend', 'Cargo.lock'), 'sumurai-backend');
