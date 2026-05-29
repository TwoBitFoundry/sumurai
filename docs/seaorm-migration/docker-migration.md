# Database migration (Docker Compose)

Schema work runs through Docker Compose. The **backend** container runs database migration automatically on every start — before `sumurai-backend` — via `/app/docker-entrypoint.sh` → `/app/docker-migrate.sh`. No separate service or command is required.

After migration completes, the backend applies any pending SeaORM revisions at startup (`Migrator::up` in `backend/src/main.rs`).

Local defaults: compose file `docker-compose.dev.yml`, project `sumurai`, database `accounting`, Postgres volume `sumurai_postgres_data`, migration artifacts volume `sumurai_migration_artifacts`.

## Start the stack

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Migration runs as part of backend startup. Check logs:

```bash
docker compose -f docker-compose.dev.yml logs backend
```

Optional read-only pre-check on a live legacy volume:

```bash
./docs/seaorm-migration/phase5-validate.sh
```

## What runs on backend start

| Detected state | Action |
|---|---|
| **already_seaorm** | Skip cutover — backend applies pending migrations; writes `.seaorm-ready` marker |
| **empty** (no legacy tables) | Run `/app/migration up` (`_init`) |
| **legacy** (`_sqlx_migrations` or pre-SeaORM data) | Full cutover (below) |

### Legacy cutover sequence

1. **Full snapshot** → `migration_artifacts` volume: `sumurai-pre-cutover-<timestamp>.dump`
2. **Data-only export** → `sumurai-data-<timestamp>.sql`; records user/transaction row counts
3. **Drop and recreate** the `accounting` database
4. **SeaORM schema** → `/app/migration up`
5. **Restore data** from the data-only dump
6. **Verify** row counts, `seaql_migrations` present, `_sqlx_migrations` absent

Symlinks on the artifacts volume: `sumurai-pre-cutover-latest.dump`, `sumurai-data-latest.sql`.

### Automatic rollback

If any step fails after the database is dropped (step 3 onward), the script restores the step-1 snapshot via `pg_restore` and **exits non-zero** so the backend process does not start.

Inspect artifacts:

```bash
docker compose -f docker-compose.dev.yml exec backend ls -la /var/lib/sumurai/migration
```

Copy a snapshot off the volume for offsite backup before upgrading production.

## Apply a new SeaORM migration (schema PR)

After the database is on SeaORM, add incremental migrations in Rust — **no cutover**:

1. Create `backend/migration/src/m<YYYYMMDD>_<name>.rs` and register it in `backend/migration/src/lib.rs`.
2. Apply via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml logs backend | tail -20
```

Cutover detection is a fast no-op when already on SeaORM; the backend runs `Migrator::up` for new revisions. After the first successful check, a `.seaorm-ready` marker on the `migration_artifacts` volume skips migration checks on subsequent backend restarts (with a lightweight verify that the database is still on SeaORM).

3. Regenerate entities (one-off container on the compose network):

```bash
POSTGRES_PASSWORD="$(docker inspect sumurai-postgres-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p' | head -1)"
NETWORK="$(docker inspect sumurai-postgres-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1)"

docker run --rm --network "${NETWORK}" \
  -v "$(pwd)/backend/entity/src:/out" \
  rust:1.95-slim \
  bash -lc "cargo install sea-orm-cli --locked -q && sea-orm-cli generate entity \
    --database-url 'postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/accounting' \
    --output-dir /out --entity-format dense"
```

4. Update `repository_service.rs` / `conversions.rs` and run `cargo test --manifest-path backend/Cargo.toml --locked`.

Migration source skeleton and query patterns: [CONTRIBUTING.md — Working with the database](../../CONTRIBUTING.md#working-with-the-database).

## Manual rollback

After a **successful** cutover, restore from the pre-cutover snapshot:

```bash
docker compose -f docker-compose.dev.yml stop backend frontend
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'accounting' AND pid <> pg_backend_pid();"
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS accounting;"
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c "CREATE DATABASE accounting;"
docker compose -f docker-compose.dev.yml exec backend sh -c \
  'pg_restore -d "$DATABASE_URL" --no-owner --no-privileges < /var/lib/sumurai/migration/sumurai-pre-cutover-latest.dump'
docker compose -f docker-compose.dev.yml up -d
```

Adapt for managed Postgres if you are not using Docker volumes.

## Production

Use `docker-compose.prod.yml` (or `docker-compose.yml` for OSS). The backend entrypoint runs the same migration logic before the API starts. Store the pre-cutover snapshot offsite before the first deploy that includes the SeaORM backend.
