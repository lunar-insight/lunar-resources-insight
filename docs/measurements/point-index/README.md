# Point index batching

Measured 2026-08-16.

Cost of answering a scan from the point index, a single STAC item holding every
raster as an asset. Covers how a batched request scales with the assets it
names, what the assets it does not name cost, and how the batched form compares
with one request per layer. The earlier per-layer figures are in
`docs/measurements/scanner-latency/`.

Two tiler configurations are measured. `STACReader` is rio-tiler's asset
listing through 9.4.2, which copies the item once per asset.
`NoCopySTACReader` is a planetcantile subclass listing assets in place. Both
were measured on the same host within the same hour.

rio-tiler 9.4.3 lists assets in place in `STACReader` itself
([issue 987](https://github.com/cogeotiff/rio-tiler/issues/987),
[PR 988](https://github.com/cogeotiff/rio-tiler/pull/988)). The
`NoCopySTACReader` column therefore describes any tiler running 9.4.3 or later,
and the `STACReader` column describes 9.4.2 and earlier. planetcantile carries
no reader subclass.

## Environment

| | |
|---|---|
| Docker host | 8 CPUs, 7.74 GiB |
| Point instance | planetcantile, 1 uvicorn worker, `/stac/point` only |
| Tiler libraries | titiler-core 2.2.1, rio-tiler 9.4.2, pystac 1.15.2 |
| Index | 65 single-band COGs in one item, `/data/index/point-index.json` |
| Raster storage | COGs bind-mounted read-only from a Windows path into `/data` |
| Proxy | openresty on port 5173, HTTP/1.1 |

Absolute figures move with host load, which also runs the tile instance and the
development server. Comparisons within one table are interleaved or taken back
to back; figures from different sections are not comparable.

## Reproducing

The dev stack must be running and `npm run point-index` must have been run.
`DATA_PATH` is the host raster directory, the same value the tiler's compose
file uses.

```
node docs/measurements/point-index/batch-scaling.mjs
node docs/measurements/point-index/item-size.mjs
node docs/measurements/point-index/batch-vs-separate.mjs
node docs/measurements/point-index/item-cache.mjs
node docs/measurements/point-index/concurrency.mjs
```

`item-cache.mjs` restarts the point instance.

## What an unnamed asset costs

One asset requested from items carrying an increasing number of others, eight
samples per size. Only the number of assets in the item changes.

| assets in item | `STACReader` | `NoCopySTACReader` |
|---|---|---|
| 1 | 65ms | 67ms |
| 6 | 67ms | 62ms |
| 12 | 69ms | 64ms |
| 24 | 86ms | 63ms |
| 48 | 164ms | 64ms |
| 65 | 218ms | 61ms |

Medians. Under `STACReader` the marginal cost of a carried asset rises with
size, reaching 3.2ms per asset between 24 and 65, so carrying 65 assets adds
154ms to every request, no matter which assets it names. Under
`NoCopySTACReader` the cost is flat, so the number of assets in the item does
not affect a request.

## One six-layer scan, three forms

Six whole-Moon layers, ten samples, the three forms interleaved so host load
moves them together. Three runs per configuration.

| form | `STACReader` | `NoCopySTACReader` |
|---|---|---|
| 6 separate `/cog/point` requests | 303ms, 320ms, 293ms | 298ms, 279ms, 338ms |
| 1 batched request, 65-asset index | 350ms, 355ms, 342ms | 206ms, 192ms, 213ms |
| 1 batched request, 6-asset item | 203ms, 203ms, 194ms | 192ms, 189ms, 209ms |

Medians. Under `STACReader` the batched form against the full index is slower
than one request per layer, and only an item holding just those six is faster.
Under `NoCopySTACReader` the full index matches that item and is about a third
faster than the per-layer form.

## Selection size

Under `NoCopySTACReader`, ten samples per cell, the three forms interleaved.
`SCAN_SIZE` sets the number of layers.

| layers | separate `/cog/point` | batched, 65-asset index | batched, item of that size |
|---|---|---|---|
| 1 | 58ms | 69ms | 66ms |
| 2 | 113ms | 94ms | 92ms |
| 3 | 152ms | 121ms | 117ms |
| 6 | 304ms | 200ms | 200ms |

Medians. The batched form costs 11ms more than a single `/cog/point` request at
one layer and is ahead from two layers on. The last two columns agree at every
size, so the index's other assets cost a request nothing.

## Batch duration by assets named

One request against the 65-asset index, eight samples per count, a distinct
coordinate per sample.

| assets named | `STACReader` | `NoCopySTACReader` |
|---|---|---|
| 1 | 251ms | 85ms |
| 3 | 260ms | 117ms |
| 6 | 350ms | 226ms |
| 12 | 535ms | 390ms |
| 24 | 829ms | 768ms |
| 48 | 1499ms | 1366ms |
| 65 | 1882ms | 2032ms |

Medians. Fitting the two ends gives 226ms per request plus 25.5ms per asset
named under `STACReader`, and 55ms per request plus 30.4ms per asset named
under `NoCopySTACReader`. The fixed term falls to roughly what the per-layer
measurements attributed to HTTP and routing. The per-asset term is the read
itself and does not change.

## Where the cost is

`STACReader.__attrs_post_init__` calls `get_asset_list`, which through 9.4.2
called `pystac.Item.get_assets`. pystac 1.15.2 deep-copies every asset there,
and each asset holds a reference to its owning item, so the copy is quadratic in
the assets the item carries. Profiling five constructions of the 65-asset reader
records 404,405 `deepcopy` calls, 99 percent of the time in the constructor.

rio-tiler 9.4.3 reads `Item.assets` and does not reach that copy. pystac copies
this way for every caller of `get_assets`
([issue 1799](https://github.com/stac-utils/pystac/issues/1799)), which the
point path does not call from 9.4.3 on.

Reader construction against the 65-asset item, and the same construction
followed by a one-asset point read, timed inside the container:

| reader | construction | construction and point read |
|---|---|---|
| `STACReader` | 161ms | 219ms |
| `NoCopySTACReader` | 2ms | 45ms |

Both return the same asset list, the same bounds and CRS, and the same values.

The other candidates are small. `pystac.Item.from_dict` costs 1.8ms at 65
assets, the item file read is cached, and `_extract_proj_info` returns
immediately for an item without the projection extension.

## Item state between requests

`rio_tiler.io.stac.fetch` caches the parsed item dict against its filepath with
no expiry. Unchanged by the reader, and measured under both.

| step | result |
|---|---|
| item holds `[iron5d]`, request `iron5d` | 200 |
| same path rewritten to hold `[iron5d, calcium5d]`, request `calcium5d` | 404 |
| point instance restarted, request `calcium5d` | 200 |

A rewritten item is not seen until the process ends, so the generator restarting
the point instance is required.

First request after a restart against the median of the five that follow:

| reader | first | next five |
|---|---|---|
| `STACReader` | 235ms | 237ms |
| `NoCopySTACReader` | 79ms | 67ms |

Under `STACReader` the two are equal, because every request pays for reader
construction, which is much larger than the cached read. Under
`NoCopySTACReader` a 12ms difference remains, which is the item read and the
first open of the raster.

## Concurrent batches on one worker

Six assets per request, five rounds per level, all requests issued together.

| in flight | `STACReader` per request | `NoCopySTACReader` per request | `NoCopySTACReader` wall clock per request |
|---|---|---|---|
| 1 | 517ms | 298ms | 298ms |
| 2 | 910ms | 518ms | 259ms |
| 4 | 1432ms | 1051ms | 267ms |
| 6 | 2036ms | 1345ms | 233ms |

Group wall clock is close to the count times a single request in both
configurations, so concurrent batches complete as if sequential. Throughput
improves by about a fifth at six in flight while each individual request takes
four times as long.

## Findings

1. A STAC item charges every request for the assets it carries, not only for
   the assets the request names. Under rio-tiler's `STACReader` through 9.4.2 a
   65-asset index adds 154ms to every request, and the cost is superlinear in
   the assets carried.

2. That cost cancels batching. A six-layer scan takes 342ms to 355ms against
   the 65-asset index and 293ms to 320ms as six separate requests, so the
   batched form is slower.

3. The cost is `pystac.Item.get_assets` deep-copying every asset during reader
   construction, reached through `STACReader.get_asset_list`. Reading
   `item.assets` directly removes the copy and returns the same asset list,
   bounds, CRS and values. Construction falls from 161ms to 2ms. rio-tiler does
   this from 9.4.3 on, so the point instance requires that version or later.

4. With that listing, carrying the whole index costs nothing. A six-layer scan
   costs 192ms to 213ms against the 65-asset index. That matches an item
   holding only those six, and is about a third faster than the per-layer
   form. The per-request term falls from 226ms to 55ms, and the per-asset term
   stays at roughly 30ms, which is the read itself.

5. Partitioning the index is not needed. Nearly every raster on disk is a
   scanner layer, so a partition by category would still carry most of the
   index, and a selection spanning categories would then cost one request per
   category.

6. A rewritten index is not seen until the point instance restarts, under either
   reader. The staleness is permanent and silent: an asset added to the item
   answers 404 as an unknown asset name while every other asset in the same
   request answers normally.

7. Concurrent batches do not shorten a scan. Six in flight take four times as
   long each for a fifth more throughput, so a batch left running for a
   superseded cursor position delays the batch for the current one. This
   supports the client aborting in-flight batches.

8. Scan cost remains linear in the layers a scan reads, at roughly 30ms per
   asset. Batching removes the per-request term and nothing else, so the
   selection sent to the tiler decides what a scan costs.

9. A one-layer selection is the only case the batched form loses, by 11ms
   against a single `/cog/point` request. It wins from two layers on. The
   margin is a tenth of the scanner's throttle interval, and a second dispatch
   path kept for it would run rarely and stay untested.

## Harness limitations

Node's `fetch` applies no per-origin connection limit. The browser allows six
connections per origin over HTTP/1.1 and shares them with tile loading, which
penalizes the per-layer form and is not captured here.

Every measurement was taken with the tile instance idle. Tile rendering shares
host CPU with the point instance, so a scan during globe navigation is slower
than these figures in every form.

The three-form comparison uses six whole-Moon layers. A selection whose layers
sit on different grids or hold nodata at the coordinate reads the same way, and
neither was varied.

`NoCopySTACReader` was measured through the deployed image and through the
container's own interpreter. Correctness was checked by comparing the asset
list, bounds, CRS and point values against `STACReader` for one item, not
across the range of items rio-tiler supports.

No figure here was measured against rio-tiler 9.4.3. The scripts above
reproduce the `NoCopySTACReader` column on it.
