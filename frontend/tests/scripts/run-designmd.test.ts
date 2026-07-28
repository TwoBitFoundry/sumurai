import { spawnSync } from 'node:child_process';
import path from 'node:path';

const frontendRoot = path.join(__dirname, '../..');

describe('run-designmd workspace resolution', () => {
  it('resolves the hoisted @google/design.md CLI without a global install', () => {
    const result = spawnSync(
      process.execPath,
      ['./scripts/run-designmd.mjs', '--quiet', 'lint', '../DESIGN.md'],
      {
        cwd: frontendRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: '/usr/bin:/bin',
          HOMEBREW_PREFIX: '',
          npm_execpath: '',
        },
      }
    );

    expect(result.error).toBeUndefined();
    expect(result.stderr ?? '').not.toContain('Unable to find global design.md CLI');
    expect(result.status).toBe(0);
  });
});
