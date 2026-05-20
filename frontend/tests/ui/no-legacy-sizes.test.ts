import fs from 'node:fs';
import path from 'node:path';

function walkFiles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('legacy size guard', () => {
  it('keeps xs button sizes and icon button variants out of app source', () => {
    const sourceRoot = path.resolve(process.cwd(), 'src');
    const offenders = walkFiles(sourceRoot).filter((filePath) => {
      const contents = fs.readFileSync(filePath, 'utf8');
      return /size="xs"|variant="icon"\s+size="icon"/.test(contents);
    });

    expect(offenders).toEqual([]);
  });
});
