#!/usr/bin/env bash
# Runs an npm command in a throwaway container with no mounts, e.g.
#   scripts/deps.sh install --package-lock-only <pkg>@<version>
#   scripts/deps.sh audit fix --package-lock-only   (repeat until the lockfile stops changing)
# package.json, package-lock.json and .npmrc are copied in; the two package files are
# copied back, also when npm exits non-zero. Review the result with git diff.
set -euo pipefail
# Git Bash rewrites /app-style arguments into Windows paths; host paths go through cygpath.
export MSYS_NO_PATHCONV=1
winpath() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${DEPS_IMAGE:-lunar-resources-insight-dev:latest}"
NET="${DEPS_NET:-lunar-resources-insight_proxy-out}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "deps.sh: image $IMAGE not found; run: docker compose build dev" >&2
  exit 1
fi
if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "deps.sh: network $NET not found; run docker compose up once to create it" >&2
  exit 1
fi

id=$(docker create --user node --cap-drop ALL --security-opt no-new-privileges \
  --network "$NET" -w /app --entrypoint sh "$IMAGE" \
  -c 'cp /in/package.json /in/package-lock.json /in/.npmrc /app/ && npm "$@"' npm "$@")
trap 'docker rm -f "$id" >/dev/null' EXIT
stage=$(mktemp -d)
cp "$DIR/package.json" "$DIR/package-lock.json" "$DIR/.npmrc" "$stage/"
docker cp "$(winpath "$stage")" "$id:/in" >/dev/null
rm -rf "$stage"
status=0
docker start -a "$id" || status=$?
docker cp "$id:/app/package.json" "$(winpath "$DIR/package.json")" >/dev/null
docker cp "$id:/app/package-lock.json" "$(winpath "$DIR/package-lock.json")" >/dev/null
exit "$status"
