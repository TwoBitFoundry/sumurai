# SeaORM cutover runbook

**Use [docker-migration.md](docker-migration.md)** — cutover runs automatically when the backend container starts (`docker compose up`).

## When this applies

| Database state | What happens on `docker compose up` |
|---|---|
| Empty / new volume | Backend entrypoint applies `_init` |
| Already on SeaORM | Backend entrypoint skips cutover; `Migrator::up` applies pending migrations |
| Legacy SQLx schema with data | Backend entrypoint snapshots, cutovers, restores data; API starts on success |

## Pre-cutover checklist

1. Build and test the SeaORM backend image locally.
2. Read-only backup sanity check (does not modify the volume):

```bash
./docs/seaorm-migration/phase5-validate.sh
```

3. Schedule a maintenance window. Postgres must be available; the app cannot serve traffic until backend startup completes.

## Run cutover

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml logs backend
```

On failure after the database drop, the entrypoint restores the pre-cutover snapshot and the backend container exits. Fix the error and retry.

Copy `sumurai-pre-cutover-latest.dump` off the `migration_artifacts` volume before production cutover. See [docker-migration.md — Manual rollback](docker-migration.md#manual-rollback).

After cutover, day-to-day schema changes follow [CONTRIBUTING.md — Add a migration](../../CONTRIBUTING.md#add-a-migration).
