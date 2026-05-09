import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('text color audit', () => {
  it('allows the checked-in frontend/src tree', () => {
    const scriptPath = resolve(__dirname, '../../scripts/check-text-color-styling.mjs');
    const frontendRoot = resolve(__dirname, '../..');
    execFileSync('node', [scriptPath], {
      cwd: frontendRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  });

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

  it('still flags non-placeholder text colors on the same line as placeholder colors', () => {
    const root = mkdtempSync(join(tmpdir(), 'text-color-audit-placeholder-'));

    try {
      mkdirSync(join(root, 'views'), { recursive: true });
      writeFileSync(
        join(root, 'views', 'Bad.tsx'),
        'export const Bad = () => <input className="placeholder:text-slate-400 text-slate-900" />;'
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
