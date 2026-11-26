#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="${1:-$(date +%Y%m%d-%H%M%S)}"
OUT="${ROOT}/backups/${STAMP}"
compose=(docker compose -f "$ROOT/infra/compose/docker-compose.yml")
# Compose resolves its default env file relative to the compose file, not the
# repo root; point it at the root .env when one exists (vars may also come
# from the environment, so its absence is not an error).
if [[ -f "$ROOT/.env" ]]; then compose=(docker compose --env-file "$ROOT/.env" -f "$ROOT/infra/compose/docker-compose.yml"); fi
mkdir -p "$OUT"
"${compose[@]}" exec -T postgres pg_dump -U rakazo rakazo > "$OUT/rakazo.sql"
if [[ "${RAKAZO_BACKUP_SKIP_HOMES:-0}" == "1" ]] || [[ ! -e "$ROOT/data" && ! -L "$ROOT/data" ]]; then
  tar -czf "$OUT/homes.tgz" --files-from /dev/null
else
  [[ -d "$ROOT/data" ]] || { echo "data is not a directory" >&2; exit 1; }
  if [[ -L "$ROOT/data" ]]; then
    # `data` is a symlink (e.g. to a mounted volume): archiving the name itself
    # stores only the link, an empty backup of the state that matters most. List
    # its contents through the link instead — find -H follows just the named
    # argument — so members keep `data/` names while interior links stay links
    # rather than dragging outside trees into the archive. The leading `data/.`
    # stores `data` as a plain directory member even when the target is empty;
    # bsdtar refuses to extract children through a link member, so the link
    # itself must not be archived.
    {
      printf 'data/.\0'
      cd "$ROOT" && find -H data -mindepth 1 -print0
    } | tar -C "$ROOT" -czf "$OUT/homes.tgz" --no-recursion --null --files-from -
  else
    tar -czf "$OUT/homes.tgz" -C "$ROOT" data
  fi
fi
# Object storage (RAKAZO_S3_*): exports every object, or skips when none is configured.
node "$ROOT/scripts/s3-objects.mjs" backup "$OUT" --dotenv "$ROOT/.env"
echo "Backup written to $OUT"
