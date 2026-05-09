import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const defaultSrcRoot = resolve(frontendRoot, 'src');

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const ARBITRARY_SHADOW_PATTERN = /shadow-\[/;
const ARBITRARY_HEX_CLASS_PATTERN = /\[(?:[^\]]*#[0-9a-fA-F]{3,8}[^\]]*)\]/;
const GRADIENT_ARBITRARY_PATTERN =
  /\b(?:bg|from|via|to|before:bg|after:bg|dark:bg|dark:before:bg)-\[[^\]]*(?:linear-gradient|conic-gradient|radial-gradient)[^\]]*\]/;

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
  if (relPosix === 'app/globals.css') {
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

function scanFile(relPosix, content) {
  const hits = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (HEX_PATTERN.test(line)) {
      hits.push({ line: index + 1, rule: 'hex', sample: line.trim().slice(0, 120) });
    }
    if (ARBITRARY_SHADOW_PATTERN.test(line)) {
      hits.push({ line: index + 1, rule: 'arbitrary-shadow', sample: line.trim().slice(0, 120) });
    }
    if (ARBITRARY_HEX_CLASS_PATTERN.test(line)) {
      hits.push({ line: index + 1, rule: 'arbitrary-bracket-color', sample: line.trim().slice(0, 120) });
    }
    if (GRADIENT_ARBITRARY_PATTERN.test(line)) {
      hits.push({ line: index + 1, rule: 'arbitrary-gradient', sample: line.trim().slice(0, 120) });
    }
  });
  return hits;
}

function checkRawStyling(srcRoot) {
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
    const hits = scanFile(rel, content);
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
    throw new Error(`disallowed raw styling outside approved files:\n${details}`);
  }
}

const { srcRoot } = parseArgs(process.argv.slice(2));

try {
  checkRawStyling(srcRoot);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

export { checkRawStyling, isAllowlisted };
