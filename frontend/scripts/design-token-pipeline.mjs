import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const repoRoot = resolve(frontendRoot, '..');
const defaultDesignPath = resolve(repoRoot, 'DESIGN.md');
const defaultOutDir = resolve(frontendRoot, 'src/ui/generated');
const runDesignmdScript = resolve(scriptDir, 'run-designmd.mjs');

function parseArgs(argv) {
  const result = {
    designPath: defaultDesignPath,
    outDir: defaultOutDir,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--design' && argv[index + 1]) {
      result.designPath = resolve(argv[index + 1]);
      index += 1;
    } else if (arg === '--out-dir' && argv[index + 1]) {
      result.outDir = resolve(argv[index + 1]);
      index += 1;
    }
  }

  return result;
}

function runDesignmd(designPath) {
  const result = spawnSync(process.execPath, [runDesignmdScript, 'export', '--format', 'dtcg', designPath], {
    cwd: frontendRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'designmd export failed');
  }

  return result.stdout;
}

function ensureOutputDir(outDir) {
  mkdirSync(outDir, { recursive: true });
}

function normalizePrimitive(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizePrimitive).join(', ');
  }

  if (typeof value === 'object') {
    if ('hex' in value && typeof value.hex === 'string') {
      return value.hex;
    }

    if ('value' in value && 'unit' in value) {
      return `${value.value}${value.unit}`;
    }

    if ('value' in value && typeof value.value !== 'object') {
      return String(value.value);
    }
  }

  return JSON.stringify(value);
}

function emitTypographyVariables(name, value) {
  const lines = [];

  if (value.fontFamily) {
    lines.push(`  --font-${name}: ${normalizePrimitive(value.fontFamily)};`);
  }

  if (value.fontSize) {
    lines.push(`  --text-${name}: ${normalizePrimitive(value.fontSize)};`);
  }

  if (value.fontWeight !== undefined) {
    lines.push(`  --font-weight-${name}: ${normalizePrimitive(value.fontWeight)};`);
  }

  if (value.lineHeight) {
    lines.push(`  --leading-${name}: ${normalizePrimitive(value.lineHeight)};`);
  }

  if (value.letterSpacing) {
    lines.push(`  --tracking-${name}: ${normalizePrimitive(value.letterSpacing)};`);
  }

  return lines;
}

function walkTokens(node, path = []) {
  const tokens = [];

  if (!node || typeof node !== 'object') {
    return tokens;
  }

  if ('$value' in node) {
    tokens.push({ path, type: node.$type, value: node.$value });
    return tokens;
  }

  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) {
      continue;
    }

    tokens.push(...walkTokens(child, [...path, key]));
  }

  return tokens;
}

function toThemeCss(dtcg) {
  const rootLines = [];
  const darkLines = [];
  const tokens = walkTokens(dtcg);

  for (const token of tokens) {
    const [group, ...rest] = token.path;
    const name = rest.join('-');

    if (!group || !name) {
      continue;
    }

    if (group === 'color') {
      const colorName = name.endsWith('-dark') ? name.slice(0, -5) : name;
      const targetLines = name.endsWith('-dark') ? darkLines : rootLines;
      targetLines.push(`  --color-${colorName}: ${normalizePrimitive(token.value)};`);
      continue;
    }

    if (group === 'spacing') {
      rootLines.push(`  --spacing-${name}: ${normalizePrimitive(token.value)};`);
      continue;
    }

    if (group === 'rounded') {
      rootLines.push(`  --radius-${name}: ${normalizePrimitive(token.value)};`);
      continue;
    }

    if (group === 'typography' && token.type === 'typography' && token.value && typeof token.value === 'object') {
      rootLines.push(...emitTypographyVariables(name, token.value));
    }
  }

  const lines = ['@theme static {', ...rootLines, '}'];

  if (darkLines.length > 0) {
    lines.push('.dark {', ...darkLines, '}');
  }

  return `${lines.join('\n')}\n`;
}

function toTokensTs(dtcg) {
  return `export const generatedTokens = ${JSON.stringify(dtcg, null, 2)} as const;\nexport type GeneratedTokens = typeof generatedTokens;\nexport default generatedTokens;\n`;
}

function writeArtifacts(outDir, dtcg) {
  ensureOutputDir(outDir);
  writeFileSync(join(outDir, 'tokens.dtcg.json'), `${JSON.stringify(dtcg, null, 2)}\n`);
  writeFileSync(join(outDir, 'theme.css'), toThemeCss(dtcg));
  writeFileSync(join(outDir, 'tokens.ts'), toTokensTs(dtcg));
}

function generateDesignTokens({ designPath, outDir } = parseArgs(process.argv.slice(2))) {
  const dtcg = JSON.parse(runDesignmd(designPath));
  writeArtifacts(outDir, dtcg);
  return { dtcg, outDir };
}

function diffArtifacts(expectedDir, actualDir) {
  const names = ['tokens.dtcg.json', 'theme.css', 'tokens.ts'];
  const differences = [];

  for (const name of names) {
    const expectedPath = join(expectedDir, name);
    const actualPath = join(actualDir, name);
    const expected = readFileSync(expectedPath, 'utf8');
    const actual = readFileSync(actualPath, 'utf8');

    if (expected !== actual) {
      differences.push(name);
    }
  }

  return differences;
}

function checkDesignTokenDrift({ designPath, outDir } = parseArgs(process.argv.slice(2))) {
  const tempOutDir = join(outDir, '.tmp-drift-check');
  rmSync(tempOutDir, { recursive: true, force: true });
  let differences = [];

  try {
    const dtcg = JSON.parse(runDesignmd(designPath));
    writeArtifacts(tempOutDir, dtcg);
    differences = diffArtifacts(tempOutDir, outDir);
  } finally {
    rmSync(tempOutDir, { recursive: true, force: true });
  }

  if (differences.length > 0) {
    throw new Error(`Design token drift detected: ${differences.join(', ')}`);
  }
}

export {
  checkDesignTokenDrift,
  generateDesignTokens,
  normalizePrimitive,
  parseArgs,
  toThemeCss,
  toTokensTs,
  walkTokens,
};
