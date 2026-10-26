#!/usr/bin/env bash
# Checks package-lock.json against the OSV database, which also lists known malicious
# packages (OpenSSF), with the official OSV-Scanner image. The lockfile is copied in;
# nothing is mounted. Exit code 1 means vulnerabilities were found.
#   scripts/osv-scan.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1
winpath() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
# v2.7.0, released 2026-10-12. Update on purpose, with a release at least 7 days old.
IMAGE="ghcr.io/google/osv-scanner:v2.7.0@sha256:4f3b7e2c64b9d38a5febc5a7e4a3dfef1d1362f726dea7a2ef4762b46469fcd0"
NET="${DEPS_NET:-lunar-resources-insight_proxy-out}"

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "osv-scan.sh: network $NET not found; run docker compose up once to create it" >&2
  exit 1
fi

id=$(docker create --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges \
  --network "$NET" "$IMAGE" scan source --lockfile /package-lock.json)
trap 'docker rm -f "$id" >/dev/null' EXIT
docker cp "$(winpath "$DIR/package-lock.json")" "$id:/package-lock.json" >/dev/null
docker start -a "$id"
