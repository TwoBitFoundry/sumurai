import { checkDesignTokenDrift } from './design-token-pipeline.mjs';

try {
  checkDesignTokenDrift();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
