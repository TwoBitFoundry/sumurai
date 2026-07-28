# Git Hooks Setup

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook automatically runs the repository precommit checks before each commit:

1. **Frontend** - Runs Biome, TypeScript, the design guard, unit tests, and the production build
2. **Backend** - Runs formatting, type checks, Clippy, and tests

## Configuration

- **Hook location**: `.husky/pre-commit`
- **Root command**: `package.json` → `precommit`
- **Frontend command**: `frontend/package.json` → `precommit`

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

### Pre-commit errors

Run the same command manually from the repository root:
```bash
bun run precommit
```

### Permission errors

Ensure hooks are executable:
```bash
chmod +x .husky/pre-commit
chmod +x .husky/_/husky.sh
```

## What Gets Checked

The hook checks the frontend and backend workspaces, not only staged files.

### Frontend Checks

- Biome formatting and linting
- TypeScript type checking
- Design-system guardrails
- Unit tests
- Production build

### Backend Checks

- Rust formatting
- Workspace type checking
- Clippy
- Backend and CLI tests

## Related Documentation

- [frontend/docs/CONTRIBUTING.md](../frontend/docs/CONTRIBUTING.md) - Contribution guidelines
- [frontend/docs/STYLING_GUIDE.md](../frontend/docs/STYLING_GUIDE.md) - Styling architecture
- [CLAUDE.md](../CLAUDE.md) - Project overview
