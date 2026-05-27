import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../..');
const frontendDockerfile = path.join(repoRoot, 'frontend/Dockerfile');
const rootDockerfile = path.join(repoRoot, 'Dockerfile');

function readDockerfile(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('bun migration dockerfiles', () => {
  it.each([
    ['frontend/Dockerfile', frontendDockerfile],
    ['Dockerfile', rootDockerfile],
  ])('%s uses Bun builder stage and lockfile', (_label, filePath) => {
    const contents = readDockerfile(filePath);

    expect(contents.startsWith('# syntax=docker/dockerfile:1.7\n')).toBe(true);
    expect(contents).toContain('FROM oven/bun:1-alpine AS builder');
    expect(contents).toContain('COPY frontend/package.json frontend/bun.lock ./');
    expect(contents).toContain('RUN --mount=type=cache,target=/root/.bun/install/cache bun ci');
    expect(contents).toContain('RUN bun run build');
    expect(contents).not.toMatch(/\bnode:/);
    expect(contents).not.toMatch(/\bnpm /);
  });
});
