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

await updateJson(path.join(root, 'package.json'));
await updateJson(path.join(root, 'package-lock.json'));
await updateJson(path.join(root, 'frontend', 'package.json'));
await updateJson(path.join(root, 'frontend', 'package-lock.json'));
