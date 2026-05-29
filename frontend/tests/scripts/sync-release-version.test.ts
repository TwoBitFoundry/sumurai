import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../..');
const scriptPath = path.join(repoRoot, 'scripts/sync-release-version.mjs');
const huskyPath = path.join(repoRoot, '.husky/pre-commit');
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
      'frontend/bun.lock',
      'backend/Cargo.toml',
      'Cargo.lock',
    ]);
  });

  it('pre-commit hook invokes bun instead of npm', () => {
    const contents = fs.readFileSync(huskyPath, 'utf8');

    expect(contents).not.toMatch(/\bnpm\b/);
    expect(contents).toContain('bun --cwd=frontend run precommit');
    expect(contents).toContain('bun run backend:ci');
  });
});
