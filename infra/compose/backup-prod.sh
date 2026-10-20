#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${RAKAZO_DEPLOY_DIR:-/srv/rakazo}"
[[ "${PROJECT_DIR}" == /* ]] || { echo "RAKAZO_DEPLOY_DIR must be an absolute path" >&2; exit 1; }
COMPOSE_FILE="${PROJECT_DIR}/infra/compose/docker-compose.prod.yml"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_ROOT="/var/backups/rakazo"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT_DIR="${BACKUP_ROOT}/${STAMP}"

install -d -m 700 "${BACKUP_ROOT}" "${SNAPSHOT_DIR}"

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

"${compose[@]}" exec -T postgres sh -c \
  'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "${SNAPSHOT_DIR}/rakazo.dump"

# Archive the appdata volume from the host, not through `compose exec api`.
#
# The api image runs as `USER node` (uid 1000) with `cap_drop: ALL`, while the
# supervisor creates each bot computer's home under /data as root with mode 600
# (receipts, taught skills, connector tokens). Inside a cap-dropped container
# uid 1000 cannot read those files, so `tar` exits 2 and the archive it leaves
# behind is missing exactly the bot state a restore needs. Root on the host has
# CAP_DAC_OVERRIDE and reads all of it.
#
# Ask the running container where /data actually is, rather than rebuilding the
# volume name from a project name. `compose config` reports this file's `name:`
# key and ignores an operator's `-p` or COMPOSE_PROJECT_NAME, so reconstructing
# "<project>_appdata" would inspect the default project's volume on any stack
# started under another name, and silently archive the wrong one. This uses the
# same compose invocation as the pg_dump above, so both target one stack.
api="$("${compose[@]}" ps -q api)"
[[ -n "${api}" ]] || { echo "the api service is not running; cannot locate /data" >&2; exit 1; }
appdata="$(docker inspect "${api}" \
  --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}')"
[[ -n "${appdata}" ]] || { echo "the api container has no /data mount" >&2; exit 1; }

# Bots write while this runs. GNU tar exits 1 for "file changed as we read it",
# which is expected on a live system and still yields a usable archive; only a
# fatal error (2) fails the backup.
rc=0
tar -czf "${SNAPSHOT_DIR}/appdata.tgz" --numeric-owner -C "${appdata}" . || rc=$?
if [[ "${rc}" -gt 1 ]]; then
  echo "appdata archive failed with tar exit ${rc}" >&2
  exit "${rc}"
fi

# Object storage. Run the Node script in a throwaway copy of the api image that shares the api
# container's network (so the bundled store's service name resolves) and gets the api's own
# RAKAZO_S3_* settings through a process-substitution env file, so no secret reaches argv, disk, or
# the snapshot. With no RAKAZO_S3_* set on the api, there is nothing to export.
s3_env="$(docker inspect "${api}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^RAKAZO_S3_' || true)"
if [[ -n "${s3_env}" ]]; then
  image="$(docker inspect "${api}" --format '{{.Image}}')"
  docker run --rm --network "container:${api}" --user "$(id -u):$(id -g)" \
    --cap-drop ALL --security-opt no-new-privileges --read-only \
    --entrypoint node \
    -v "${PROJECT_DIR}/scripts/s3-objects.mjs:/s3-objects.mjs:ro" \
    -v "${SNAPSHOT_DIR}:/out" \
    --env-file <(printf '%s\n' "${s3_env}") \
    "${image}" /s3-objects.mjs backup /out
  [[ -s "${SNAPSHOT_DIR}/objects.manifest.json" ]] || { echo "object backup produced no manifest" >&2; exit 1; }
fi

"${compose[@]}" exec -T postgres pg_restore --list \
  < "${SNAPSHOT_DIR}/rakazo.dump" >/dev/null
tar -tzf "${SNAPSHOT_DIR}/appdata.tgz" >/dev/null

sha256sum "${SNAPSHOT_DIR}/rakazo.dump" "${SNAPSHOT_DIR}/appdata.tgz" \
  $([[ -f "${SNAPSHOT_DIR}/objects.manifest.json" ]] && echo "${SNAPSHOT_DIR}/objects.manifest.json") \
  > "${SNAPSHOT_DIR}/SHA256SUMS"
find "${SNAPSHOT_DIR}" -maxdepth 1 -type f -exec chmod 600 {} +

# Keep seven daily snapshots. BACKUP_ROOT is intentionally fixed above so this
# cleanup can never expand to an environment-controlled or broad path.
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +6 -exec rm -rf -- {} +

echo "Verified Praci backup written to ${SNAPSHOT_DIR}"
