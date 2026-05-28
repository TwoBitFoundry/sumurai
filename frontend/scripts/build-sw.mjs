import { injectManifest } from '@serwist/build';
import { build as esbuild } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import configPromise from '../serwist.config.js';

const { esbuildOptions: _unused, swSrc, ...injectConfig } = await configPromise;

const tempDir = mkdtempSync(join(tmpdir(), 'serwist-'));
const compiledSw = join(tempDir, 'sw.js');

try {
  await esbuild({
    entryPoints: [swSrc],
    bundle: true,
    outfile: compiledSw,
    format: 'iife',
    platform: 'browser',
    target: 'es2017',
  });

  const { count, size, warnings } = await injectManifest({
    ...injectConfig,
    swSrc: compiledSw,
  });

  for (const warning of warnings) {
    console.warn('[serwist]', warning);
  }
  console.log(`[serwist] service worker: ${count} precache entries (${size} bytes)`);
} finally {
  rmSync(tempDir, { recursive: true });
}
