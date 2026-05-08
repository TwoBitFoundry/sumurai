import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('text color audit', () => {
  it('rejects common ad hoc text colors outside approved files', () => {
    const root = mkdtempSync(join(tmpdir(), 'text-color-audit-'));

    try {
      mkdirSync(join(root, 'views'), { recursive: true });
      writeFileSync(
        join(root, 'views', 'Example.tsx'),
        'export const Example = () => <div className="text-slate-500 dark:text-slate-400" />;'
      );

      mkdirSync(join(root, 'ui', 'primitives'), { recursive: true });
      writeFileSync(
        join(root, 'ui', 'primitives', 'tokenRecipes.ts'),
        'export const approved = "text-slate-500 dark:text-slate-400";'
      );

      const scriptPath = resolve(__dirname, '../../scripts/check-text-color-styling.mjs');

      expect(() =>
        execFileSync('node', [scriptPath, '--src-root', root], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      ).toThrow(/disallowed text color styling/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
