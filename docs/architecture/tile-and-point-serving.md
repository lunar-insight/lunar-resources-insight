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
              ├── /stac/point  ──▶ planetcantile-point   point queries, batched
              ├── /cog/point   ──▶ planetcantile-point   point queries, one raster
              ├── /cog/…       ──▶ planetcantile         tiles, info, statistics
              ├── /colorMaps/  ──▶ planetcantile
              ├── /point-index/assets.json               read-only file mount
              └── /            ──▶ vite dev server
```

nginx selects by longest matching prefix, so the point routes win over the
general `/cog/` route, and `/stac/point` wins over the app's own catalog
under `/stac/`. That separation holds while the catalog contains no `point/`
directory. Both tiler instances run the same image from the planetcantile
repository, mount the same rasters read-only, and are reachable only on an
internal network. The proxy is the sole entry point.

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

## One request per scan

A scan reads every selected layer in one `/stac/point` request. The endpoint
takes one STAC item and a list of asset names, and returns one value per named
asset. Cost scales with the assets a request names and not with the number of
requests, so batching makes the request count constant without changing the
per-layer cost.

That item is the point index. It is a product of the raster directory, lives
beside it, and is not committed. It holds one asset per single-band raster,
keyed by the filename stem, with hrefs under the tiler's own mount. The
catalog under `public/stac` is a separate document for a separate consumer:
the browser reads it over HTTP for provenance, one item per dataset.
`src/layersConfig.ts` joins the two on the filename.

`scripts/generate-point-index.mjs` walks the raster directory and writes the
index, so an href always names a file that exists. One broken href fails a whole
request and costs every layer in the scan. Rasters that do not open, and rasters
holding more than one band, are excluded and reported: each band is requested as
its own asset, so a multi-band asset fails every request naming it. The script
also reports both directions against `layersConfig.ts`: a file no layer
references, and a layer filename with no file.

The tiler holds a parsed item for the life of the worker process, keyed on the
item path with no expiry. The item filename is therefore fixed, and the script
restarts the point instance to clear the parsed copy.

One item can hold every raster because the tiler lists an item's assets without
copying them, which keeps the item's size out of the cost of a request. That
reader is in the planetcantile repository, and the measurements are in
`docs/measurements/point-index/`.

The asset keys are served separately as `/point-index/assets.json`, from a
read-only mount of the same directory. The client reads that list once and drops
a layer whose key is absent, reporting it unavailable on its own. The index
itself never reaches the browser, which has no use for paths inside the tiler
container.

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
| a value exists at the point | a number in the asset's position | the value |
| the raster covers the point but holds no data | null in the asset's position | no data |
| the request failed | error status, after a retry | unavailable |

Rasters covering the whole Moon still contain regions without data, so the
second case is common and is not an error. It is reported per asset, so one
layer holding no data leaves the others carrying values.

Failure applies to the whole request, and every layer it named is reported
unavailable. Each cause is prevented at its own level:

| cause | prevented by |
|---|---|
| an asset key the index does not hold | the asset list, checked before the request |
| a stale parsed item | the generator restarting the point instance |
| a point outside a raster's footprint | the bounds filter, which omits that layer |

A point outside one named asset's footprint fails the whole request. A null in a
single position means that asset holds no data there.

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
| routing, header allowlist, tile caching | `nginx.dev.conf.template`, `nginx.conf` |
| proxy and development services, exposed ports, point index mount | `docker-compose.yml` |
| point index generation and the config cross-check | `scripts/generate-point-index.mjs` |
| layer to filename and variant mapping | `src/layersConfig.ts` |
| tiler instances, worker counts | planetcantile repository, `docker-compose.override.yml` |
| tiler application and GDAL settings | planetcantile repository, `src/planetcantile/app.py` |
| client dispatch, retry, outcome mapping | `src/services/PointValueService.ts` |
