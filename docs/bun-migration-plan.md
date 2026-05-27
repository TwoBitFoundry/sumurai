# Migrate from npm to Bun (runtime, tests, build)

> **Handoff target:** an implementer who has not seen prior planning. Repo-root for all relative paths: `/Users/kodybuss/Repos/two-bit-foundry/sumurai`. Branch: `feat/bun-migration` (currently in sync with `main`, no work yet). Bun 1.3.14 is installed locally.

## Context

This repo currently uses npm 24 + Node 24.10 as the package manager, script runner, **JavaScript runtime**, and test runner. We are replacing npm/Node with Bun for **install, the Bun runtime under `next dev` / `next build` / `next start` and the design-token scripts, Jest tests (→ `bun test`), and the production frontend build**. Storybook stays on vitest + Node — `vitest --project=storybook run`, `storybook dev`, `storybook build`, and the Playwright Storybook smoke run are invoked via `bun run` (package manager) but execute under Node via their bin shebangs.

**Confirmed decisions:**
- Replace Jest with `bun test` (not just keep Jest under `bun run`).
- Run Next.js itself under Bun's runtime via `bun --bun next …` in every relevant script.
- Run the `frontend/scripts/*.mjs` design-token scripts under Bun (`bun ./scripts/X.mjs`, not `node ./scripts/X.mjs`).
- Do **not** set `[run] bun = true` globally — that would force Storybook under Bun too.
- Frontend Dockerfile builder stage switches to `oven/bun:1-alpine` (which has no `node` binary — another reason design scripts must invoke `bun`).
- The legacy root `Dockerfile` is migrated too (not deleted).
- Storybook + vitest + Playwright Storybook smoke run stay on Node.

**Reference (Bun 1.3):** `bun ci` = `bun install --frozen-lockfile`. Default lockfile is text-based `bun.lock` (since 1.2). `oven-sh/setup-bun@v2` is the GitHub Action. `oven/bun:1-alpine` is the slim Docker base. **jsdom does not work in Bun (V8-specific internals); happy-dom is the supported DOM environment.**

---

## Phase 1 — Lockfile + scripts + Bun runtime

**Goal:** Replace npm lockfiles with `bun.lock`, rewrite every `package.json` script to use bun, and **migrate Next.js (`next dev` / `next build` / `next start`) and the design-token scripts to execute under Bun's runtime** instead of Node. Storybook and the Playwright Storybook smoke run stay on Node (per their bin shebangs) — do **not** flip a global runtime override that would drag them in.

**Runtime-migration approach:**
- For Next.js commands, use the explicit `bun --bun next …` form in each script. The `--bun` flag forces Bun's runtime even though the `next` bin has a `#!/usr/bin/env node` shebang. (Source: [Bun docs — `--bun` flag](https://bun.com/docs/runtime#run-a-package-json-script).)
- For the design scripts, change `node ./scripts/X.mjs` to `bun ./scripts/X.mjs` — invokes Bun's runtime directly, no shebang override needed. This is **required** for the Docker builder (Phase 4) because `oven/bun:1-alpine` has no `node` binary.
- For Biome (`biome check …`) and TypeScript (`tsc --noEmit …`) — leave as-is. Biome is a Rust binary; `tsc` doesn't care about its host runtime. They run under whatever invokes them.
- Do **not** add `[run] bun = true` to `bunfig.toml` — that would force the Storybook CLI under Bun's runtime too, violating the "leave Storybook alone" constraint.

**Tasks:**
- Delete `package-lock.json` (root) and `frontend/package-lock.json`.
- Run `bun install` at repo root and again in `frontend/`. Commit the generated `bun.lock` and `frontend/bun.lock`.
- In **root `package.json`** rewrite every `npm --prefix frontend run X` to `bun --cwd frontend run X`. `frontend:ci` becomes `bun --cwd frontend ci && bun --cwd frontend run lint && bun --cwd frontend run typecheck && bun --cwd frontend run design:guard && bun --cwd frontend run test:ci && bun --cwd frontend run build && bun --cwd frontend run playwright:install-ci && bun --cwd frontend run test:storybook && bun --cwd frontend run storybook:build && bun --cwd frontend run test:storybook-runtime:run`. `rust:lint`, `backend:ci`, `precommit` chains use `bun run` instead of `npm run`. Keep `release` as `semantic-release`.
- In **`frontend/package.json`** rewrite scripts as follows:
  - `dev`: `bun --bun next dev -p 3001 --turbo`
  - `dev:webpack`: `bun --bun next dev -p 3001 --webpack`
  - `build`: `bun --bun next build --webpack`
  - `start`: `bun --bun next start`
  - `typecheck`: unchanged (`tsc --noEmit --project tsconfig.ci.json`)
  - `lint`, `lint:verbose`, `format`, `check`: unchanged (Biome — Rust binary)
  - `test*`: stay as `jest …` in Phase 1; Phase 2 swaps these to `bun test`.
  - All `design:*` and `ui:imports` scripts: change `node ./scripts/X.mjs` → `bun ./scripts/X.mjs`. Same for the chained `design:guard`.
  - `precommit`: `bun run lint && bun run typecheck && bun run design:guard && bun run test`
  - **Storybook + Playwright scripts unchanged**: `storybook`, `storybook:doctor`, `storybook:build`, `test:storybook`, `test:storybook:watch`, `playwright:install`, `playwright:install-ci`, `test:storybook-runtime:run` all stay literal (`storybook dev …`, `vitest …`, `playwright …`). `test:storybook-runtime` becomes `bun run storybook:build && bun run test:storybook-runtime:run`.
- Add `"bun": ">=1.3.14"` to `engines` in both `package.json` files. Keep the existing `node` floor — semantic-release and `tsc` still benefit from a Node presence, and CI runners have Node preinstalled.
- Verify `frontend/scripts/run-designmd.mjs` still works under bun (it reads `npm_config_*` env vars; bun sets compatible ones for `bun run`). If it breaks, add a minimal env shim — do NOT rewrite the script.

**Next.js + Bun runtime caveats (read before debugging):**
- Bun's runtime aims for Node compatibility but some Next.js plugins probe `process.versions.node`. If you see a crash from `react-compiler` or the Serwist PWA wrapper in `next.config.mjs`, set `NEXT_DISABLE_REACT_COMPILER=true` (already set in the Dockerfile) and check Bun's GitHub issue tracker before falling back to Node.
- Turbopack is a Rust binary that runs as a child of `next dev`. It works the same under Bun as under Node.
- If `bun --bun next dev` hangs or fails for an environmental reason, **the fallback is plain `next dev`** (Node) — but report this; do not silently revert.

**Acceptance criteria:**
- [x] `package-lock.json` and `frontend/package-lock.json` deleted; `bun.lock` and `frontend/bun.lock` committed.
- [x] `git grep -nE '\bnpm (ci|install|run|--prefix) '` returns no matches under `package.json`, `frontend/package.json` (CI/Docker/husky are touched in later phases).
- [x] `git grep -nE '^\s*"[^"]+":\s*"node \./scripts/' frontend/package.json` returns no matches (all design scripts use `bun ./scripts/...`).
- [x] Every `next` invocation in `frontend/package.json` is prefixed with `bun --bun ` (verify: `grep -E '"(dev|dev:webpack|build|start)"' frontend/package.json | grep -v 'bun --bun next'` returns nothing).
- [x] `bun --cwd=frontend run dev` boots Next.js dev server on port 3001 **and** `curl -s http://localhost:3001 | head` returns HTML. While dev is running, `ps -ef | grep -E 'next-server|next dev'` shows `bun --bun next dev` as the parent of the `next` child. Stop the server after verifying.
- [x] `bun --cwd=frontend run lint` passes.
- [x] `bun --cwd=frontend run typecheck` passes.
- [x] `bun --cwd=frontend run design:guard` passes (this exercises the `bun ./scripts/*.mjs` invocations end-to-end).
- [x] `bun --cwd=frontend run build` produces `frontend/out/` (Next.js static export). Build invoked via `bun --bun next build`.
- [x] `bun --cwd=frontend run test` still runs Jest and passes (730 tests; test migration is Phase 2).
- [x] `bun --cwd=frontend run test:storybook` passes — vitest runs under Node (deprecation output references `node`).
- [x] `bun --cwd=frontend run storybook:build` produces `storybook-static/`.

**Phase 1 notes:** Bun 1.3.14 requires `--cwd=frontend` (equals form); `bun --cwd frontend run …` (space) is misparsed and prints help. Root `package.json` uses `bun --cwd=frontend run …`. `run-designmd.mjs` works under Bun without env shim.

**Phase 1 TDD log:** No new tests (script/lockfile migration). Verification: `bun run lint`, `typecheck`, `design:guard`, `test` (134 suites / 730 tests), `build`, `test:storybook`, `storybook:build`, dev server curl + process check — all passed.

---

## Phase 2 — Jest → `bun test`

**Goal:** Migrate the 134 frontend test files from Jest to Bun's native test runner. Drop jsdom (incompatible with Bun) for happy-dom. Replace `next/jest` preset + `identity-obj-proxy` + Jest `moduleNameMapper` with Bun's tsconfig-paths + a small preload file. Storybook tests stay on vitest.

**Tasks:**
- Add `@happy-dom/global-registrator` to `frontend/devDependencies` via `bun add -d @happy-dom/global-registrator`.
- Remove from `frontend/devDependencies`: `jest`, `jest-environment-jsdom`, `@types/jest`, `identity-obj-proxy` (run `bun remove ...`).
- Delete `frontend/jest.config.cjs`.
- Create `frontend/bunfig.toml`:
  ```toml
  [test]
  preload = ["./tests/setup/bun-dom.ts", "./tests/setup.ts"]
  pathIgnorePatterns = ["tests/visual/**", ".next/**", "node_modules/**"]
  ```
- Create `frontend/tests/setup/bun-dom.ts`:
  ```ts
  import { GlobalRegistrator } from "@happy-dom/global-registrator";
  import { plugin } from "bun";

  GlobalRegistrator.register();

  // ResizeObserver shim — happy-dom doesn't implement it.
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // matchMedia shim — happy-dom returns null without this.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // CSS module stub — replaces identity-obj-proxy.
  plugin({
    name: "css-stub",
    setup(build) {
      build.onLoad({ filter: /\.(css|scss|sass|less)$/ }, () => ({
        exports: { default: new Proxy({}, { get: (_, k) => String(k) }) },
        loader: "object",
      }));
    },
  });
  ```
- Keep `frontend/tests/setup.ts` as-is — `@testing-library/jest-dom` matchers work under `bun:test`, `jest.fn()` exists as a shim.
- Verify `frontend/tsconfig.json` paths cover `@/*`, `@tests/*`, `@docs/*`. Bun resolves tsconfig paths natively; the previous `moduleNameMapper` entries are no longer needed. If `@docs/*` (resolves outside `frontend/`) doesn't load, extend `tsconfig.json` `paths` rather than adding a `bunfig.toml` alias.
- Update `frontend/package.json` test scripts: `test` → `bun test`, `test:ci` → `bun test --ci`, `test:serial` → `bun test --jobs 1`, `test:verbose` → `bun test --jobs 1 --verbose`.
- Run `bun test` and fix failures in waves. Triage order: `tests/utils` → `tests/services` → `tests/hooks` → `tests/components` → `tests/views` → `tests/features`. Most files should pass unchanged. Expected hot spots:
  - Files using `next/navigation`, `next/router`, `next/image`, `next/link` — if a test fails on these, add a `mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }))` (or similar) inside the test file or extend `bun-dom.ts` with broad mocks.
  - Files using `jest.requireActual` — replace with `await import(...)` plus `mock.module`.
  - Files using `jest.mock(path, factory)` with hoisting — use `bun:test`'s `mock.module(path, factory)`.
- Do **not** touch `frontend/vitest.config.ts`, `frontend/.storybook/vitest.setup.ts`, `frontend/playwright.storybook-runtime.config.ts`, or any `*.stories.*` files.

**Acceptance criteria:**
- [x] `frontend/jest.config.cjs` deleted.
- [x] `frontend/bunfig.toml` and `frontend/tests/setup/bun-dom.ts` exist.
- [x] `jest`, `jest-environment-jsdom`, `@types/jest`, `identity-obj-proxy` no longer in `frontend/package.json`.
- [x] `@happy-dom/global-registrator` in `frontend/devDependencies`.
- [x] `bun --cwd=frontend run test` runs `bun test` and exits 0.
- [x] `bun --cwd=frontend run test:ci` exits 0 with no `jest` invocation.
- [x] `bun --cwd=frontend run test:storybook` still passes (vitest path untouched).
- [x] Test count under `bun test` ≥ test count under previous `jest` run (no silently skipped suites). Spot-check with `bun test --verbose | tail -50`.

**Phase 2 notes:** Preload chain is `bun-globals.ts` → `bun-dom.ts` → `setup.ts`. Test scripts use `bun test --parallel` (~3.5s for 730 tests). Drawer exit tests use `tests/utils/programmaticTimers.ts` (fake timers + `animationEnd`). Heavy mocks (recharts, framer-motion) moved to side-effect imports under `tests/mocks/`. `bun-types` is a devDependency referenced from `bun-globals.ts`; main `tsconfig.json` keeps `"types": ["node"]` so Storybook typecheck is unaffected.

**Phase 2 TDD log:** Migrated 134 suites / 730 tests to `bun:test` with happy-dom. Verification: `bun test --ci --parallel`, `test:storybook` (vitest unchanged). Commit `208ba480`.

---

## Phase 3 — Husky + release plumbing

**Goal:** Make the git pre-commit hook and semantic-release publish flow use bun. Replace the npm-lockfile-specific update logic in the version-sync script with `bun install --lockfile-only`.

**Tasks:**
- Update `.husky/pre-commit`:
  ```sh
  #!/usr/bin/env sh
  set -e

  bun --cwd frontend run precommit
  bun run backend:ci
  ```
- Edit `scripts/sync-release-version.mjs`:
  - Remove the two lines: `await updateJson(path.join(root, 'package-lock.json'));` and `await updateJson(path.join(root, 'frontend', 'package-lock.json'));`.
  - Append at the end (after the Cargo updates):
    ```js
    import { execFile } from 'node:child_process';
    import { promisify } from 'node:util';
    const exec = promisify(execFile);
    await exec('bun', ['install', '--lockfile-only'], { cwd: root });
    await exec('bun', ['install', '--lockfile-only'], { cwd: path.join(root, 'frontend') });
    ```
    (Or use top-level await with `node:child_process` imports moved to the top of the file.)
- Edit `.releaserc.json` — replace the `@semantic-release/git` assets array with:
  ```json
  "assets": [
    "package.json",
    "bun.lock",
    "frontend/package.json",
    "frontend/bun.lock",
    "backend/Cargo.toml",
    "backend/Cargo.lock"
  ]
  ```

**Acceptance criteria:**
- [x] `.husky/pre-commit` contains no `npm` invocations.
- [x] `scripts/sync-release-version.mjs` does not reference `package-lock.json`.
- [x] `.releaserc.json` assets list contains `bun.lock` and `frontend/bun.lock`, no `*-lock.json`.
- [x] Manual dry-run: `node scripts/sync-release-version.mjs 99.99.99` updates both `package.json` files, both `bun.lock` files, and the Cargo files; `git diff` shows version bumps only. **Revert the diff after testing** (`git checkout -- package.json frontend/package.json bun.lock frontend/bun.lock backend/Cargo.toml backend/Cargo.lock`).
- [ ] `git commit` against any staged change triggers `.husky/pre-commit` and runs `bun --cwd frontend run precommit && bun run backend:ci` to completion.

**Phase 3 TDD log:** Added `frontend/tests/scripts/sync-release-version.test.ts` (husky, releaserc assets, sync script contract). Dry-run verified version bumps + lockfile refresh; reverted test versions.

---

## Phase 4 — Dockerfiles

**Goal:** Swap the Node-based builder stage in both Dockerfiles for `oven/bun:1-alpine`. Add a BuildKit cache mount so `bun ci` is fast across rebuilds. The runtime nginx stage is unchanged.

**Tasks:**
- Edit `frontend/Dockerfile`:
  - Add `# syntax=docker/dockerfile:1.7` as the **first line**.
  - Change `FROM node:24-alpine AS builder` → `FROM oven/bun:1-alpine AS builder`.
  - Change `COPY frontend/package.json frontend/package-lock.json ./` → `COPY frontend/package.json frontend/bun.lock ./`.
  - Change `RUN npm ci` → `RUN --mount=type=cache,target=/root/.bun/install/cache bun ci`.
  - Change `RUN npm run build` → `RUN bun run build`.
  - Leave the nginx runtime stage and `COPY --from=builder /app/frontend/out ...` exactly as-is.
- Apply the same edits to the root-level `Dockerfile` (legacy, currently `node:20-alpine`).
- Local build verification:
  ```bash
  docker build -f frontend/Dockerfile -t sumurai-frontend:bun-test .
  docker run --rm sumurai-frontend:bun-test sh -c 'ls /usr/share/nginx/html | head'
  ```

**Acceptance criteria:**
- [ ] Both Dockerfiles start with `# syntax=docker/dockerfile:1.7`.
- [ ] Neither Dockerfile contains `node:` or `npm ` (a trailing space — to ignore words like `npm-style`).
- [ ] `docker build -f frontend/Dockerfile .` succeeds locally.
- [ ] The built image's `/usr/share/nginx/html` contains `index.html` and the Next.js asset chunks (compare `find /usr/share/nginx/html -type f | wc -l` against a node-built baseline — should be within ±2 files).
- [ ] Running the image and `curl -fsS http://localhost:8080/` returns the index page (test via `docker compose -f docker-compose.dev.yml up --build frontend` and hit `http://localhost:8080`).

---

## Phase 5 — CI workflows

**Goal:** Update `ci.yml` and `semantic-release.yml` to use `oven-sh/setup-bun@v2` and bun commands. Rekey the Playwright browser cache off the Playwright version (not the lockfile hash). `publish-images.yml` needs no edits.

**Caching summary** (don't re-engineer — this is the chosen design):

| Cache | Library | Key |
|---|---|---|
| Bun install cache (`~/.bun/install/cache`) | `oven-sh/setup-bun@v2` (built-in) | auto: `bun.lock` hash |
| Playwright browsers (`frontend/.playwright-browsers`) | `actions/cache@v4` | Playwright version |
| Docker layers + cache mounts | `docker/build-push-action@v7` `type=gha,mode=max` | per-arch scope (already configured) |

**Tasks:**
- Edit `.github/workflows/ci.yml`, frontend job — replace the existing "Setup Node.js" + "Install dependencies" steps and bring the rest of the steps in line. The full step list for the frontend job:
  ```yaml
  - name: Checkout
    uses: actions/checkout@v6

  - name: Setup Bun
    uses: oven-sh/setup-bun@v2
    with:
      bun-version: 1.3.14

  - name: Install dependencies
    run: bun ci

  - name: Biome check (format + lint)
    run: bun run lint
  - name: Type check
    run: bun run typecheck
  - name: Design guard
    run: bun run design:guard
  - name: Unit tests
    run: bun test --ci
  - name: Production build
    run: bun run build

  - name: Resolve Playwright version
    id: pw
    run: echo "version=$(bun -e 'console.log(require(\"@playwright/test/package.json\").version)')" >> "$GITHUB_OUTPUT"

  - name: Cache Playwright Chromium
    uses: actions/cache@v4
    with:
      path: frontend/.playwright-browsers
      key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}
      restore-keys: |
        playwright-${{ runner.os }}-

  - name: Install Playwright Chromium
    run: bunx playwright install chromium --with-deps

  - name: Storybook Vitest
    run: bun run test:storybook
  - name: Storybook static build
    run: bun run storybook:build
  - name: Storybook iframe smoke
    run: bun run test:storybook-runtime:run
  ```
  Keep the existing `env: PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/frontend/.playwright-browsers` and `defaults.run.working-directory: frontend` on the job. The `changes` job and `backend` job are unchanged.
- Edit `.github/workflows/semantic-release.yml` — replace `Setup Node` and `Install dependencies` steps:
  ```yaml
  - name: Setup Bun
    uses: oven-sh/setup-bun@v2
    with:
      bun-version: 1.3.14

  - name: Install dependencies
    run: bun ci
  ```
  Replace `npm run release` inside the `Run Semantic Release` step with `bun run release`. Keep `HUSKY: "0"` env var. Keep the rest of the workflow.
- `.github/workflows/publish-images.yml` — no edits. It's pure Docker and references no npm.

**Acceptance criteria:**
- [ ] `git grep -n 'actions/setup-node\|npm ci\|npm run\|npx ' .github/workflows/` returns no matches.
- [ ] `.github/workflows/ci.yml` frontend job uses `oven-sh/setup-bun@v2` with `bun-version: 1.3.14`.
- [ ] Playwright cache key in `ci.yml` references `steps.pw.outputs.version`, not `hashFiles(...)`.
- [ ] `.github/workflows/semantic-release.yml` runs `bun ci` and `bun run release`.
- [ ] Draft PR opened from `feat/bun-migration` — `frontend` job in `ci.yml` goes green on first run.
- [ ] Second CI run on the same PR shows Bun install cache hit (visible in setup-bun step logs) and Playwright cache hit (visible in `actions/cache` step).

---

## Verification (run after Phase 5)

Local — each must pass before declaring done:

```bash
bun --version                                    # 1.3.14+
git status                                       # clean
ls package-lock.json frontend/package-lock.json  # both absent
ls bun.lock frontend/bun.lock                    # both present

bun --cwd frontend run lint
bun --cwd frontend run typecheck
bun --cwd frontend run design:guard
bun --cwd frontend run test
bun --cwd frontend run build
bun --cwd frontend run test:storybook
bun --cwd frontend run storybook:build
bun --cwd frontend run test:storybook-runtime:run
bun run backend:ci
```

UI smoke (CLAUDE.md says: always validate at the nginx-backed `:8080`, never the raw Next dev port):

```bash
docker compose -f docker-compose.dev.yml up --build frontend
# Open http://localhost:8080 — verify login screen renders, navigation works.
```

CI: open a draft PR from `feat/bun-migration`. Confirm green on both `ci.yml` and `semantic-release.yml`. After a second push, verify cache hits in the setup-bun step and Playwright cache step.

Rollback: branch is feature-isolated; revert is `git revert` of the merge commit. `bun.lock` is human-readable text, so the lockfile diff is reviewable.

---

## Out of scope (do not attempt in this PR)

- Storybook test framework (stays vitest, runs under Node via its bin shebang).
- Backend Rust toolchain (untouched).
- Rewriting `frontend/scripts/run-designmd.mjs` beyond confirming it runs under bun.
- Adding `.next/cache` to CI cache (separate optimization).
