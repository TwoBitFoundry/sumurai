import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('ui imports audit', () => {
  it('allows the checked-in frontend/src tree', () => {
    const scriptPath = resolve(__dirname, '../../scripts/check-ui-imports.mjs');
    const frontendRoot = resolve(__dirname, '../..');
    execFileSync('node', [scriptPath], {
      cwd: frontendRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  });

  it('rejects forbidden primitives/recipes module specifiers', () => {
    const root = mkdtempSync(join(tmpdir(), 'ui-imports-audit-'));
    const srcDir = join(root, 'src');

    try {
      mkdirSync(join(srcDir, 'ui', 'primitives'), { recursive: true });
      mkdirSync(join(srcDir, 'components'), { recursive: true });
      writeFileSync(
        join(srcDir, 'ui', 'primitives', 'recipes.ts'),
        'export const recipes = "forbidden";'
      );
      writeFileSync(
        join(srcDir, 'components', 'Bad.tsx'),
        'import { recipes } from "@/ui/primitives/recipes"; export const Bad = () => recipes;'
      );

      const scriptPath = resolve(__dirname, '../../scripts/check-ui-imports.mjs');
      expect(() =>
        execFileSync('node', [scriptPath, '--src-root', srcDir], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      ).toThrow(/UI import policy violations/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
