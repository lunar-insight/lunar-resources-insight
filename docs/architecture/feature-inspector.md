# Feature Inspector

## Scope

How the Inspector computes and presents statistics for a saved feature (point,
line, polygon or circle), and what each displayed statistic means. Covers the
computation in the background, the requests it sends, the whole Moon statistics
it compares against, and the comparison view. Excludes the scanner, which reads
values under the cursor, and the tile and point serving behind the requests
(see `tile-and-point-serving.md`).

## Structure

```
 feature saved or edited (FeaturesContext)
            |
            v
 InspectorStore  ------------------------------+
   point:  one batched request                 |
   shape:  one request per dataset line   ---> RequestQueue (areas)
           paused while the camera moves       |      |
   line:   one batched request per sample ---> RequestQueue (samples)
            |                                  |      |
            v                                  v      v
 results per feature, kept until deleted     /stac/point   POST /cog/statistics
            |                                (point        (tile instance)
            v                                 instance)
 Inspector window, features panel, comparison view
            ^
            |
 LayerStatsService: whole Moon statistics by file (GET /cog/statistics, cached at the proxy)
```

## Design rationale

The window answers three questions per dataset: how much is here, whether that
is a lot for the Moon, and whether it is the same across the feature. Values are
computed when a feature is saved, so a window opens on results already held.
Shape statistics share the tile instance with map rendering, so area requests
run a few at a time and wait while the camera moves. Line samples go to the
point instance, which answers one batch at a time, so they are sent one at a
time and the scanner waits behind one sample at most. The evidence for the read
size, the spread band, the thresholds and the coverage cutoffs is in
`docs/measurements/feature-statistics/`.

## Components

### Dataset lines

`services/inspector/inspectorLayers.ts` builds one line per dataset reporting
an element, compound, mineral or derived index, grouped into one card per
symbol and ordered as in `layersConfig.ts`. Count rate layers have no line.
Every line has a unit, which its value and the line charts show;
`inspectorLayers.test.ts` enforces it. The
north and south files of a Kaguya SP mineral share an `inspectorPair` id and
form one line, which reads the file on the side of the feature's center
latitude.

A line reads its layer's first variant whatever the map shows. The first
variant of a layer is its finest: its catalog item has the smallest
`lri:resolution_km` of the layer, which `layersConfig.test.ts` enforces. Only
the first position is ordered; later variants are in no particular order.

### Computation

`services/inspector/InspectorStore.ts` holds the results of every feature. A
new feature computes at once. A geometry edit recomputes once no further edit
arrives for a short time, so dragging a vertex sends no request per frame.
Deleting a feature cancels its requests and drops its results.

- **Point.** One batched point request reads every line's file. Files whose
  bounds do not hold the point are left out of the request, since one file not
  covering the point fails the whole batch. The files' catalog items load
  alongside it, for their `lri:clipped_*` fields.
- **Polygon and circle.** One `POST /cog/statistics` per line, with the shape
  as a GeoJSON Feature in the Moon's coordinate system, read from an overview
  capped in size. The response holds the histogram as well. A circle is
  converted to a polygon. Lines whose dataset bounds do not reach the shape
  need no request.
- **Line.** A fixed number of samples spread evenly by distance along the whole
  line, plus each vertex, interpolated along the geodesic. Each sample is one
  batched point request. Statistics for a line are computed over its samples.

`services/inspector/RequestQueue.ts` runs queued requests up to a concurrency,
pauses on demand, and cancels by feature.

### Displayed statistics

| Statistic | Meaning |
|---|---|
| Value | The value at a point; the mean ("avg") over a shape or along a line, the value that scales with the amount present. |
| Spread word | The shape's p15 to p85 width divided by the layer's whole Moon p15 to p85 width: Uniform below 0.35, Variable from 0.35 to 0.75, Highly variable from 0.75. Dividing by the layer's own width lets one set of thresholds serve wt%, ppm and index layers. The ratio measures width, not pattern. |
| Median | The shape's median, first line of the spread explanation. The value stays the mean, since the mean scales with the amount present and ranks the comparison. |
| Skew mark | An amber dot on the spread icon when \|mean − median\| is at least 0.15 of the layer's whole Moon p15 to p85 width. The explanation then ends with "More than half the shape is below the average." (mean above the median) or "above" (mean below it), which holds for any shape where the mark shows. Shapes over the read cap are read from averaged overviews, which narrow the gap, so they get fewer marks, never false ones. No mark at low resolution or without whole Moon statistics. |
| Most | p15 to p85 of the shape, which holds 70% of its pixels whatever the distribution. |
| Histogram | First in the spread explanation: 12 bins from the shape's lowest to highest value, with the Most range shaded, the median as a solid line and the average as a dashed one. The axis ends give the lowest and highest value, read from the capped overview, so slightly inward of single pixel extremes. It tells one peak with a tail from two terrains, which give the same skew mark. Every pixel the outline touches counts fully, while the other statistics weight pixels by their share inside the shape, so on a small shape the median line can sit slightly off the bars' middle. A clipped layer's pile at its limit shows as a bar at the axis end. Not drawn for a shape holding a single value. |
| Lowest, Highest | Lines of the spread explanation when there is no histogram. |
| Low resolution | Shown instead of the spread word when the shape holds fewer than 10 native cells: its area over the square of the dataset's `lri:resolution_km`. Below that, p15 and p85 are set by the few cells the shape hits. |
| Coverage | The share of the shape holding data (`valid_percent`). Shown below 95%. The average covers that share only; in the comparison, a cell under 50% is muted and never takes the row highlight. |
| Bar | Hybrid scale: a reference range when one exists, so the same position means the same value across datasets; otherwise the percentile within the dataset's whole Moon statistics. Without either, the bar shows a center dash. Elements, compounds and minerals take their range from `constants/elementReferenceRanges.ts`; a derived index takes its range, and what its low and high values mean, from the Derived Indices data. |
| Limit mark | A point value equal to either end of its file's `lri:clipped_range`, inside `lri:clipped_longitudes` when the item sets them: an amber arrow against a ceiling or a floor, right of the bar. Every line of the window keeps the slot once any line has the mark. The explanation gives the limit, says values beyond it are set to it, then the item's `lri:clipped_notes` sentence for that end. The match is exact: point values are the float32 pixels, and the range ends are exact in float32. |
| No data | A hatched track. Outside the dataset's bounds, the explanation gives its extent; inside them, the dataset has no measurements at that location. |

Whole Moon statistics are not displayed; they set the percentile scale and the
reference width of the spread word and the skew mark. A point has one value, so
spread and coverage do not apply to it. A line shows a sparkline instead of the bar, and a chart per
unit.

### Whole Moon statistics

`services/LayerStatsService.ts` stores statistics by file. Each layer's default
file, its first variant, is fetched at start and retried once after a failure;
other variants are fetched on first use. The map and the scanner read the file
a layer shows, the Inspector the file a line reads, so neither overwrites the
other. Opening an Inspector window retries the files still missing. The proxy
caches these requests, since their URI names the file and the percentiles.

### Comparison and export

The comparison view (`components/inspector/ComparisonView/`) shows the ticked
features as columns and the union of their dataset lines as rows, highlighting
the highest value of each dataset row. The window exports the statistics of its
feature as CSV; a line feature exports either its statistics or its profile,
one row per sample. The comparison exports every compared feature.

## Configuration reference

| Concern | Defined in |
|---|---|
| Dataset label, short name, decimals, polar pair | `src/layersConfig.ts` |
| Native resolution of a file | `lri:resolution_km` in its catalog item under `public/stac/` |
| Clipped range of a file | `lri:clipped_range` (`[low, high]`), `lri:clipped_longitudes` (`[west, east]`, optional, everywhere when absent), `lri:clipped_notes` (`{low?, high?}`, optional) in its catalog item |
| Reference ranges, card names | `src/constants/elementReferenceRanges.ts`, `src/constants/periodicTableData.ts`, `src/components/navigation/submenu/DerivedIndices/data.ts` |
| Spread and skew thresholds, cell minimum, coverage cutoffs | `src/services/inspector/inspectorStatistics.ts` |
| Sample count, circle vertices | `src/services/inspector/featureGeometry.ts` |
| Read size and histogram bins of shape statistics | `src/services/inspector/inspectorRequests.ts` |
| Request concurrency, edit settle time | `src/services/inspector/InspectorStore.ts` |
| Line chart colors | `src/services/inspector/chartSelection.ts` |
| Statistics cache | `nginx.dev.conf.template` |
