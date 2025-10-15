# Git Hooks Setup

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook automatically runs on staged files before each commit:

1. **ESLint** - Checks Tailwind utility count (max 5) and code quality
2. **TypeScript** - Type checks staged `.ts` and `.tsx` files
3. **Auto-fix** - Attempts to fix ESLint violations automatically

## Configuration

- **Hook location**: `.husky/pre-commit`
- **Lint-staged config**: `frontend/package.json` → `lint-staged` field
- **ESLint config**: `frontend/eslint.config.js`

## Bypassing Hooks

In rare cases (emergency fixes, work-in-progress commits), you can bypass hooks:

```bash
git commit --no-verify -m "WIP: temporary commit"
```

**Warning:** Use `--no-verify` sparingly. Pre-commit hooks catch issues before they enter the codebase.

## Disabling Hooks

To temporarily disable all hooks:

```bash
export HUSKY=0
git commit -m "message"
```

## Troubleshooting

### Hooks not running

Check Git hooks configuration:
```bash
git config core.hooksPath
# Should output: .husky
```

If not set:
```bash
git config core.hooksPath .husky
```

### lint-staged errors

Run manually to debug:
```bash
cd frontend
npx lint-staged
```

### Permission errors

Ensure hooks are executable:
```bash
chmod +x .husky/pre-commit
chmod +x .husky/_/husky.sh
```

## What Gets Checked

**Staged `.ts` and `.tsx` files only.** The hooks only run on files you're committing, not the entire codebase.

### ESLint Checks

- Tailwind `className` with >5 utilities (custom rule)
- Unused variables
- Explicit `any` types
- Code formatting

### TypeScript Checks

- Type errors
- Missing imports
- Invalid prop types

## Performance

Hooks typically run in **2-5 seconds** for typical commits (1-10 files).

For large commits (20+ files), expect 5-10 seconds.

## Related Documentation

- [frontend/docs/CONTRIBUTING.md](../frontend/docs/CONTRIBUTING.md) - Contribution guidelines
- [frontend/docs/STYLING_GUIDE.md](../frontend/docs/STYLING_GUIDE.md) - Styling architecture
- [CLAUDE.md](../CLAUDE.md) - Project overview
