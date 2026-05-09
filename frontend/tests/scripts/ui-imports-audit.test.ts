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

  it('rejects imports from monitored recipes outside the allowlist', () => {
    const root = mkdtempSync(join(tmpdir(), 'ui-imports-audit-'));
    const docsDir = join(root, 'docs');
    const srcDir = join(root, 'src');

    try {
      mkdirSync(join(srcDir, 'ui'), { recursive: true });
      mkdirSync(join(srcDir, 'components'), { recursive: true });
      writeFileSync(join(srcDir, 'ui', 'recipes.ts'), 'export const recipes = "ok";');
      writeFileSync(
        join(srcDir, 'components', 'Allowed.tsx'),
        'import { recipes } from "@/ui/recipes"; export const Allowed = () => recipes;'
      );
      writeFileSync(
        join(root, 'DESIGN.md'),
        ['components:', '  sample-card:', '    backgroundColor: "#ffffff"', ''].join('\n')
      );

      const scriptPath = resolve(__dirname, '../../scripts/check-ui-imports.mjs');
      execFileSync(
        'node',
        [
          scriptPath,
          '--src-root',
          srcDir,
          '--docs-dir',
          docsDir,
          '--design-path',
          join(root, 'DESIGN.md'),
          '--write-inventory',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      writeFileSync(
        join(srcDir, 'components', 'Bad.tsx'),
        'import { recipes } from "@/ui/recipes"; export const Bad = () => recipes;'
      );

      expect(() =>
        execFileSync('node', [scriptPath, '--src-root', srcDir, '--docs-dir', docsDir], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      ).toThrow(/disallowed UI imports outside the inventory allowlist/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
