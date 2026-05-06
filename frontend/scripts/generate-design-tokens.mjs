import { generateDesignTokens } from './design-token-pipeline.mjs';

try {
  generateDesignTokens();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
