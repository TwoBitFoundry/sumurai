import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(__dirname, '../../..');
const frontendRoot = join(repoRoot, 'frontend');
const generateScript = join(frontendRoot, 'scripts/generate-design-tokens.mjs');
const checkScript = join(frontendRoot, 'scripts/check-design-tokens-drift.mjs');
const sourceDesign = join(repoRoot, 'DESIGN.md');

function runNode(script: string, args: string[]): string {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: frontendRoot,
    encoding: 'utf8',
  });
}

describe('design token generation', () => {
  it('generates theme, TypeScript, and DTCG artifacts from a design source', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-design-tokens-'));
    const designPath = join(workspace, 'DESIGN.md');
    const outDir = join(workspace, 'generated');

    copyFileSync(sourceDesign, designPath);
    runNode(generateScript, ['--design', designPath, '--out-dir', outDir]);

    const themePath = join(outDir, 'theme.css');
    const tokensPath = join(outDir, 'tokens.ts');
    const dtcgPath = join(outDir, 'tokens.dtcg.json');

    expect(existsSync(themePath)).toBe(true);
    expect(existsSync(tokensPath)).toBe(true);
    expect(existsSync(dtcgPath)).toBe(true);
    expect(readFileSync(themePath, 'utf8')).toContain('@theme static');
    expect(readFileSync(tokensPath, 'utf8')).toContain('export const designTokens');
    expect(JSON.parse(readFileSync(dtcgPath, 'utf8')).$description).toBe(
      'Dark-first glass financial UI with cyan-violet brand accents and semantic finance colors.'
    );
  });

  it('fails drift checks when the source changes without regeneration', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'sumurai-design-drift-'));
    const designPath = join(workspace, 'DESIGN.md');
    const outDir = join(workspace, 'generated');

    copyFileSync(sourceDesign, designPath);
    runNode(generateScript, ['--design', designPath, '--out-dir', outDir]);

    const generatedThemePath = join(outDir, 'theme.css');
    const originalTheme = readFileSync(generatedThemePath, 'utf8');
    writeFileSync(designPath, readFileSync(designPath, 'utf8').replace('#0369a1', '#0369a2'));

    expect(() =>
      runNode(checkScript, ['--design', designPath, '--out-dir', outDir])
    ).toThrow();
    expect(readFileSync(generatedThemePath, 'utf8')).toBe(originalTheme);
  });
});
