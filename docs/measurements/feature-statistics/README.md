# Feature statistics

Statistics over a drawn shape, as the Feature Inspector will request them.
Covers what one shape request returns and costs, the spread band, the ratio
behind the verdict word (Uniform, Variable, Highly variable), the smallest shape a
verdict holds for, and the error of a mean over part of a shape.

## Findings

**Shape statistics need no tiler change.** `POST /cog/statistics` with a
GeoJSON Feature body is part of TiTiler's `TilerFactory` and passes through
the proxy. The request must carry `coord_crs=IAU_2015:30100`; without it the
tiler reads the shape as EPSG:4326 and fails, which the proxy reports as a
502. The response carries mean, median, std, min, max, count, unique,
`valid_percent`, a histogram and every requested percentile.

**Percentiles are free.** Two or five percentiles add no measurable time on
any layer tested, from 144 to 2.3 million pixels.

**Cap the read at `max_size=1024`.** The shape route reads at full resolution
by default. On Clementine (100 m pixels) the time grows with area: 5.4 s for
an 8° box, which puts a 20° box near the proxy's 30 s timeout. At 1024 the time stays
near 1 s and mean, p15 and p85 move by 0.03 wt% at most. This replaces the
size cap listed as future work. The overviews are built with average
resampling, so a capped read keeps the mean exact and narrows only the
extremes: lowest and highest move inward by up to 1.2 wt% on the boxes
tested.

**The whole Moon statistics are close enough.** `LayerStatsService` reads an
overview capped at 1024 pixels. Against a read at 4096, the p15 to p85 width
changes by 2% or less on every layer tested.

**Use p15 to p85 as the spread band.** Mean ± std dev lands outside the
possible range or away from the data where the distribution is bounded or
has a spike: plagioclase over the farside highlands gives 67.1 to 105.7 wt%
against 86.9 to 93.3, and over Tranquillitatis 10.6 to 39.2 against 0.0 to
36.1. Elsewhere the two bands differ by up to about 1.5 units, the percentile
band sitting toward the long tail (Crisium FeO: 6.0 to 15.5 against 6.2 to
17.0 wt%).

**Verdict thresholds: Uniform below 0.35, Highly variable from 0.75, Variable between.**
The ratio is the shape's p15 to p85 width over the layer's whole Moon p15 to
p85 width. Across 56 layer and shape pairs it runs from 0.02 to 1.73 with no
natural gap, so the thresholds are set by the pairs whose character is
known: mare and highland interiors fall below 0.35 (Tranquillitatis FeO 0.31,
farside FeO 0.15, farside plagioclase 0.16), and shapes mixing mare and
highland or crossing KREEP terrain reach 0.75 and above (Crisium 1.04 to 1.39
on the fine layers, Apennine front FeO 0.77, Fra Mauro thorium 1.17 to 1.73).
The ratio measures width only; it cannot tell a smooth gradient from
patches, which is why the top word is "Highly variable".

**No verdict below 10 native cells.** Below 10 bins the p15 to p85 of a
coarse layer is set by the few bins the shape happens to hit. At the Apennine
front the 2° FeO layer reads 0.85 on 2° to 4° boxes, where the 100 m layer
reads 0.40 to 0.58; below one bin the ratio drops to 0. The tiler's `count`
cannot detect this: it counts file pixels, and the 2° Prettyman layers are
stored on a 1° grid. The cell count comes from the shape's area and each
item's `lri:resolution_km`. For the Prettyman layers that value is 150 km,
the resolution their PDS label gives for data taken at 100 km altitude, so
10 cells of it is a stricter rule than the 10 bins measured here: neighboring
2° bins are not independent.

**The pixel size cannot stand in for `lri:resolution_km`.** It matches for
the 19 imaging layers (Clementine, Kaguya MI and SP, LROC WAC). For the other
58 layers the file's pixel is 2 to 16 times finer than one independent
measurement: CH2 CLASS 16×, LP GRS 5° and APS 9.9×, Prettyman 2° 4.9×,
Kaguya GRS 4.3×. No layer carries a resolution finer than its pixel.

**Below 50% coverage, a mean can be far off.** With a contiguous part of a
shape removed, the median error stays at or below 0.11 of the whole Moon
p15 to p85 width even at 10% kept. The worst case grows with the missing
share: 0.09 at 90% kept, 0.25 at 70%, 0.30 at 50%, then 0.58 at 30% and 0.85
at 10%. The worst cases are the heterogeneous shapes, where the removed part
differs from the rest. This supports keeping cells under 50% coverage out of
the comparison highlight.

**A mean can fall outside p15 to p85.** Kaguya MI plagioclase holds exact
zeros as model output (the four minerals still sum to 100 there): 4.6% of
the farside highland box and 23% of Tranquillitatis. Over the farside box the
mean is 86.4 wt% while p15 is 86.9 and the median 91.2. Two of the 56 pairs
show a mean outside the band.

**The Kaguya SP polar files count their empty corners as data.** All eight
carry no nodata value and no mask, so the corners outside each map's circle
read as zero abundance: 21.1% of every file, the share of a square outside
its inscribed circle. Their whole Moon percentiles, and any shape mean and
coverage near a corner, include those zeros. For north polar clinopyroxene,
73% of the file is zero and p15 is 0. Every other raster in the layer config
has a usable p15 to p85 width.

## Environment

| | |
|---|---|
| Docker host | 8 CPUs, 7.74 GiB |
| Tiler | planetcantile, 4 uvicorn workers, `/cog/` instance |
| Tiler libraries | titiler-core 2.2.1, rio-tiler 9.4.2 |
| Raster storage | COGs bind-mounted read-only from a Windows path into `/data` |
| Proxy | openresty on port 5173, HTTP/1.1 |

The same instance renders tiles, so times move with host load. Values do not.

## Reproducing

The dev stack must be running. `TILER_BASE` overrides `http://localhost:5173`.

```
node docs/measurements/feature-statistics/shape-request.mjs
node docs/measurements/feature-statistics/spread-verdict.mjs
node docs/measurements/feature-statistics/small-shapes.mjs
node docs/measurements/feature-statistics/partial-coverage.mjs
node docs/measurements/feature-statistics/layer-widths.mjs
node docs/measurements/feature-statistics/resolution-vs-pixel.mjs
docker exec -i planetcantile-planetcantile-1 python - \
  < docs/measurements/feature-statistics/polar-nodata.py
```

Shapes and layers are defined in `lib.mjs`. Shapes are boxes in
planetocentric degrees; every shape request uses `max_size=1024` unless a
table says otherwise.

## 2026-09-27

### Percentile cost

Interleaved, median of 8.

| layer | pixels | none | p15, p85 | five |
|---|---|---|---|---|
| Thorium, LP GRS Prettyman 2° | 144 | 57 ms | 56 ms | 55 ms |
| Iron, CH2 CLASS (40° × 50°) | 36,027 | 98 ms | 102 ms | 97 ms |
| FeO, Clementine (5°, full resolution) | 2,298,668 | 2137 ms | 2107 ms | 2150 ms |

### Read size on a 100 m layer

FeO, Clementine, boxes from 25°E 3°N, median of 3.

| box | max_size | pixels | time | mean | p15 | p85 |
|---|---|---|---|---|---|---|
| 2° | full | 367,903 | 376 ms | 20.61 | 18.81 | 22.44 |
| 2° | 1024 | 367,903 | 362 ms | 20.61 | 18.81 | 22.44 |
| 5° | full | 2,298,668 | 2129 ms | 20.62 | 19.11 | 21.93 |
| 5° | 1024 | 1,047,332 | 1021 ms | 20.62 | 19.11 | 21.93 |
| 5° | 512 | 261,939 | 334 ms | 20.62 | 19.14 | 21.91 |
| 8° | full | 5,884,280 | 5425 ms | 20.27 | 18.82 | 21.67 |
| 8° | 1024 | 1,047,859 | 1019 ms | 20.27 | 18.85 | 21.65 |
| 8° | 512 | 261,990 | 337 ms | 20.27 | 18.88 | 21.63 |

### Extremes under a capped read

8° boxes, one request each. Both files carry `OVERVIEW_RESAMPLING=AVERAGE`.

| layer | box from | max_size | min | max | p1 | p99 | mean |
|---|---|---|---|---|---|---|---|
| FeO, Clementine | 25°E 3°N | full | 7.31 | 30.00 | 15.85 | 26.01 | 20.27 |
| FeO, Clementine | 25°E 3°N | 1024 | 8.26 | 29.89 | 15.89 | 25.72 | 20.27 |
| FeO, Clementine | 47°E 5°N | full | 0.04 | 23.78 | 4.28 | 17.37 | 9.09 |
| FeO, Clementine | 47°E 5°N | 1024 | 0.10 | 22.68 | 4.29 | 17.33 | 9.09 |
| Plagioclase, Kaguya MI | 155°E 5°N | full | 0.00 | 100.00 | 82.00 | 96.00 | 89.93 |
| Plagioclase, Kaguya MI | 155°E 5°N | 1024 | 0.00 | 98.81 | 83.00 | 95.19 | 89.93 |

### Whole Moon p15 to p85

| layer | max_size 1024 (app) | max_size 4096 |
|---|---|---|
| Thorium, LP GRS Prettyman 2° | 0.47 to 2.71 ppm | 0.47 to 2.71 |
| Thorium, LP GRS 0.5° | 1.10 to 3.30 ppm | 1.10 to 3.30 |
| Hydrogen, Lawrence | 37.90 to 60.87 ppm | 37.90 to 60.87 |
| FeO, LP GRS Prettyman 2° | 3.83 to 9.85 wt% | 3.83 to 9.85 |
| FeO, Clementine | 4.51 to 13.93 wt% | 4.37 to 13.99 |
| Mg#, Clementine | 54.29 to 64.79 | 54.28 to 64.96 |
| Plagioclase, Kaguya MI | 47.08 to 87.96 wt% | 46.39 to 88.21 |
| Iron, CH2 CLASS | 3.84 to 14.06 wt% | 3.71 to 14.05 |

### Spread bands and verdict ratio

Selected pairs; `spread-verdict.mjs` prints all 56.

| layer | shape | coverage | mean | mean ± std | p15 to p85 | ratio |
|---|---|---|---|---|---|---|
| FeO, Clementine | farside highlands | 96% | 4.38 | 3.64 to 5.11 | 3.69 to 5.10 | 0.15 |
| FeO, Clementine | Tranquillitatis | 100% | 20.37 | 18.55 to 22.19 | 18.92 to 21.85 | 0.31 |
| FeO, Clementine | Imbrium | 99% | 23.11 | 20.95 to 25.27 | 20.73 to 25.40 | 0.50 |
| FeO, Clementine | Apennine front | 98% | 13.18 | 9.82 to 16.54 | 9.90 to 17.17 | 0.77 |
| FeO, Clementine | Crisium | 100% | 10.73 | 5.98 to 15.49 | 6.18 to 16.95 | 1.14 |
| Thorium, LP GRS 0.5° | Crisium | 100% | 1.83 | 1.54 to 2.12 | 1.60 to 2.20 | 0.27 |
| Thorium, LP GRS 0.5° | Fra Mauro | 100% | 9.60 | 7.98 to 11.21 | 7.50 to 11.30 | 1.73 |
| Hydrogen, Lawrence | SPA interior | 100% | 51.97 | 47.91 to 56.02 | 48.58 to 54.77 | 0.27 |
| Hydrogen, Lawrence | Fra Mauro | 100% | 55.52 | 47.25 to 63.79 | 45.63 to 64.95 | 0.84 |
| Plagioclase, Kaguya MI | farside highlands | 100% | 86.41 | 67.14 to 105.68 | 86.91 to 93.30 | 0.16 |
| Plagioclase, Kaguya MI | Tranquillitatis | 100% | 24.93 | 10.64 to 39.23 | 0.00 to 36.13 | 0.88 |
| Plagioclase, Kaguya MI | Crisium | 100% | 64.50 | 44.80 to 84.20 | 41.00 to 83.66 | 1.04 |
| Iron, CH2 CLASS | SPA interior | 23% | 9.56 | 4.44 to 14.67 | 1.00 to 14.32 | 1.30 |

### Small shapes

Boxes centered on 2.5°W 22.5°N (Apennine front). Cells are 2° bins of the
coarse layer, longitude shortened by latitude; the data behind them is
resolved at about 150 km, not 60.

| box | cells | unique | Th 2° | Th 0.5° | FeO 2° | FeO 100 m |
|---|---|---|---|---|---|---|
| 16° | 59.1 | 81 | 1.04 | 1.32 | 0.85 | 0.78 |
| 8° | 14.8 | 25 | 0.67 | 1.09 | 0.65 | 0.76 |
| 6° | 8.3 | 16 | 0.53 | 0.91 | 0.49 | 0.75 |
| 4° | 3.7 | 9 | 0.57 | 0.64 | 0.86 | 0.58 |
| 3° | 2.1 | 4 | 0.57 | 0.55 | 0.85 | 0.52 |
| 2° | 0.9 | 4 | 0.57 | 0.36 | 0.85 | 0.40 |
| 1° | 0.2 | 1 | 0.00 | 0.14 | 0.00 | 0.29 |

### Partial coverage

Mean over the kept part against the mean over the whole box, as a share of
the whole Moon p15 to p85 width. 7 shapes, each cut from 4 sides; median /
max.

| layer | 90% kept | 70% | 50% | 30% | 10% |
|---|---|---|---|---|---|
| Thorium, LP GRS 0.5° | 0.01 / 0.09 | 0.03 / 0.25 | 0.06 / 0.30 | 0.07 / 0.58 | 0.09 / 0.85 |
| Hydrogen, Lawrence | 0.01 / 0.04 | 0.04 / 0.12 | 0.07 / 0.18 | 0.09 / 0.28 | 0.13 / 0.35 |
| FeO, LP GRS Prettyman 2° | 0.01 / 0.06 | 0.04 / 0.17 | 0.05 / 0.29 | 0.09 / 0.41 | 0.11 / 0.53 |
| FeO, Clementine | 0.01 / 0.06 | 0.04 / 0.13 | 0.06 / 0.14 | 0.08 / 0.29 | 0.12 / 0.48 |
| all | 0.01 / 0.09 | 0.04 / 0.25 | 0.06 / 0.30 | 0.08 / 0.58 | 0.11 / 0.85 |

### Whole Moon width across all layers

`layer-widths.mjs` over the 80 raster files in the layer config. Terrain
elevation and slope return 502 (both are marked unavailable). One file has a
p15 to p85 width under 2% of its min to max range:

| file | p15 | p85 | min | max |
|---|---|---|---|---|
| clinopyroxene_kaguya_sp_lemelin2022_north_pole | 0 | 0.29 | 0 | 32.77 |

### Kaguya SP polar files

`polar-nodata.py`, each file read at 632 × 632. None has a nodata value or a
mask, and every corner holds 0. The corner share of a square is 21.5%.

| file | zeros |
|---|---|
| clinopyroxene, north pole | 73.2% |
| clinopyroxene, south pole | 54.0% |
| olivine, north pole | 23.5% |
| olivine, south pole | 22.1% |
| orthopyroxene, north pole | 21.1% |
| orthopyroxene, south pole | 21.1% |
| plagioclase, north pole | 21.1% |
| plagioclase, south pole | 21.1% |

### Resolution against pixel size

`resolution-vs-pixel.mjs` over the 77 raster files in the layer config that
carry a catalog item. Ratio of `lri:resolution_km` to the file's pixel height.

| ratio | files | layers |
|---|---|---|
| 1.0 | 19 | Clementine, Kaguya MI, Kaguya SP, LROC WAC |
| 2.0 | 18 | Prettyman 5° and 20° |
| 2.4 | 1 | Wilson 2018 thorium |
| 3.0 to 3.3 | 3 | LP GRS 0.5°, Lawrence 2022 hydrogen |
| 4.0 | 5 | LP GRS 2°, low altitude |
| 4.3 | 4 | Kaguya GRS |
| 4.9 | 9 | Prettyman 2° |
| 9.9 | 13 | LP GRS 5°, LP GRS 2° thorium high altitude, APS |
| 16.3 to 16.5 | 5 | CH2 CLASS |

