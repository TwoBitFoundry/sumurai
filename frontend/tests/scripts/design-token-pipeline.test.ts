import { execFileSync } from 'node:child_process';

describe('design token pipeline', () => {
  it('scopes dark color variables inside the dark selector', () => {
    const output = execFileSync(
      'node',
      [
        '--input-type=module',
        '-e',
        [
          "import { toThemeCss } from './scripts/design-token-pipeline.mjs';",
          'const css = toThemeCss({',
          '  color: {',
          '    text: {',
          "      body: { $type: 'color', $value: '#0f172a' },",
          "      'body-dark': { $type: 'color', $value: '#f8fafc' },",
          '    },',
          '    surface: {',
          "      card: { $type: 'color', $value: '#ffffff' },",
          "      'card-dark': { $type: 'color', $value: '#0f172a' },",
          '    },',
          '  },',
          '});',
          'process.stdout.write(css);',
        ].join(' '),
      ],
      {
        cwd: `${__dirname}/../..`,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    expect(output).toContain('@theme static {');
    expect(output).toContain('  --color-text-body: #0f172a;');
    expect(output).toContain('  --color-surface-card: #ffffff;');
    expect(output).toContain('.dark {');
    expect(output).toContain('  --color-text-body: #f8fafc;');
    expect(output).toContain('  --color-surface-card: #0f172a;');
    expect(output).not.toContain('--color-text-body-dark');
    expect(output).not.toContain('--color-surface-card-dark');
  });
});
