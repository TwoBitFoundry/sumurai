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

describe('ui primitive consolidation', () => {
  it('keeps legacy token paths out of app source', () => {
    const sourceRoot = path.resolve(process.cwd(), 'src');
    const offenders = walkFiles(sourceRoot).filter((filePath) => {
      const contents = fs.readFileSync(filePath, 'utf8');
      return (
        contents.includes('@/ui/tokens/index') ||
        contents.includes('@/ui/tokens-runtime') ||
        contents.includes('@/ui/tokens/generated')
      );
    });

    expect(offenders).toEqual([]);
  });
});
