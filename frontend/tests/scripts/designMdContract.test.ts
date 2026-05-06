import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = join(__dirname, '../../..');
const frontendRoot = join(repoRoot, 'frontend');
const designPath = join(repoRoot, 'DESIGN.md');

function runDesignScript(script: string): string {
  return execFileSync('npm', ['run', script], {
    cwd: frontendRoot,
    encoding: 'utf8',
  });
}

function readDesignBody(): string {
  const content = readFileSync(designPath, 'utf8');
  const frontMatterEnd = content.indexOf('\n---\n');

  if (frontMatterEnd < 0) {
    throw new Error('DESIGN.md front matter is missing a closing fence');
  }

  return content.slice(frontMatterEnd + '\n---\n'.length);
}

describe('design.md contract', () => {
  it('keeps the canonical section order and prose-only guidance', () => {
    const body = readDesignBody();
    const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);

    expect(headings).toEqual([
      'Overview',
      'Colors',
      'Typography',
      'Layout',
      'Elevation & Depth',
      'Shapes',
      'Components',
      "Do's and Don'ts",
    ]);
    expect(body).not.toContain('designTokens.');
    expect(body).not.toContain('tailwind-bridge');
    expect(body).not.toContain('class arrays');
    expect(body).not.toMatch(/rounded-\[/);
    expect(body).not.toMatch(/hover:/);
  });

  it('lints and exports the design contract through npm wrappers', () => {
    expect(runDesignScript('design:lint')).toContain('"errors": 0');
    expect(runDesignScript('design:export:dtcg')).toContain('$schema');
    expect(runDesignScript('design:export:tailwind')).toContain('"theme"');
  });
});
