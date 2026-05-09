import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const defaultSrcRoot = resolve(frontendRoot, 'src');

const DARK_TEXT_PATTERN = /\bdark:text-[a-z-]+-\d{2,3}\b/;
const LIGHT_TEXT_PATTERN = /\btext-(?:slate|gray|zinc|neutral|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|lime)-\d{2,3}\b/;

function parseArgs(argv) {
  let srcRoot = defaultSrcRoot;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--src-root' && argv[i + 1]) {
      srcRoot = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return { srcRoot };
}

function posixRelative(fromRoot, absolutePath) {
  return relative(fromRoot, absolutePath).split('\\').join('/');
}

function isAllowlisted(relPosix) {
  if (relPosix.startsWith('ui/generated/')) {
    return true;
  }
  if (relPosix === 'ui/tokens.ts' || relPosix === 'ui/recipes.ts') {
    return true;
  }
  if (relPosix.startsWith('ui/primitives/')) {
    return true;
  }
  if (relPosix.startsWith('features/')) {
    return true;
  }
  if (relPosix.startsWith('components/')) {
    return true;
  }
  if (relPosix.startsWith('layouts/')) {
    return true;
  }
  if (relPosix.endsWith('.stories.tsx') || relPosix.endsWith('.stories.ts')) {
    return true;
  }
  return false;
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, acc);
    } else if (st.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function stripPlaceholderColorTokens(line) {
  return line
    .replace(/\bplaceholder:text-[a-z]+-\d{2,3}\b/g, '')
    .replace(/\bdark:placeholder:text-[a-z]+-\d{2,3}\b/g, '');
}

function scanFile(content) {
  const hits = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const scoped = stripPlaceholderColorTokens(line);
    if (DARK_TEXT_PATTERN.test(scoped)) {
      hits.push({ line: index + 1, rule: 'dark-text', sample: line.trim().slice(0, 140) });
    }
    if (LIGHT_TEXT_PATTERN.test(scoped)) {
      hits.push({ line: index + 1, rule: 'text-color', sample: line.trim().slice(0, 140) });
    }
  });
  return hits;
}

function checkTextColorStyling(srcRoot) {
  const root = resolve(srcRoot);
  const files = walkFiles(root);
  const problems = [];

  for (const file of files) {
    const ext = file.split('.').pop() ?? '';
    if (!['ts', 'tsx', 'css'].includes(ext)) {
      continue;
    }
    const rel = posixRelative(root, file);
    if (isAllowlisted(rel)) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    const hits = scanFile(content);
    if (hits.length > 0) {
      problems.push({ file: rel, hits });
    }
  }

  if (problems.length > 0) {
    const details = problems
      .map((p) => {
        const inner = p.hits
          .map((h) => `    line ${h.line} (${h.rule}): ${h.sample}`)
          .join('\n');
        return `  ${p.file}:\n${inner}`;
      })
      .join('\n');
    throw new Error(`disallowed text color styling outside approved files:\n${details}`);
  }
}

const { srcRoot } = parseArgs(process.argv.slice(2));

try {
  checkTextColorStyling(srcRoot);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

export { checkTextColorStyling, isAllowlisted };
