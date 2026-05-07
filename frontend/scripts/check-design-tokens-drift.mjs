import { checkDesignTokenDrift } from './design-token-pipeline.mjs';

try {
  checkDesignTokenDrift();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write(
    'Tokens must match DESIGN.md.\n' +
      'Edited DESIGN.md?\n' +
      '  no → git pull --rebase origin main\n' +
      'Run: npm --prefix frontend run design:generate\n' +
      'Stage: frontend/src/ui/tokens/generated/\n',
  );
  process.exit(1);
}
