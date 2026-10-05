import { layersConfig, fetchCogStatistics, CogStatistics, LayerConfig } from '../geoConfigExporter';

export interface LayerStats {
  min: number;
  max: number;
  mean?: number;
  stddev?: number;
  median?: number;
  histogram?: [number[], number[]]; // [counts, bins];
  percentile_2?: number;
  percentile_15?: number;
  percentile_85?: number;
  percentile_95?: number;
  percentile_98?: number;
  loaded: boolean;
}

export type GeochemicalClass =
  | 'highly-depleted'
  | 'depleted' 
  | 'background'
  | 'enriched'
  | 'highly-enriched'
  | 'anomalous';

const NOT_LOADED: LayerStats = { min: 0, max: 100, loaded: false };

type LoadedPercentiles = LayerStats & Required<Pick<LayerStats,
  'percentile_2' | 'percentile_15' | 'percentile_85' | 'percentile_95' | 'percentile_98'>>;

// A percentile of 0 is a real value: mineral maps and the polar files hold exact zeros.
function hasPercentiles(stats: LayerStats): stats is LoadedPercentiles {
  return stats.loaded && [
    stats.percentile_2, stats.percentile_15, stats.percentile_85, stats.percentile_95, stats.percentile_98,
  ].every(value => Number.isFinite(value));
}

// Percentile interpolation for bar positions, from 0 to 1. 0.5 when the percentiles are missing.
export function continuousPercentilePosition(stats: LayerStats, value: number): number {
  if (!hasPercentiles(stats)) return 0.5;

  const percentilePoints = [
    { value: stats.min, percentile: 0 },
    { value: stats.percentile_2, percentile: 2 },
    { value: stats.percentile_15, percentile: 15 },
    { value: stats.percentile_85, percentile: 85 },
    { value: stats.percentile_95, percentile: 95 },
    { value: stats.percentile_98, percentile: 98 },
    { value: stats.max, percentile: 100 }
  ];

  if (value <= percentilePoints[0].value) return 0;
  if (value >= percentilePoints[percentilePoints.length - 1].value) return 1;

  for (let i = 0; i < percentilePoints.length - 1; i++) {
    const lower = percentilePoints[i];
    const upper = percentilePoints[i + 1];
    if (value >= lower.value && value <= upper.value) {
      const percentile = upper.value === lower.value
        ? lower.percentile
        : lower.percentile + ((value - lower.value) / (upper.value - lower.value)) * (upper.percentile - lower.percentile);
      return percentile / 100;
    }
  }

  // Percentiles out of order, which a valid response never holds
  return 0.5;
}

export function classifyGeochemicalStats(stats: LayerStats, value: number): GeochemicalClass {
  if (!hasPercentiles(stats)) return 'background';

  if (value > stats.percentile_98) return 'anomalous';
  if (value > stats.percentile_95) return 'highly-enriched';
  if (value > stats.percentile_85) return 'enriched';
  if (value > stats.percentile_15) return 'background';
  if (value > stats.percentile_2) return 'depleted';
  return 'highly-depleted';
}

// The file a layer reads by default: its first variant, which is its finest.
export function defaultFileOf(config: LayerConfig): string {
  return config.variants?.[0]?.filename ?? config.filename;
}

export async function initializeLayerStats() {
  await layerStatsService.initialize();
  return layerStatsService;
}

/**
 * Whole Moon statistics, stored by file. Each layer's default file is fetched at
 * start, other variants on first use. The map and the scanner read the file a
 * layer shows (`getLayerStats`), the Inspector reads files directly.
 */
export class LayerStatsService {
  private statsByFile = new Map<string, LayerStats>();
  private requests = new Map<string, Promise<LayerStats>>();
  // Files shown on the map, set on a variant switch. A layer absent here shows its default file.
  private activeFiles = new Map<string, string>();
  private pendingActiveFiles = new Map<string, string>();
  private listeners = new Set<() => void>();
  private initPromise: Promise<void> | null = null;
  private initialized = false;

  constructor(private readonly retryDelayMs = 2000) {}

  async initialize(): Promise<void> {
    this.initPromise ??= this.loadAllLayerStats();
    await this.initPromise;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async loadAllLayerStats(): Promise<void> {
    const files = new Set<string>();
    Object.values(layersConfig.layers).forEach(config => {
      if (config.available !== false && config.layerType !== 'vector') {
        files.add(defaultFileOf(config));
      }
    });

    await Promise.allSettled([...files].map(filename => this.ensureFileStats(filename)));
  }

  // One retry after a delay, so a tiler restart or a dropped connection does not mark the file missing.
  private async fetchWithRetry(filename: string): Promise<LayerStats> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response: CogStatistics = await fetchCogStatistics(filename);
        const b1Stats = response.b1;
        if (!b1Stats) throw new Error(`No b1 stats found for ${filename}`);

        return {
          min: b1Stats.min,
          max: b1Stats.max,
          mean: b1Stats.mean,
          stddev: b1Stats.std,
          median: b1Stats.median,
          histogram: b1Stats.histogram ? [b1Stats.histogram[0], b1Stats.histogram[1]] : undefined,
          percentile_2: b1Stats.percentile_2,
          percentile_15: b1Stats.percentile_15,
          percentile_85: b1Stats.percentile_85,
          percentile_95: b1Stats.percentile_95,
          percentile_98: b1Stats.percentile_98,
          loaded: true
        };
      } catch (error) {
        if (attempt === 2) {
          console.error(`Failed to load stats for ${filename}:`, error);
          return NOT_LOADED;
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
      }
    }
    return NOT_LOADED;
  }

  /** Loaded statistics are kept; a file being fetched shares its request. */
  ensureFileStats(filename: string): Promise<LayerStats> {
    const stored = this.statsByFile.get(filename);
    if (stored?.loaded) return Promise.resolve(stored);

    let request = this.requests.get(filename);
    if (!request) {
      request = this.fetchWithRetry(filename).then(stats => {
        this.statsByFile.set(filename, stats);
        this.requests.delete(filename);
        this.notify();
        return stats;
      });
      this.requests.set(filename, request);
    }
    return request;
  }

  /** Fetches again every file in the list whose statistics are not loaded. */
  async retryMissing(filenames: string[]): Promise<void> {
    const missing = [...new Set(filenames)].filter(filename => !this.statsByFile.get(filename)?.loaded);
    await Promise.allSettled(missing.map(filename => this.ensureFileStats(filename)));
  }

  getFileStats(filename: string): LayerStats {
    return this.statsByFile.get(filename) ?? NOT_LOADED;
  }

  isFileLoaded(filename: string): boolean {
    return this.getFileStats(filename).loaded;
  }

  /** The file the map shows for a layer. */
  fileFor(layerId: string): string | undefined {
    const config = layersConfig.layers[layerId];
    return this.activeFiles.get(layerId) ?? (config ? defaultFileOf(config) : undefined);
  }

  /** Statistics of the file the map shows for a layer. */
  getLayerStats(layerId: string): LayerStats {
    const filename = this.fileFor(layerId);
    return filename ? this.getFileStats(filename) : NOT_LOADED;
  }

  /**
   * Records the variant the map shows once its statistics are fetched, so the
   * previous file's statistics stay in use until then. Of overlapping switches
   * on one layer, the last one wins.
   */
  async setActiveFile(layerId: string, filename: string): Promise<LayerStats> {
    this.pendingActiveFiles.set(layerId, filename);
    const stats = await this.ensureFileStats(filename);
    if (this.pendingActiveFiles.get(layerId) === filename) {
      this.pendingActiveFiles.delete(layerId);
      this.activeFiles.set(layerId, filename);
    }
    return stats;
  }

  /** The layer shows its default file again, as after it is removed from the map. */
  clearActiveFile(layerId: string): void {
    this.pendingActiveFiles.delete(layerId);
    this.activeFiles.delete(layerId);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  getLayerConfig(layerId: string): LayerConfig | undefined {
    return layersConfig.layers[layerId];
  }

  getAllLayerIds(): string[] {
    return Object.keys(layersConfig.layers);
  }

  getLayerByCategory(category: string): [string, LayerConfig][] {
    return Object.entries(layersConfig.layers)
      .filter(([, config]) => config.category === category);
  }

  getLayersByElement(element: string): [string, LayerConfig][] {
    return Object.entries(layersConfig.layers)
      .filter(([, config]) =>
        config.category === 'chemical' &&
        config.element === element
      );
  }

  getFirstLayerByElement(element: string): [string, LayerConfig] | undefined {
    const layers = this.getLayersByElement(element);
    return layers.length > 0 ? layers[0]: undefined;
  }

  // Percentile interpolation for graph bars height
  calculateContinuousPercentilePosition(layerId: string, value: number): number {
    return continuousPercentilePosition(this.getLayerStats(layerId), value);
  }

  // Geochemical classification based on percentiles
  classifyGeochemicalValue(layerId: string, value: number): GeochemicalClass {
    return classifyGeochemicalStats(this.getLayerStats(layerId), value);
  }

  // Method to obtain the exact percentile of a value (for bar height)
  getExactPercentile(layerId: string, value: number): number {
    return this.calculateContinuousPercentilePosition(layerId, value) * 100;
  }

  // Not used
  calculatePercentile(layerId: string, value: number): number {
    const stats = this.getLayerStats(layerId);
    if (!stats.loaded || !stats.histogram) {
      console.warn(`Histogram not available for layer ${layerId}`);
      return 0;
    }

    return this.calculatePercentileFromHistogram(value, stats.histogram);
  }

  // Not used
  private calculatePercentileFromHistogram(value: number, histogram: [number[], number[]]): number {
    const [counts, bins] = histogram;

    // Extreme case
    if (value <= bins[0]) return 0;
    if (value >= bins[bins.length - 1]) return 100;

    // Find the bin containing the value
    let binIndex = -1;
    for (let i = 0; i < bins.length - 1; i++) {
      if (value >= bins[i] && value < bins[i + 1]) {
        binIndex = i;
        break;
      }
    }

    if (binIndex === -1) return 100; // Value >= last bins

    // Cumulated percentile value calculation
    const totalCount = counts.reduce((sum, count) => sum + count, 0);
    let cumulativeCount = 0;

    // Sum up to last bin
    for (let i = 0; i < binIndex; i++) {
      cumulativeCount += counts[i];
    }

    // Linear interpolation at the current bin
    const binWidth = bins[binIndex + 1] - bins[binIndex];
    const positionInBin = (value - bins[binIndex]) / binWidth;
    const countInBin = counts[binIndex] * positionInBin;

    const percentile = ((cumulativeCount + countInBin) / totalCount) * 100;
    return Math.min(Math.max(percentile, 0), 100);
  }
}

// Singleton
export const layerStatsService = new LayerStatsService();