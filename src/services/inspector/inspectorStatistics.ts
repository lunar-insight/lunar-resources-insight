import { continuousPercentilePosition, type LayerStats } from 'services/LayerStatsService';
import type { InspectorLine } from './inspectorLayers';

/** Spread ratio below which a layer reads Uniform. */
export const UNIFORM_BELOW = 0.35;
/** Spread ratio from which a layer reads Highly variable. */
export const HIGHLY_VARIABLE_FROM = 0.75;
/** |mean − median| over the whole Moon p15 to p85 width from which a shape is marked skewed. */
export const SKEW_FROM = 0.15;
/** Below this many native cells, p15 and p85 are set by the few cells a shape hits. */
export const MIN_CELLS = 10;
/** The coverage pie shows below this share of the shape. */
export const COVERAGE_SHOWN_BELOW = 95;
/** A comparison cell under this coverage is muted and never takes the row highlight. */
export const RANKED_FROM_COVERAGE = 50;

export type SpreadWord = 'Uniform' | 'Variable' | 'Highly variable';

/**
 * Pixel counts in equal bins from the shape's lowest to highest value, with
 * one more edge than counts. Every pixel the outline touches counts fully,
 * while the other statistics weight pixels by their share inside the shape.
 */
export interface Histogram {
  counts: number[];
  edges: number[];
}

/** Statistics over the pixels inside a feature, or over a line's samples. */
export interface FeatureStatistics {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p15: number;
  p85: number;
  /** Pixels or samples holding data. */
  count: number;
  /** Share of the feature holding data, 0 to 100. */
  coverage: number;
  /** Shapes only. */
  histogram?: Histogram;
}

export interface PopoverContent {
  title: string;
  lines: [string, string][];
  sentence?: string;
  /** A second paragraph after the sentence. */
  note?: string;
}

export function formatValue(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const withUnit = (text: string, unit?: string) => (unit ? `${text} ${unit}` : text);

/** The layer's whole Moon p15 to p85 width, or null without statistics. */
export const moonWidth = (moon: LayerStats): number | null => {
  if (!moon.loaded || !Number.isFinite(moon.percentile_15) || !Number.isFinite(moon.percentile_85)) return null;
  const width = moon.percentile_85 - moon.percentile_15;
  return width > 0 ? width : null;
};

/** The shape's p15 to p85 width over the layer's whole Moon p15 to p85 width. */
export function spreadRatio(shape: Pick<FeatureStatistics, 'p15' | 'p85'>, moon: LayerStats): number | null {
  const width = moonWidth(moon);
  return width === null ? null : (shape.p85 - shape.p15) / width;
}

/** The shape's mean minus its median, over the layer's whole Moon p15 to p85 width. */
export function skewRatio(shape: Pick<FeatureStatistics, 'mean' | 'median'>, moon: LayerStats): number | null {
  const width = moonWidth(moon);
  return width === null ? null : (shape.mean - shape.median) / width;
}

export function spreadWord(ratio: number): SpreadWord {
  if (ratio < UNIFORM_BELOW) return 'Uniform';
  if (ratio < HIGHLY_VARIABLE_FROM) return 'Variable';
  return 'Highly variable';
}

export function cellCount(areaKm2: number, resolutionKm: number): number {
  return areaKm2 / (resolutionKm * resolutionKm);
}

/**
 * Where more than half of a skewed shape lies against its average: below when
 * the mean is above the median, above when it is below.
 */
export type SkewSide = 'below' | 'above';

export type SpreadState =
  | {
    kind: 'spread';
    word: SpreadWord;
    mean: number;
    median: number;
    p15: number;
    p85: number;
    lowest: number;
    highest: number;
    skew: SkewSide | null;
    /** Absent when the shape holds a single value or the response has none. */
    histogram?: Histogram;
  }
  | { kind: 'low-resolution'; cellSizeKm: number; cells: number };

/**
 * What the spread slot of a shape's line shows. Empty (null) while the whole
 * Moon statistics are missing, since both states compare against the layer.
 * Without the area or the resolution the cells cannot be counted, so the
 * spread is shown.
 */
export function spreadState(
  shape: FeatureStatistics,
  moon: LayerStats,
  areaKm2: number | undefined,
  resolutionKm?: number,
): SpreadState | null {
  const ratio = spreadRatio(shape, moon);
  const skew = skewRatio(shape, moon);
  if (ratio === null || skew === null) return null;

  if (areaKm2 !== undefined && resolutionKm && resolutionKm > 0) {
    const cells = cellCount(areaKm2, resolutionKm);
    if (cells < MIN_CELLS) return { kind: 'low-resolution', cellSizeKm: resolutionKm, cells };
  }

  return {
    kind: 'spread',
    word: spreadWord(ratio),
    mean: shape.mean,
    median: shape.median,
    p15: shape.p15,
    p85: shape.p85,
    lowest: shape.min,
    highest: shape.max,
    skew: Math.abs(skew) >= SKEW_FROM ? (skew > 0 ? 'below' : 'above') : null,
    // One value has no distribution to draw, and its bins would span a made-up range around it
    ...(shape.histogram && shape.min < shape.max ? { histogram: shape.histogram } : {}),
  };
}

/** Accessible name and hover text of the spread icon. */
export function spreadLabel(state: SpreadState): string {
  if (state.kind === 'low-resolution') return 'Low resolution';
  return state.skew ? `${state.word}, more than half ${state.skew} the average` : state.word;
}

export function spreadPopover(state: SpreadState, line: Pick<InspectorLine, 'decimals' | 'unit'>): PopoverContent {
  if (state.kind === 'low-resolution') {
    const cells = state.cells < 1 ? 'less than 1' : String(Math.round(state.cells));
    return {
      title: 'Low resolution',
      lines: [['Cell size', `~${Math.round(state.cellSizeKm)} km`], ['Cells here', cells]],
    };
  }
  const fmt = (v: number) => formatValue(v, line.decimals);
  // With a histogram, the lowest and highest values label the ends of its axis
  const ends: [string, string][] = state.histogram ? [] : [['Lowest', fmt(state.lowest)], ['Highest', fmt(state.highest)]];
  return {
    title: state.word,
    lines: [
      ['Median', withUnit(fmt(state.median), line.unit)],
      ['Most', withUnit(`${fmt(state.p15)} to ${fmt(state.p85)}`, line.unit)],
      ...ends,
    ],
    sentence: state.skew ? `More than half the shape is ${state.skew} the average.` : undefined,
  };
}

export interface HistogramBin {
  from: number;
  to: number;
  /** Share of the counted pixels, 0 to 100. */
  share: number;
}

export function histogramBins(histogram: Histogram): HistogramBin[] {
  const total = histogram.counts.reduce((sum, count) => sum + count, 0);
  return histogram.counts.map((count, i) => ({
    from: histogram.edges[i],
    to: histogram.edges[i + 1],
    share: total > 0 ? (count / total) * 100 : 0,
  }));
}

/** Hover text of a histogram bar. */
export function binText(bin: HistogramBin, line: Pick<InspectorLine, 'decimals' | 'unit'>): string {
  const share = bin.share === 0 ? '0%' : bin.share < 1 ? 'less than 1%' : `${Math.round(bin.share)}%`;
  const range = withUnit(`${formatValue(bin.from, line.decimals)} to ${formatValue(bin.to, line.decimals)}`, line.unit);
  return `${range}: ${share} of pixels`;
}

export const showsCoverage = (coverage: number | undefined): coverage is number =>
  coverage !== undefined && coverage < COVERAGE_SHOWN_BELOW;

export const isRanked = (coverage: number | undefined) =>
  coverage === undefined || coverage >= RANKED_FROM_COVERAGE;

export const coverageText = (coverage: number) => `${Math.round(coverage)}%`;

export function coveragePopover(coverage: number, inComparison = false): PopoverContent {
  return {
    title: 'Partial data',
    lines: [['Covered', `${coverageText(coverage)} of the area`]],
    sentence: inComparison && !isRanked(coverage)
      ? 'The average uses that part only, so it is not ranked.'
      : 'The average uses that part only.',
  };
}

/** A map's clipping, from the `lri:clipped_*` fields of its catalog item. */
export interface ClippedRange {
  /** Values beyond these are set to them. */
  range: [number, number];
  /** Where the clip applies, [west, east] in degrees. Everywhere when absent. */
  longitudes?: [number, number];
  /** One sentence per end, shown after the generic sentence. */
  notes?: { low?: string; high?: string };
}

export interface LimitState {
  end: 'low' | 'high';
  limit: number;
  note?: string;
}

export const LIMIT_LABEL = "At the map's limit";

/**
 * The end of the clipped range a point value sits at, or null. Point values
 * are the float32 pixels and every range end is exact in float32, so the
 * match is exact.
 */
export function limitState(value: number, clip: ClippedRange | undefined, lon: number): LimitState | null {
  if (!clip) return null;
  if (clip.longitudes && (lon < clip.longitudes[0] || lon > clip.longitudes[1])) return null;
  const [low, high] = clip.range;
  const end = value === low ? 'low' : value === high ? 'high' : null;
  if (!end) return null;
  return { end, limit: value, note: clip.notes?.[end] };
}

export function limitPopover(state: LimitState, line: Pick<InspectorLine, 'decimals' | 'unit'>): PopoverContent {
  return {
    title: LIMIT_LABEL,
    lines: [['Limit', withUnit(formatValue(state.limit, line.decimals), line.unit)]],
    sentence: 'Values beyond the limit are set to it.',
    note: state.note,
  };
}

export type BarScale =
  | { kind: 'reference'; min: number; max: number }
  | { kind: 'percentile'; stats: LayerStats }
  | { kind: 'none' };

/** Hybrid: the reference range when one exists, the percentile otherwise. */
export function barScale(line: Pick<InspectorLine, 'referenceRange'>, moon: LayerStats): BarScale {
  if (line.referenceRange) return { kind: 'reference', ...line.referenceRange };
  return moon.loaded ? { kind: 'percentile', stats: moon } : { kind: 'none' };
}

/** Fill of the bar, from 0 to 1. */
export function barPosition(scale: BarScale, value: number): number {
  if (scale.kind === 'reference') {
    const span = scale.max - scale.min;
    return span > 0 ? Math.min(1, Math.max(0, (value - scale.min) / span)) : 0;
  }
  if (scale.kind === 'percentile') return continuousPercentilePosition(scale.stats, value);
  return 0;
}

// Gamma ray counting noise falls on both sides of the true value, so near 0 a reading can be negative.
const BELOW_ZERO = 'Below 0 from counting noise: the abundance is close to 0.';

export function barPopover(
  scale: BarScale,
  value: number,
  line: Pick<InspectorLine, 'decimals' | 'unit' | 'scaleLabels'>,
): PopoverContent {
  if (scale.kind === 'reference') {
    const fmt = (v: number) => formatValue(v, line.decimals);
    const range: [string, string] = ['Range', withUnit(`${fmt(scale.min)} to ${fmt(scale.max)}`, line.unit)];
    const labels: [string, string][] = line.scaleLabels
      ? [['Low', line.scaleLabels.low], ['High', line.scaleLabels.high]]
      : [];
    return { title: 'Reference range', lines: [range, ...labels], sentence: value < 0 ? BELOW_ZERO : undefined };
  }
  if (scale.kind === 'percentile') {
    const rank = Math.round(continuousPercentilePosition(scale.stats, value) * 100);
    const sentence = `Higher than ${rank}% of this dataset.`;
    return { title: 'Percentile', lines: [], sentence: value < 0 ? `${sentence} ${BELOW_ZERO}` : sentence };
  }
  return {
    title: 'Scale unavailable',
    lines: [],
    sentence: 'Could not load the values to compare against. Reopen the Inspector to retry.',
  };
}

export type NoDataReason = 'outside' | 'inside';

export function noDataPopover(reason: NoDataReason, extent?: string): PopoverContent {
  return {
    title: 'No data',
    lines: [],
    sentence: reason === 'outside' && extent
      ? `This dataset covers ${extent}.`
      : 'This dataset has no measurements at this location.',
  };
}

const latitudeText = (lat: number) => {
  const rounded = Math.round(lat);
  return rounded === 0 ? '0°' : `${Math.abs(rounded)}°${rounded > 0 ? 'N' : 'S'}`;
};

/** Extent of a dataset in words, from its bounds [west, south, east, north] in degrees. */
export function formatExtent(bounds: number[]): string {
  const [west, south, east, north] = bounds;
  const latitudes = `${latitudeText(north)} to ${latitudeText(south)}`;
  // Near global longitudes, such as the CLASS maps, read as latitudes only.
  if (east - west >= 355) return latitudes;
  return `${latitudes}, ${Math.round(west)}° to ${Math.round(east)}° longitude`;
}

/** Extent of a polar pair, one file per pole, from the edge nearest the equator. */
export function formatPolarExtent(boundsList: number[][]): string {
  const edge = Math.min(...boundsList.map(([, south, , north]) => Math.min(Math.abs(south), Math.abs(north))));
  return `the poles, from ${Math.round(edge)}° latitude`;
}

export interface RankedCell {
  value: number;
  coverage?: number;
}

/**
 * Indices of the highest value in a comparison row. Cells under 50% coverage
 * cannot take it, and a row needs two ranked cells for a highlight.
 */
export function highlightedCells(cells: (RankedCell | null)[]): Set<number> {
  const ranked = cells
    .map((cell, index) => ({ cell, index }))
    .filter((entry): entry is { cell: RankedCell; index: number } => entry.cell !== null && isRanked(entry.cell.coverage));
  if (ranked.length < 2) return new Set();
  const best = Math.max(...ranked.map(entry => entry.cell.value));
  return new Set(ranked.filter(entry => entry.cell.value === best).map(entry => entry.index));
}

const quantile = (sorted: number[], q: number): number => {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** Statistics over a line's samples. Coverage is the share of samples holding data. */
export function statisticsOfSamples(samples: (number | null)[]): FeatureStatistics | null {
  const values = samples.filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return {
    mean,
    median: quantile(sorted, 0.5),
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p15: quantile(sorted, 0.15),
    p85: quantile(sorted, 0.85),
    count: values.length,
    coverage: (values.length / samples.length) * 100,
  };
}
