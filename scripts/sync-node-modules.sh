#!/usr/bin/env bash
# Replaces the host node_modules with the dev image's copy, for editor types only.
# Nothing in it runs on the host: .bin and the native binary packages are left out.
# Run after `docker compose build dev`.
set -euo pipefail
export MSYS_NO_PATHCONV=1
DIR="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${DEPS_IMAGE:-lunar-resources-insight-dev:latest}"
STAGE="$DIR/.node_modules-sync"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "sync-node-modules.sh: image $IMAGE not found; run: docker compose build dev" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir "$STAGE"
trap 'rm -rf "$STAGE"' EXIT
# A tar stream, since docker cp fails on symlinks on Windows; -h dereferences the
# symlinks left after excluding .bin.
docker run --rm --network none --entrypoint tar "$IMAGE" -C /app -ch \
  --exclude='node_modules/.bin' \
  --exclude='node_modules/@parcel/watcher-*' \
  --exclude='node_modules/@rolldown/binding-*' \
  --exclude='node_modules/lightningcss-*' \
  node_modules | tar -x -C "$STAGE"
rm -rf "$DIR/node_modules"
mv "$STAGE/node_modules" "$DIR/node_modules"
