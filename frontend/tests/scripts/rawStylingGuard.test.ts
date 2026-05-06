import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(__dirname, '../../..');
const frontendRoot = join(repoRoot, 'frontend');
const guardScript = join(frontendRoot, 'scripts/check-raw-styling.mjs');

function runGuard(srcRoot: string): string {
  return execFileSync(process.execPath, [guardScript, '--src-root', srcRoot], {
    cwd: frontendRoot,
    encoding: 'utf8',
  });
}

describe('raw styling guard', () => {
  it('allows approved token and recipe files', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-styling-guard-ok-'));
    mkdirSync(join(workspace, 'ui/tokens/generated'), { recursive: true });
    writeFileSync(
      join(workspace, 'ui/tokens/generated/theme.css'),
      ':root { --x: #112233; }\n'
    );
    writeFileSync(join(workspace, 'ui/tokens/index.ts'), "export const x = '#445566';\n");
    mkdirSync(join(workspace, 'features/x'), { recursive: true });
    writeFileSync(join(workspace, 'features/x/tokenRecipes.ts'), "'shadow-[0_1px_2px_rgba(0,0,0,1)]'\n");
    mkdirSync(join(workspace, 'app'), { recursive: true });
    writeFileSync(join(workspace, 'app/globals.css'), '.x { color: #abcdef; }\n');

    expect(() => runGuard(workspace)).not.toThrow();
  });

  it('rejects raw hex outside approved paths', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-styling-guard-bad-'));
    mkdirSync(join(workspace, 'views'), { recursive: true });
    writeFileSync(join(workspace, 'views/Bad.tsx'), 'const c = "#ff0000";\n');

    expect(() => runGuard(workspace)).toThrow();
  });

  it('rejects arbitrary shadow brackets outside approved paths', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-styling-guard-shadow-'));
    mkdirSync(join(workspace, 'views'), { recursive: true });
    writeFileSync(join(workspace, 'views/Page.tsx'), '<div className="shadow-[0_1px_2px_red]" />\n');

    expect(() => runGuard(workspace)).toThrow();
  });

  it('rejects thin-zone styling under synthetic views', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-styling-guard-view-'));
    mkdirSync(join(workspace, 'views'), { recursive: true });
    writeFileSync(join(workspace, 'views/Page.tsx'), 'export const x = () => <div className="bg-[#ff0000]" />;\n');

    expect(() => runGuard(workspace)).toThrow();
  });

  it('passes on the production src tree', () => {
    const srcRoot = join(frontendRoot, 'src');
    expect(() => runGuard(srcRoot)).not.toThrow();
  });
});
