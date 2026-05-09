import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const defaultSrcRoot = resolve(frontendRoot, 'src');
const defaultDocsDir = resolve(frontendRoot, '..', 'docs');
const defaultDesignPath = resolve(frontendRoot, '..', 'DESIGN.md');

const monitoredSources = [
  '@/ui/recipes',
  '@/ui/tokens',
  '@/ui/tokens/textRecipes',
];

function parseArgs(argv) {
  let srcRoot = defaultSrcRoot;
  let docsDir = defaultDocsDir;
  let designPath = defaultDesignPath;
  let writeInventory = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--src-root' && argv[index + 1]) {
      srcRoot = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--docs-dir' && argv[index + 1]) {
      docsDir = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--design-path' && argv[index + 1]) {
      designPath = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--write-inventory') {
      writeInventory = true;
    }
  }

  return { srcRoot, docsDir, designPath, writeInventory };
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
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);
}

function getImportedSymbols(sourceFile, moduleSpecifier) {
  const symbols = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== moduleSpecifier) {
      continue;
    }

    const clause = statement.importClause;
    if (!clause) {
      continue;
    }

    if (clause.name) {
      symbols.push(clause.name.text);
    }

    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        symbols.push(element.propertyName ? `${element.propertyName.text} as ${element.name.text}` : element.name.text);
      }
    }

    if (bindings && ts.isNamespaceImport(bindings)) {
      symbols.push(`* as ${bindings.name.text}`);
    }
  }

  return symbols;
}

function isDesignTokensRoot(node) {
  if (ts.isIdentifier(node)) {
    return node.text === 'designTokens';
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return isDesignTokensRoot(node.expression);
  }
  return false;
}

function pathFromDesignTokens(node, sourceFile) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return `${pathFromDesignTokens(node.expression, sourceFile)}.${node.name.text}`;
  }
  if (ts.isElementAccessExpression(node)) {
    const argument = node.argumentExpression ? node.argumentExpression.getText(sourceFile) : '';
    return `${pathFromDesignTokens(node.expression, sourceFile)}[${argument}]`;
  }
  return node.getText(sourceFile);
}

function collectDesignTokensPaths(sourceFile) {
  const paths = new Set();

  function visit(node) {
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && isDesignTokensRoot(node.expression)) {
      paths.add(pathFromDesignTokens(node, sourceFile));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...paths];
}

function parseDesignComponents(designPath) {
  const lines = readFileSync(designPath, 'utf8').split(/\r?\n/);
  const components = [];
  let inComponents = false;

  for (const line of lines) {
    if (!inComponents) {
      if (line.trim() === 'components:') {
        inComponents = true;
      }
      continue;
    }

    const match = line.match(/^\s{2}([a-z0-9-]+):\s*$/i);
    if (match) {
      components.push(match[1]);
    }
  }

  return components;
}

function normalizeDesignComponentSlug(slug) {
  const aliases = new Map([
    ['app-title-bar-wordmark', ['appTitleBar']],
    ['app-title-bar-chrome-expanded', ['appTitleBar']],
    ['button-primary', ['button']],
    ['button-secondary', ['button']],
    ['button-icon', ['button']],
    ['input-default', ['input']],
    ['input-invalid', ['input']],
    ['input-glass', ['input']],
    ['select-default', ['select']],
    ['select-invalid', ['select']],
    ['select-glass', ['select']],
    ['glass-card', ['glassCard']],
    ['page-shell', ['pageLayout']],
    ['pill', ['pill']],
    ['hero-stat-card', ['heroStatCard']],
    ['budget-card-shell', ['budgetCard']],
    ['budget-card-shell-dark', ['budgetCard']],
    ['budget-progress-track', ['budgetProgress']],
    ['budget-progress-track-dark', ['budgetProgress']],
    ['budget-progress-fill-within', ['budgetProgress']],
    ['budget-progress-fill-over', ['budgetProgress']],
    ['budget-progress-caption-row', ['budgetProgress']],
    ['budget-progress-caption-summary', ['budgetProgress']],
    ['budget-progress-caption-danger', ['budgetProgress']],
    ['surface-panel-glass-dark', ['budgetCard']],
    ['surface-layered-panel-dark', ['budgetCard']],
    ['surface-data-row-dark', ['transactions']],
    ['surface-secondary-text', ['budgetProgress']],
    ['surface-secondary-text-dark', ['budgetProgress']],
    ['pagination-round-button', ['pageLayout']],
    ['pagination-round-button-dark', ['pageLayout']],
    ['accounts-toolbar-button', ['actions']],
    ['accounts-toolbar-button-dark', ['actions']],
    ['provider-connect-plaid-eyebrow', ['onboarding']],
    ['provider-connect-teller-eyebrow', ['onboarding']],
    ['onboarding-step-card', ['onboarding']],
    ['onboarding-step-card-dark', ['onboarding']],
    ['onboarding-preview-frame', ['onboarding']],
    ['onboarding-body-muted', ['onboarding']],
    ['onboarding-body-muted-dark', ['onboarding']],
    ['brand-accent-sky', ['colors.brandAccent']],
    ['brand-accent-sky-dark', ['colors.brandAccent']],
    ['brand-accent-emerald', ['colors.brandAccent']],
    ['brand-accent-emerald-dark', ['colors.brandAccent']],
    ['brand-accent-amber', ['colors.brandAccent']],
    ['brand-accent-amber-dark', ['colors.brandAccent']],
    ['brand-accent-rose', ['colors.brandAccent']],
    ['brand-accent-rose-dark', ['colors.brandAccent']],
    ['brand-accent-violet', ['colors.brandAccent']],
    ['brand-accent-violet-dark', ['colors.brandAccent']],
    ['brand-accent-cyan', ['colors.brandAccent']],
    ['brand-accent-cyan-dark', ['colors.brandAccent']],
    ['chart-series-light-1', ['colors.categoryAccents']],
    ['chart-series-light-2', ['colors.categoryAccents']],
    ['chart-series-light-3', ['colors.categoryAccents']],
    ['chart-series-light-4', ['colors.categoryAccents']],
    ['chart-series-light-5', ['colors.categoryAccents']],
    ['chart-series-light-6', ['colors.categoryAccents']],
    ['chart-series-dark-1', ['colors.categoryAccents']],
    ['chart-series-dark-2', ['colors.categoryAccents']],
    ['chart-series-dark-3', ['colors.categoryAccents']],
    ['chart-series-dark-4', ['colors.categoryAccents']],
    ['chart-series-dark-5', ['colors.categoryAccents']],
    ['chart-series-dark-6', ['colors.categoryAccents']],
  ]);

  if (aliases.has(slug)) {
    return aliases.get(slug);
  }

  return [slug.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())];
}

function collectInventory(srcRoot, designPath) {
  const files = walkFiles(srcRoot).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
  const sourceBuckets = new Map();
  const designTokenBuckets = new Map();

  for (const file of files) {
    const rel = posixRelative(srcRoot, file);
    const sourceFile = parseSourceFile(file);

    for (const moduleSpecifier of monitoredSources) {
      const symbols = getImportedSymbols(sourceFile, moduleSpecifier);
      if (symbols.length === 0) {
        continue;
      }
      if (!sourceBuckets.has(moduleSpecifier)) {
        sourceBuckets.set(moduleSpecifier, new Map());
      }
      const bucket = sourceBuckets.get(moduleSpecifier);
      for (const symbol of symbols) {
        if (!bucket.has(symbol)) {
          bucket.set(symbol, new Set());
        }
        bucket.get(symbol).add(rel);
      }
    }

    for (const path of collectDesignTokensPaths(sourceFile)) {
      if (!designTokenBuckets.has(path)) {
        designTokenBuckets.set(path, new Set());
      }
      designTokenBuckets.get(path).add(rel);
    }
  }

  const sources = monitoredSources.map((source) => {
    const bucket = sourceBuckets.get(source) || new Map();
    const symbols = [...bucket.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([symbol, filesSet]) => ({
        symbol,
        consumerFiles: [...filesSet].sort(),
        consumerCount: filesSet.size,
      }));

    return { source, symbols };
  });

  const designTokens = [...designTokenBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, filesSet]) => ({
      symbol: path,
      consumerFiles: [...filesSet].sort(),
      consumerCount: filesSet.size,
    }));

  const designComponents = parseDesignComponents(designPath);
  const usedPrefixes = new Set(
    designTokens.flatMap((entry) => {
      if (!entry.symbol.startsWith('designTokens.components.')) {
        return [];
      }
      return entry.symbol.slice('designTokens.components.'.length).split('.');
    })
  );

  const zeroRefComponents = designComponents.filter((slug) => {
    const prefixes = normalizeDesignComponentSlug(slug);
    return !prefixes.some((prefix) => {
      if (prefix === slug) {
        return usedPrefixes.has(prefix);
      }
      return usedPrefixes.has(prefix) || [...usedPrefixes].some((used) => used.startsWith(prefix));
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    srcRoot,
    designPath,
    sources,
    designTokens,
    zeroRefComponents,
  };
}

function toMarkdownList(items) {
  if (items.length === 0) {
    return '_None._';
  }
  return items.map((item) => `- \`${item}\``).join('\n');
}

function renderInventoryMarkdown(inventory) {
  const sections = [`# UI Inventory`, '', `Generated from \`${posixRelative(frontendRoot, inventory.srcRoot)}\` and \`${posixRelative(frontendRoot, inventory.designPath)}\` on ${inventory.generatedAt}.`, ''];

  for (const source of inventory.sources) {
    sections.push(`## ${source.source}`, '', '| symbol | consumer files | consumer count |', '| --- | --- | --- |');
    for (const entry of source.symbols) {
      sections.push(
        `| \`${entry.symbol}\` | ${entry.consumerFiles.map((file) => `\`${file}\``).join(', ')} | ${entry.consumerCount} |`
      );
    }
    if (source.symbols.length === 0) {
      sections.push('| _None_ | _None_ | 0 |');
    }
    sections.push('');
  }

  sections.push('## designTokens access paths', '', '| symbol | consumer files | consumer count |', '| --- | --- | --- |');
  for (const entry of inventory.designTokens) {
    sections.push(
      `| \`${entry.symbol}\` | ${entry.consumerFiles.map((file) => `\`${file}\``).join(', ')} | ${entry.consumerCount} |`
    );
  }
  if (inventory.designTokens.length === 0) {
    sections.push('| _None_ | _None_ | 0 |');
  }

  sections.push('', '## DESIGN.md components with zero references', '', toMarkdownList(inventory.zeroRefComponents), '');
  return sections.join('\n');
}

function writeInventoryDocs(inventory, docsDir) {
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'ui-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  writeFileSync(join(docsDir, 'ui-inventory.md'), `${renderInventoryMarkdown(inventory)}\n`);
}

function loadInventory(docsDir) {
  const raw = readFileSync(join(docsDir, 'ui-inventory.json'), 'utf8');
  return JSON.parse(raw);
}

function checkUiImports(srcRoot, docsDir) {
  const inventory = loadInventory(docsDir);
  const allowedBySource = new Map();

  for (const source of inventory.sources || []) {
    allowedBySource.set(
      source.source,
      new Set((source.symbols || []).flatMap((entry) => entry.consumerFiles || []))
    );
  }

  const monitoredSet = new Set(monitoredSources);
  const files = walkFiles(srcRoot).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
  const problems = [];

  for (const file of files) {
    const rel = posixRelative(srcRoot, file);
    const sourceFile = parseSourceFile(file);

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) {
        continue;
      }
      if (!ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      const moduleSpecifier = statement.moduleSpecifier.text;
      if (!monitoredSet.has(moduleSpecifier)) {
        continue;
      }

      const allowedConsumers = allowedBySource.get(moduleSpecifier) || new Set();
      if (!allowedConsumers.has(rel)) {
        problems.push({ file: rel, moduleSpecifier });
      }
    }
  }

  if (problems.length > 0) {
    const details = problems.map((problem) => `  ${problem.file} -> ${problem.moduleSpecifier}`).join('\n');
    throw new Error(`disallowed UI imports outside the inventory allowlist:\n${details}`);
  }
}

const { srcRoot, docsDir, designPath, writeInventory } = parseArgs(process.argv.slice(2));

try {
  if (writeInventory) {
    const inventory = collectInventory(srcRoot, designPath);
    writeInventoryDocs(inventory, docsDir);
  } else {
    checkUiImports(srcRoot, docsDir);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

export {
  checkUiImports,
  collectInventory,
  loadInventory,
  normalizeDesignComponentSlug,
  renderInventoryMarkdown,
  writeInventoryDocs,
};
