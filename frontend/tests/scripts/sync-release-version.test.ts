import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../..');
const scriptPath = path.join(repoRoot, 'scripts/sync-release-version.mjs');
const rootPackagePath = path.join(repoRoot, 'package.json');
const huskyPath = path.join(repoRoot, '.husky/pre-commit');
const huskyReadmePath = path.join(repoRoot, '.husky/README.md');
const contributingPath = path.join(repoRoot, 'CONTRIBUTING.md');
const agentsPath = path.join(repoRoot, 'AGENTS.md');
const claudePath = path.join(repoRoot, 'CLAUDE.md');
const releasercPath = path.join(repoRoot, '.releaserc.json');

describe('bun migration release plumbing', () => {
  it('sync-release-version does not reference npm lockfiles', () => {
    const contents = fs.readFileSync(scriptPath, 'utf8');

    expect(contents).not.toContain('package-lock.json');
    expect(contents).toContain("exec('bun', ['install', '--lockfile-only']");
  });

  it('semantic-release git assets track bun lockfiles', () => {
    const releaserc = JSON.parse(fs.readFileSync(releasercPath, 'utf8')) as {
      plugins: Array<{ assets?: string[] } | [string, { assets?: string[] }]>;
    };
    const gitPlugin = releaserc.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/git'
    ) as [string, { assets: string[] }] | undefined;

    expect(gitPlugin?.[1].assets).toEqual([
      'package.json',
      'bun.lock',
      'frontend/package.json',
      'backend/Cargo.toml',
      'Cargo.lock',
    ]);
  });

  it('root frontend scripts route through the workspace', () => {
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const frontendScripts = Object.entries(rootPackage.scripts).filter(([name]) =>
      name.startsWith('frontend:')
    );

    expect(rootPackage.scripts['frontend:dev']).toBe('bun run --filter frontend dev');
    expect(frontendScripts.length).toBeGreaterThan(0);
    for (const [, command] of frontendScripts) {
      expect(command).not.toContain('--cwd=frontend');
    }
  });

  it('pre-commit hook invokes the repository command', () => {
    const contents = fs.readFileSync(huskyPath, 'utf8');

    expect(contents).not.toMatch(/\bnpm\b/);
    expect(contents).toContain('bun run precommit');
    expect(contents).not.toContain('--cwd=frontend');
  });

  it('pre-commit troubleshooting uses the repository command', () => {
    const contents = fs.readFileSync(huskyReadmePath, 'utf8');

    expect(contents).not.toContain('lint-staged');
    expect(contents).toContain('bun run precommit');
  });

  it('contributor documentation uses the root workspace interface', () => {
    const contributing = fs.readFileSync(contributingPath, 'utf8');
    const agents = fs.readFileSync(agentsPath, 'utf8');
    const claude = fs.readFileSync(claudePath, 'utf8');

    expect(contributing).toContain('bun run frontend:dev');
    expect(contributing).not.toContain('--cwd=frontend');
    expect(agents).not.toContain('--cwd=frontend');
    expect(claude).not.toContain('--cwd=frontend');
  });
});
