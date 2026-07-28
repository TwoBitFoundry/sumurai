import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../../..');
const frontendDockerfile = path.join(repoRoot, 'frontend/Dockerfile');
const backendDockerfile = path.join(repoRoot, 'backend/Dockerfile');
const bunfigPath = path.join(repoRoot, 'bunfig.toml');

function readDockerfile(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('bun migration dockerfiles', () => {
  it('backend/Dockerfile uses workspace-root cargo-chef and manifest-only planner', () => {
    const contents = readDockerfile(backendDockerfile);

    expect(contents).toContain('COPY rust-toolchain.toml Cargo.toml Cargo.lock ./');
    expect(contents).toContain('COPY backend/Cargo.toml backend/Cargo.toml');
    expect(contents).toContain('cargo chef prepare --recipe-path recipe.json');
    expect(contents).toContain('cargo chef cook --release --locked --recipe-path recipe.json');
    expect(contents).toContain('cargo build --release --locked -p sumurai-backend -p migration');
    expect(contents).not.toContain('COPY backend/ ./backend/\nRUN cargo chef prepare');
  });

  it('frontend/Dockerfile uses Bun workspace root install and lockfile', () => {
    const contents = readDockerfile(frontendDockerfile);
    const bunfig = fs.readFileSync(bunfigPath, 'utf8');

    expect(contents.startsWith('# syntax=docker/dockerfile:1.7\n')).toBe(true);
    expect(contents).toContain('FROM oven/bun:1.3.14-alpine AS builder');
    expect(contents).toContain('COPY package.json bun.lock bunfig.toml ./');
    expect(bunfig).toBe('[install]\nlinker = "hoisted"\n');
    expect(contents).toContain('COPY frontend/package.json ./frontend/');
    expect(contents).toContain('RUN --mount=type=cache,target=/root/.bun/install/cache bun ci');
    expect(contents).toContain('COPY DESIGN.md /app/DESIGN.md');
    expect(contents).toContain('bun run design:generate');
    expect(contents).toContain('bun run build');
    expect(contents).not.toMatch(/\bnode:/);
    expect(contents).not.toMatch(/\bnpm /);
  });
});
