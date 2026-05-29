import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../..');
const workflowsDir = path.join(repoRoot, '.github/workflows');
const ciWorkflow = path.join(workflowsDir, 'ci.yml');
const semanticReleaseWorkflow = path.join(workflowsDir, 'semantic-release.yml');

function readWorkflow(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

function listWorkflowFiles() {
  return fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => path.join(workflowsDir, name));
}

describe('bun migration ci workflows', () => {
  it('does not reference npm or setup-node in any workflow', () => {
    const forbidden = /actions\/setup-node|npm ci|npm run|npx /;

    for (const filePath of listWorkflowFiles()) {
      const contents = readWorkflow(filePath);
      expect(contents).not.toMatch(forbidden);
    }
  });

  it('ci.yml frontend jobs use setup-bun 1.3.14 and bun commands', () => {
    const contents = readWorkflow(ciWorkflow);

    expect(contents).toContain('oven-sh/setup-bun@v2');
    expect(contents).toContain('bun-version: 1.3.14');
    expect(contents).toContain('run: bun ci');
    expect(contents).toContain('run: bun run lint');
    expect(contents).toContain('run: bun run typecheck');
    expect(contents).toContain('run: bun run design:guard');
    expect(contents).toContain('run: bun run test:ci');
    expect(contents).toContain('run: bun run build');
    expect(contents).toContain('run: bunx playwright install-deps chromium');
    expect(contents).toContain('run: bunx playwright install chromium');
    expect(contents).toContain('run: bun run test:storybook');
    expect(contents).toContain('run: bun run storybook:build');
    expect(contents).toContain('run: bun run test:storybook-runtime:run');
  });

  it('ci.yml backend job uses workspace root paths and rust-cache', () => {
    const contents = readWorkflow(ciWorkflow);

    expect(contents).toContain("- 'Cargo.toml'");
    expect(contents).toContain("- 'Cargo.lock'");
    expect(contents).toContain('workspaces: .');
    expect(contents).not.toContain('working-directory: backend');
  });

  it('ci.yml splits lint/test and build/storybook into parallel jobs', () => {
    const contents = readWorkflow(ciWorkflow);

    expect(contents).toContain('frontend-check:');
    expect(contents).toContain('frontend-build:');
  });

  it('ci.yml caches Next.js build output', () => {
    const contents = readWorkflow(ciWorkflow);

    expect(contents).toContain('frontend/.next/cache');
    expect(contents).toContain('nextjs-');
  });

  it('ci.yml Playwright cache keys off resolved version', () => {
    const contents = readWorkflow(ciWorkflow);

    expect(contents).toContain('id: pw');
    expect(contents).toContain(
      'echo "version=$(bun -e \'console.log(require("@playwright/test/package.json").version)\')" >> "$GITHUB_OUTPUT"'
    );
    expect(contents).toContain('key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}');
  });

  it('semantic-release.yml uses bun ci and bun run release', () => {
    const contents = readWorkflow(semanticReleaseWorkflow);

    expect(contents).toContain('oven-sh/setup-bun@v2');
    expect(contents).toContain('bun-version: 1.3.14');
    expect(contents).toContain('run: bun ci');
    expect(contents).toContain('bun run release');
    expect(contents).toContain('HUSKY: "0"');
  });
});
