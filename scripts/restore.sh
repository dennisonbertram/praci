#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:?usage: restore.sh backups/<stamp>}"
compose=(docker compose -f "$ROOT/infra/compose/docker-compose.yml")
# Compose resolves its default env file relative to the compose file, not the
# repo root; point it at the root .env when one exists (vars may also come
# from the environment, so its absence is not an error).
if [[ -f "$ROOT/.env" ]]; then compose=(docker compose --env-file "$ROOT/.env" -f "$ROOT/infra/compose/docker-compose.yml"); fi
"${compose[@]}" up -d postgres
until "${compose[@]}" exec -T postgres pg_isready -U rakazo >/dev/null 2>&1; do
  sleep 1
done
# Roles live outside the dump, and its grants name the runtime role. The API's
# start (`pnpm db:migrate`) gives that role its login and grants afterwards.
"${compose[@]}" exec -T postgres psql -X -U rakazo -d rakazo --set=ON_ERROR_STOP=on -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rakazo_app') THEN CREATE ROLE rakazo_app NOLOGIN; END IF; END \$\$"
# Stop on SQL errors and roll back the dump before restoring files or starting
# the application. -f is required for psql's single-transaction mode.
"${compose[@]}" exec -T postgres psql -X -U rakazo -d rakazo \
  --set=ON_ERROR_STOP=on --single-transaction --file=- < "$SRC/rakazo.sql"
if [[ -f "$SRC/homes.tgz" ]]; then
  if [[ -L "$ROOT/data" ]]; then
    # A symlinked data directory commonly points at a mounted volume. Extract
    # inside its resolved target so tar cannot replace the link with a local
    # directory and leave the configured volume stale.
    if ! data_target="$(cd "$ROOT/data" && pwd -P)"; then
      echo "data symlink target is unavailable" >&2
      exit 1
    fi
    tar -xzf "$SRC/homes.tgz" --strip-components=1 -C "$data_target"
  else
    tar -xzf "$SRC/homes.tgz" -C "$ROOT"
  fi
fi
# Put objects back before the application starts; any failure stops the restore here.
node "$ROOT/scripts/s3-objects.mjs" restore "$SRC" --dotenv "$ROOT/.env"
"${compose[@]}" up -d
echo "Restore complete from $SRC"
