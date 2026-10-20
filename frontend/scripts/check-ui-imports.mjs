import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const defaultSrcRoot = resolve(frontendRoot, 'src');

function parseArgs(argv) {
  let srcRoot = defaultSrcRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--src-root' && argv[index + 1]) {
      srcRoot = resolve(argv[index + 1]);
      index += 1;
    }
  }

  return { srcRoot };
}

function posixRelative(fromRoot, absolutePath) {
  return relative(fromRoot, absolutePath).split('\\').join('/');
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

function parseSourceFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const plugins = filePath.endsWith('.tsx') ? ['jsx', 'typescript'] : ['typescript'];
  return parse(content, { sourceType: 'module', plugins });
}

function isForbiddenRecipesModuleSpecifier(moduleSpecifier) {
  if (moduleSpecifier === '@/ui/primitives/recipes') {
    return true;
  }
  return /^@\/ui\/primitives\/[^/]+\/recipes$/.test(moduleSpecifier);
}

function isPrimitiveComponentTsx(relPosix) {
  return (
    relPosix.startsWith('ui/primitives/') &&
    relPosix.endsWith('.tsx') &&
    !relPosix.endsWith('.stories.tsx')
  );
}

function isAllowedPrimitiveAliasImport(moduleSpecifier) {
  if (moduleSpecifier === '@/ui/recipes') {
    return true;
  }
  if (moduleSpecifier.startsWith('@/ui/tokens')) {
    return true;
  }
  if (moduleSpecifier.startsWith('@/utils/')) {
    return true;
  }
  if (moduleSpecifier.startsWith('@/context/')) {
    return true;
  }
  if (moduleSpecifier.startsWith('@/components/')) {
    return true;
  }
  return false;
}

function isAllowedPrimitiveImport(_relPosix, moduleSpecifier) {
  if (!moduleSpecifier.startsWith('@/')) {
    return true;
  }
  return isAllowedPrimitiveAliasImport(moduleSpecifier);
}

function checkRecipesAndPrimitiveImports(srcRoot) {
  const files = walkFiles(srcRoot).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
  const problems = [];

  for (const file of files) {
    const rel = posixRelative(srcRoot, file);
    const { program } = parseSourceFile(file);

    for (const statement of program.body) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      const moduleSpecifier = statement.source.value;

      if (isForbiddenRecipesModuleSpecifier(moduleSpecifier)) {
        problems.push({
          file: rel,
          moduleSpecifier,
          reason: 'forbidden primitives recipes module',
        });
        continue;
      }

      if (
        isPrimitiveComponentTsx(rel) &&
        !isAllowedPrimitiveImport(rel, moduleSpecifier)
      ) {
        problems.push({
          file: rel,
          moduleSpecifier,
          reason:
            'primitive .tsx may only import @/ from @/ui/recipes, @/ui/tokens, @/utils/, @/context/, or @/components/',
        });
      }
    }
  }

  if (problems.length > 0) {
    const details = problems
      .map((problem) => `  ${problem.file} -> ${problem.moduleSpecifier} (${problem.reason})`)
      .join('\n');
    throw new Error(`UI import policy violations:\n${details}`);
  }
}

const { srcRoot } = parseArgs(process.argv.slice(2));

try {
  checkRecipesAndPrimitiveImports(srcRoot);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

export { checkRecipesAndPrimitiveImports };
