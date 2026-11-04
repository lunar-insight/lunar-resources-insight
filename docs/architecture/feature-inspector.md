# Feature Inspector

## Scope

How the Inspector computes and presents statistics for a saved feature (point,
line, polygon or circle), and what each displayed statistic means. Covers the
computation in the background, the requests it sends, the whole Moon statistics
it compares against, the comparison view, adding a line's layer to the map, and
the picture of the map in the popovers. Excludes the scanner, which reads values
under the cursor, and the tile and point serving behind the requests (see
`tile-and-point-serving.md`).

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

 popover opened
            |
            v
 PictureStore  ---> RequestQueue (areas), ahead of queued statistics ---> GET /cog/bbox (tile instance)
            |
            v
 one gray picture, colored and read in the browser (MiniViewer)
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
  need no request. A ring across 180° is sent as a MultiPolygon split at that
  meridian, with the crossing vertices at the interpolated latitude, and its
  area, bounds and sample grid use continuous longitudes. A ring around a pole
  has no continuous form and is sent as drawn.
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

### Show on the map

Each row with a value holds a button, shown on row hover and focus and kept
while pressed, and the popovers holding a picture repeat it. Both call the same
`LayerContext` as the menus, and their state is computed from the layer list, so
the eye, remove, "remove all" and the menus update them.

| Layer | Press | Then |
|---|---|---|
| Not in the list | Adds it on top, in the picture's gray or viridis | Pressed |
| In the list, hidden | Shows it and moves it to the top | Pressed |
| Shown, added by this button, not adjusted | Removes it | Off |
| Shown, from the menus or adjusted | Hides it | Off |
| On another variant | Swaps to the variant the line reads, and shows it if hidden | Pressed |

Removing a layer drops its opacity, range, colors and variant, so a layer the
user set up is hidden instead. A style, range, lock, filter, opacity or variant
change counts as adjusted. A shown layer under other layers stays pressed, since
reordering belongs to Layer Management.

### Mini viewer

`components/inspector/MiniViewer/` draws a picture of a line's layer around the
feature on a `<canvas>`: in the spread popover of a shape, and the bar and limit
popovers of a point. Lines and the comparison view have none. The histogram shows
how a shape's values are distributed, the picture where.

**Request.** `services/inspector/PictureStore.ts` sends one gray PNG with an alpha
channel per file and feature geometry, through the queue of the tile instance, so
a picture waits while the camera moves and a feature's cancel aborts it. It keeps
the last 50 pictures in memory. The tiler reads nearest neighbor by default, so
pixels stay real values.

**Local projection.** Every request uses a Lambert azimuthal equal-area projection
on the feature, with the box in meters. Positions come from a formula known to the
client in both directions, so no response header is needed. The ground keeps its
proportions at every latitude, and the poles need no special case. The outline and
the dimming outside it are drawn in the canvas, so the request holds no shape.

**Frame.** The frame is 211 × 150 px, requested at 2×. A shape's box fits the
projected ring with a margin of 10% of its longer side, at least 16 file pixels
across. The rest of the frame shows more of the surroundings, dimmed.

A point's box is `width = min(64 × file pixel, 1000 km)`, with the height from the
frame's proportions. The file pixel is `(east - west) / width` from `/cog/info`.
`lri:resolution_km` is unsuitable: it holds 43 to 150 km on files with 2.6 to 15 km
pixels. Many coarse files hold blocks larger than their pixel, so the cap is judged
on blocks across the frame:

| File pixel | True block | Files | 64 pixels | Cap 500 km | Cap 1000 km |
|---|---|---|---|---|---|
| 59 m | 59 m | 11 | 3.8 km | 3.8 km, 64 | 3.8 km, 64 |
| 1 km | 1 km | 8 | 64 km | 64 km, 64 | 64 km, 64 |
| 2.6 km | 8 km | 5 | 170 km | 170 km, 21 | 170 km, 21 |
| 15 km | 15 km | 3 | 970 km | 500 km, 33 | 970 km, 64 |
| 15 km | 60 km | 4 | 970 km | 500 km, 8 | 970 km, 16 |
| 15 km | 136 km | 7 | 970 km | 500 km, 4 | 970 km, 7 |
| 30 km | 30 km | 4 | 1940 km | 500 km, 16 | 1000 km, 33 |
| 30 km | 60 km | 9 | 1940 km | 500 km, 8 | 1000 km, 16 |

The cap of 1000 km is a judgment within two limits. The box must show neighbors
around the point's block in every direction, which 4 blocks across does not.
Without a cap, 30 km files reach 1940 km, over half the Moon's diameter, with about
8% difference between radial and tangential scale at the frame's side; at 1000 km
that difference is about 2%. The cap changes only the 13 files at 30 km.

**180° meridian.** A box touching 180° makes the tiler read the file's whole width:
12 to 50 s on Shi files, against about 0.15 s for each part below, and the proxy
times out at 30 s. A box across it moves its projection to longitude 180, which
makes the meridian the line x = 0, and sends two requests stopping 5 m short of it,
with widths in proportion. The parts are composed side by side. The difference in
values between neighboring columns across the split equals that of one request. A
box holding a pole is not split: it crosses every meridian, and files reaching a
pole answer quickly.

**Values.** The tiler truncates, `gray = floor((v - lo) / (hi - lo) * 255)`, so only
`hi` gives 255. Other levels read as their middle, with an error of half a level at
most. The readout shows the line's decimals, or fewer when one level is coarser. A
level on Shi FeO is 0.094 wt%. A gray PNG is about 30 KB at this size against 1 MB
for float `.npy`, and the proxy has no gzip. The difference shows only on map colors
with a range under about 1 wt%.

**Colors.** The top left button moves through gray, viridis, and the map's colors
when the layer on the map differs from both at the whole Moon range. The browser
colors one gray image through the table in `services/ColormapService.ts`, so a change
sends no request. Gray or viridis holds for the session. The map's colors apply to
the picture they were pressed on and fall back to gray when the layer leaves the map.
The range filter applies as on the map, without its extra transparency of the
colormap's first color.

**Highlight and limit.** A histogram bar or the Most line lights its values on the
picture, off when a bin is narrower than 2 gray levels, since levels cannot separate
such bins. At a point's clipped limit, the picture tints the level holding the limit,
within `lri:clipped_longitudes` when set. At the high end level 255 is exact; at the
low end level 0 also holds values within one level above the limit.

**NoData and terrain.** NoData is transparent. The polar files declare no NoData and
hold 0 in their corners, which shows black, as on the map. The top right button
replaces the values with the LROC WAC terrain over the same ground, requested on its
first press.

**Layout.** No state changes a popover's size: the frame and the two rows under it
have fixed heights, and the ramp, scale and buttons show only with a picture. The row
under the ramp holds the first that applies: the value under the pointer, the values
lit, the share at the limit, a point's box, or a hint on a shape.

## Configuration reference

| Concern | Defined in |
|---|---|
| Frame, point box, cap, shape margin, 180° gap | `src/services/inspector/pictureGeometry.ts` |
| Highlight minimum, gray level rules | `src/services/inspector/pictureValues.ts` |
| Pictures kept in memory | `src/services/inspector/PictureStore.ts` |
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
