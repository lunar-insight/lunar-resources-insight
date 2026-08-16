# Tile and point serving

How raster imagery and single-pixel readings reach the browser. Covers the
proxy routing, the two tiler instances behind it, and the caching applied to
each. The scanner UI that consumes point values is in scope only where it
shapes request traffic.

## Request routing

Everything reaches the browser through one origin, so the app makes no
cross-origin requests and needs no CORS handling.

```
browser ──▶ nginx proxy (port 5173)
              ├── /cog/point   ──▶ planetcantile-point   point queries only
              ├── /cog/…       ──▶ planetcantile         tiles, info, statistics
              ├── /colorMaps/  ──▶ planetcantile
              └── /            ──▶ vite dev server
```

nginx selects by longest matching prefix, so the point route wins over the
general `/cog/` route. Both tiler instances run the same image from the
planetcantile repository, mount the same rasters read-only, and are reachable
only on an internal network. The proxy is the sole entry point.

The proxy also normalises upstream responses. It applies a response header
allowlist, so nothing the tiler emits reaches the browser unless it is on that
list, and it replaces upstream error bodies, which name internal file paths.

## Why point queries have their own instance

Tile rendering is CPU bound and holds each worker process's GIL for the duration
of a render. A point query arriving at the same instance waits for that work to
complete, which extends a request that normally answers in tens of milliseconds
into one taking hundreds. A dedicated process pool removes that coupling. The
two instances share host CPU, so heavy tile rendering slows point queries
without blocking them.

The point instance runs a single worker. Point queries are short, and titiler
runs its synchronous handlers in a thread pool, so one process absorbs the
concurrency a scan produces.

The latency this addresses is recorded in `docs/measurements/scanner-latency/`.

## Caching

Tile responses are cached twice, in the browser and on disk at the proxy. A
tile is fully determined by its request URI, which includes the source raster
and the styling parameters, so a URI always denotes the same image. The proxy
cache is size-capped and evicts least recently used entries, and concurrent
requests for one tile collapse into a single upstream call.

Point queries are deliberately not cached. Each carries a distinct coordinate,
so the key space is unbounded and entries are never reused. Repeat suppression
is performed on the client, where the scanner omits a request when the cursor
resolves to a point it has already sampled.

Cached tiles expire after a bounded period, so a regenerated raster appears
without an explicit purge. The purge command is recorded in the proxy
configuration.

## Response outcomes

A point request produces one of three outcomes, and the scanner renders each
differently. The distinction is load-bearing: a failed request must not be
presented as a reading, nor as an absence of data.

| outcome | response | scanner state |
|---|---|---|
| a value exists at the point | success carrying a number | the value |
| the raster covers the point but holds no data | success carrying null | no data |
| the request failed | error status, after a retry | unavailable |

Rasters covering the whole Moon still contain regions without data, so the
second case is common and is not an error. The proxy maps a point outside a
raster and a service failure to different statuses, so the client can tell them
apart.

## Request pacing

The scanner tracks the cursor continuously, so pacing is applied on the client.
It throttles dispatch to a minimum interval, omits points already sampled, and
abandons a batch whose position the cursor has left. Abandoning a superseded
batch prevents a reading for one point being displayed while the cursor rests on
another.

## Configuration reference

This document describes structure and intent. The files below are the source of
truth for values and are expected to diverge from any figure quoted here.

| concern | file |
|---|---|
| routing, header allowlist, tile caching | `nginx.dev.conf.template` |
| proxy and development services, exposed ports | `docker-compose.yml` |
| tiler instances, worker counts | planetcantile repository, `docker-compose.override.yml` |
| tiler application and GDAL settings | planetcantile repository, `src/planetcantile/app.py` |
| client dispatch, retry, outcome mapping | `src/services/PointValueService.ts` |
