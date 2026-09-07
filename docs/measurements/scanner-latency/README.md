# Scanner point-value latency

Measured 2026-08-15.

Latency of the chemistry scanner path, from the cursor resting on a point to
its values reaching the chart. Covers the `/cog/point` endpoint in isolation,
its behaviour while the tiler renders tiles, and a comparison of two client
dispatch strategies.

## Environment

| | |
|---|---|
| Docker host | 8 CPUs, 7.74 GiB |
| Tiler | planetcantile (titiler), 4 uvicorn workers, 766 MB resident idle |
| Raster storage | COGs bind-mounted read-only from a Windows path into `/data` |
| Proxy | openresty on port 5173, HTTP/1.1 |
| Origins | app, tiles and point queries share one origin (`VITE_SERVER_URL` empty) |
| GDAL | `GDAL_CACHEMAX=200` per worker process, `VSI_CACHE=TRUE`, `VSI_CACHE_SIZE=5000000` |

The `CPL_VSIL_CURL_*` settings in the tiler apply to COGs fetched over HTTP and
have no effect on the local mount.

Results are specific to this configuration. Raster storage crosses Docker
Desktop's filesystem translation layer, which affects the small random reads a
point query performs.

## Reproducing

Both scripts require the development stack to be running. They target
`http://localhost:5173/cog`, which `TILER_BASE` overrides.

```
node docs/measurements/scanner-latency/point-latency.mjs
node docs/measurements/scanner-latency/dispatch-comparison.mjs
```

## Endpoint latency, no tile caching

Recorded with the proxy passing every tile request through to the tiler.

| measurement | n | median | min | max |
|---|---|---|---|---|
| single point, one layer, idle tiler | 20 | 61ms | 54ms | 535ms |
| single point, one layer, idle tiler (second sample) | 5 | 59ms | 55ms | 60ms |
| per request within a 6-layer batch | 6 | 224ms | 70ms | 229ms |
| single point during 24 concurrent tile requests | 5 | 58ms | 56ms | 1204ms |

A 6-layer batch completes in 230ms wall clock, and a separate sample of the same
batch recorded 85ms to 145ms per request. Under tile load the median is
unchanged while the maximum reaches 1204ms, indicating that contention arrives
in bursts. A separate sample of that measurement recorded 717ms, 325ms and 141ms
against a 65ms idle baseline.

## Tile responses, no tile caching

`/cog/tiles` responses carry no `cache-control`, `etag`, `expires` or
`last-modified` header, and the proxy defines no `proxy_cache`. Every tile
request reaches the tiler and decodes the COG. A sparse tile is 416 bytes.

## Point response outcomes

| case | status | body |
|---|---|---|
| value present | 200 | `{"values":[9.699...]}` |
| nodata inside the raster | 200 | `{"values":[null]}` |
| invalid coordinates | 502 (tiler returns 500) | `{"error":"tile service unavailable"}` |
| tile outside bounds | 404 | `{"error":"no data at this location"}` |

Nodata inside a raster is a successful response carrying `null`, which is the
common case for CLASS layers. Points outside a raster do not occur for layers
covering the whole Moon.

## Dispatch strategies, no tile caching

The gesture under test: a batch is issued for position A, and the cursor moves to
position B after 50ms and stops. The metric is the delay between the cursor
settling on B and B's values being held. The `serialised` strategy allows the
superseded batch to complete before issuing the next. The `preempting` strategy
aborts it once the 100ms throttle interval elapses.

| condition | strategy | mean | median | min | max |
|---|---|---|---|---|---|
| idle tiler | serialised | 234ms | 245ms | 207ms | 262ms |
| idle tiler | preempting | 249ms | 251ms | 222ms | 295ms |
| during tile load | serialised | 1631ms | 1572ms | 1246ms | 2294ms |
| during tile load | preempting | 1669ms | 1506ms | 489ms | 3133ms |

Medians match within run-to-run noise in both conditions, across three runs of
the comparison. Preempting widens the spread under load.

## With tile caching, 2026-08-15

The proxy stores `/cog/tiles` responses in a 1 GB on-disk cache and sets
`Cache-Control: public, max-age=86400`. Point queries bypass both the lookup and
the store. A first tile request reports `X-Cache-Status: MISS`, a repeat reports
`HIT`, and point responses carry no cache headers.

Point latency while 24 tiles render:

| cache state | measurement | n | median | mean | max |
|---|---|---|---|---|---|
| cold | baseline, idle tiler | 5 | 125ms | 121ms | 131ms |
| cold | during tile load | 5 | 125ms | 349ms | 1236ms |
| warm | baseline, idle tiler | 5 | 71ms | 69ms | 74ms |
| warm | during tile load | 5 | 77ms | 89ms | 128ms |
| warm | during tile load (second run) | 5 | 79ms | 83ms | 119ms |

Dispatch strategies with a warm cache:

| condition | strategy | mean | median | min | max |
|---|---|---|---|---|---|
| idle tiler | serialised | 297ms | 294ms | 260ms | 339ms |
| idle tiler | preempting | 268ms | 251ms | 238ms | 304ms |
| during tile load | serialised | 317ms | 330ms | 279ms | 353ms |
| during tile load | preempting | 325ms | 315ms | 227ms | 459ms |

A cold cache reproduces the uncached figures, with a 1236ms maximum under load.
A warm cache holds the maximum at 128ms, and the end-to-end delay under tile
load matches the idle figure.

## With workload isolation, 2026-08-15

A second tiler instance runs from the same image with `WORKERS=2`, and the proxy
routes `/cog/point` to it while every other `/cog/` path continues to the
original instance. Tile rendering therefore cannot occupy the worker processes
answering point queries.

Measured against a cold tile cache, the only state in which tile requests reach
the tiler. Each configuration was measured over eleven runs, with the cache
purged before each run, recording point latency while 24 tiles render.

| metric | shared instance | isolated, 2 workers | isolated, 1 worker |
|---|---|---|---|
| mean latency across runs | 257ms | 97ms | 92ms |
| per-run maximum, median of 11 runs | 861ms | 133ms | 116ms |
| per-run maximum, range across runs | 277ms to 1389ms | 117ms to 266ms | 100ms to 158ms |
| resident memory | | 317 MB | 138 MB |

Every isolated run records a lower maximum than every shared run, with one
exception: the fastest shared run, at 277ms, is comparable to the worst isolated
case at two workers. The spread narrows by approximately an order of magnitude.
The improvement is confined to worst-case latency, as the median sits near 75ms
in both configurations.

A single worker matches two on every latency measure and consumes 179 MB less
memory. Point queries are short, and titiler runs its synchronous handlers in a
thread pool, so one worker process absorbs the concurrency a scan batch
produces.

The figures above time a single point request. A scan issues one request per
selected layer, so batch duration is the quantity the scanner experiences.
Measured separately, six samples per worker count. Each set of samples sets
`WORKERS` on the point instance, then reads the batch wall clock reported by
`point-latency.mjs`:

| workers | batch median | spread | resident memory |
|---|---|---|---|
| 1 | 330ms | 317ms to 351ms | 144 MB |
| 2 | 307ms | 269ms to 485ms | 309 MB |
| 6 | unstable | 137ms to 1027ms | 823 MB |

At one worker the six requests return together at approximately 330ms, which is
six sequential reads of about 55ms serialised on a single GIL. Additional
workers reduce the median slightly and widen the spread, because the host also
runs the tile instance and the development server. One worker is the better
choice on this metric as well as on single-request latency.

`GDAL_CACHEMAX` caps cache growth and reserves no memory up front, and it does
not bind for point queries. The instance grew from 138 MB to 153 MB over roughly
330 requests against the 200 MB per-process ceiling. The value is also assigned
unconditionally in the tiler's `app.py`, so it cannot be set per deployment
without changing that assignment.

## Multi-asset batching, 2026-08-15

A scan issues one request per layer. The tiler also exposes `/stac/point`, which
takes a STAC item and repeated `assets` parameters and returns one value per
asset in a single response. Measured with `stac-batching.mjs`, which writes a
STAC item grouping the layers, times both forms, and removes the item.

| form | median across five runs |
|---|---|
| six separate `/cog/point` requests | 321ms to 422ms |
| one `/stac/point` request, six assets | 216ms to 265ms |

The batched form is roughly a third faster. The tiler still opens and reads six
COGs within one worker, so the reduction comes from removing per-request
overhead and not from parallel reads.

The `/stac/point` row predates rio-tiler 9.4.3, so it carries the cost of
building the reader's asset list by copying the item once per asset
([issue 987](https://github.com/cogeotiff/rio-tiler/issues/987), changed in
9.4.3). At six assets that term is a few milliseconds and does not affect the
comparison. It grows with the assets the item carries, measured on a 65-asset
item in `docs/measurements/point-index/`. A repeat of this section on 9.4.3
lowers the batched row by that term.

Comparing the two forms splits the cost. The 95ms saved across five removed
requests puts HTTP and routing at roughly 19ms per request. That leaves about
39ms per asset for opening the COG, transforming the coordinate and reading the
value. That split is arithmetic on the medians and not a direct
measurement. It still bounds what batching can achieve. Per-asset work recurs
whichever form is used, so a third is the ceiling for this approach and not a
first result to improve on.

Assets do not need a shared grid. A request mixing a 720x360 raster with a
1000x2000 raster returned correct values for both. Values map back to layers
through `band_descriptions`, which carries the asset names in the order
requested. Nodata is preserved per asset: a point that one asset does not hold
data for returns `null` in that position while the others carry values.

The catalogue under `public/stac` holds one item per element with a single
`data` asset, so it does not serve this purpose as it stands. An item grouping
the layers is required, readable from the tiler's own mount.

The tiler caches a parsed STAC item against its URL. Editing an item's asset
list while keeping the same filename serves the previous version until the tiler
restarts.

## Connection limit, 2026-08-15

A browser allows six concurrent connections per origin, and the app serves the
app, tiles and point queries from one origin over HTTP/1.1. A scan issuing one
request per layer takes the whole pool. Node applies no such limit, so the other
scripts here cannot show the effect. Measured with `connection-limit.mjs`, which
models the pool as a FIFO semaphore over every request, tiles and scan alike,
with unique tile coordinates per sample so tiles always reach the tiler.

Scan latency while 24 tiles load through a shared pool of six connections:

| run | six separate requests | one batched request |
|---|---|---|
| 1 | 530ms | 342ms |
| 2 | 373ms | 245ms |
| 3 | 359ms | 241ms |

Medians of ten samples. Run 1 carried a long tail, with a 1982ms maximum against
542ms and 433ms in the later runs.

Batching returns about a third under the connection limit, matching the third it
returns without one. Competing for connections does not amplify the advantage.
The scan queues behind the tile burst in both forms. Once it reaches the front,
a pool six wide frees six slots quickly, so needing six slots costs little more
than needing one.

Two effects this does not capture. The model queues the whole tile burst ahead
of the scan, which is the worst case for the scan; a browser interleaves them as
Cesium issues tiles. And it times the scan only, so it says nothing about the
reciprocal cost, where a six-request scan holds the pool and delays tile
loading. That cost falls on the globe and not on the scanner.

## Storage backend, 2026-08-15

The rasters are bind-mounted from a Windows host path and reach the container
through Docker Desktop's filesystem translation layer, which is slow for small
random reads. Measured with `storage-backend.mjs`, which copies the layers into
the point instance's tmpfs, container RAM and therefore the fastest storage
available to it, and interleaves samples against both locations.

The six layers total 728 KB, ranging from 51 KB to 125 KB each.

| run | single point, bind mount | single point, tmpfs | 6-layer batch, bind mount | 6-layer batch, tmpfs |
|---|---|---|---|---|
| 1 | 59ms | 53ms | 313ms | 305ms |
| 2 | 58ms | 53ms | 305ms | 306ms |
| 3 | 88ms | 74ms | 456ms | 425ms |

Medians. Run 3 was taken under a busier host, which raises both columns together.

RAM is the floor that no other storage can beat. It returns between 0 and 15ms
on a single request, and between 0 and 31ms on a batch. That is under 10 percent
in every run. Storage does not account for point query latency at these file
sizes.

The cost is therefore processing and not input or output. The batching section
above splits it further: roughly 19ms per request for HTTP and routing, and
roughly 39ms per asset for opening the dataset, transforming the coordinate and
reading the value. Per-asset work is the larger share and recurs regardless of
how the requests are grouped, which is why batching reduces a scan by about a
third while removing no reads.

## Findings

1. The point endpoint is not the bottleneck. It answers in about 60ms when the
   tiler is otherwise idle.

2. Tile rendering starves point queries whenever a tile request reaches the
   tiler. Point latency reaches 1204ms while uncached tiles render, against a
   60ms idle baseline. Tile rendering is CPU-bound, and titiler's synchronous
   handlers contend for each worker process's GIL.

3. Caching tiles removes the contention for tiles already rendered. A warm
   cache holds point latency under load at a 128ms maximum against a 71ms idle
   baseline, and end-to-end delay under load falls from approximately 1550ms to
   approximately 320ms. A cold cache reproduces the uncached figures, so a first
   visit to a region still incurs contention.

4. Serving point queries from a separate tiler instance removes the contention
   a cold cache leaves. The per-run maximum falls from a median of 861ms to
   116ms, and the range narrows from 277ms to 1389ms down to 100ms to 158ms.
   The cost is 138 MB resident at one worker. Caching and isolation address
   different states, caching the repeat visit and isolation the first, so
   neither replaces the other.

5. Client-side request cancellation does not reduce latency. When the tiler is
   idle a batch completes within the 100ms throttle interval, leaving nothing to
   cancel. When the tiler is loaded, cancellation does not stop work already
   running in a worker. The replacement batch queues behind that work, and the
   abandoned work adds load.

6. Request failures are not a factor in scanner latency. Every point request
   across these runs returned a response, and none failed. The unavailable
   state the scanner renders for a failed layer request does not appear during
   normal use.

7. Batching a scan into one multi-asset request reduces batch duration by
   roughly a third, from 321ms to 422ms down to 216ms to 265ms. The reduction is
   not proportional to the number of layers removed, because per-asset work at
   roughly 39ms dominates the roughly 19ms of per-request overhead that batching
   removes. A third is the ceiling for this approach.

   A batched scan occupies one of the browser's six connections per origin, where
   separate requests occupy all six and leave none for tile loading. Modelling
   that limit returns the same third, so competing for connections does not
   amplify the advantage. Any remaining benefit falls on tile loading, which no
   measurement here covers.

   This third holds for the seven-asset item measured here. An item also
   charges every request for the assets it carries, which the probe item is too
   small to show and a whole-catalog item is not.
   `docs/measurements/point-index/` measures that term, which rio-tiler 9.4.3
   removes.

8. Raster storage does not account for point query latency. Serving the layers
   from container RAM, the fastest storage available, returns under 10 percent
   against the Windows bind mount. At 51 KB to 125 KB per file the read is
   negligible, and the cost sits in per-request overhead. Moving the rasters to
   a container-native volume would not shorten a scan.

9. Raising the worker count does not improve point latency. Four workers hold
   766 MB idle and `GDAL_CACHEMAX` applies per process, so eight would approach
   3 GB on a 7.74 GiB host. Worker count also bounds how many cores tile
   rendering can occupy, so raising it increases the CPU available to the
   workload that starves point queries.

## Harness limitation

Both scripts use Node's `fetch`, which does not apply the browser's limit of six
connections per origin. Because the app serves tiles and point queries from one
origin over HTTP/1.1, the browser adds connection queueing that these
measurements do not capture. Figures here describe tiler contention only and
understate latency in the running app.
