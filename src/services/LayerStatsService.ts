import { layersConfig, fetchCogStatistics, CogStatistics } from '../geoConfigExporter';

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

export interface LayerConfig {
  filename: string;
  category: string;
  element?: string;
  displayName?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export type GeochemicalClass =
  | 'highly-depleted'
  | 'depleted' 
  | 'background'
  | 'enriched'
  | 'highly-enriched'
  | 'anomalous';

export async function initializeLayerStats() {
  await layerStatsService.initialize();
  return layerStatsService;
}

class LayerStatsService {
  private statsMap: Map<string, LayerStats>;
  private initPromise: Promise<void> | null;
  private initialized: boolean;

  constructor() {
    this.statsMap = new Map();
    this.initPromise = null;
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadAllLayerStats();
    await this.initPromise;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async loadAllLayerStats(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    Object.entries(layersConfig.layers).forEach(([layerId, config]) => {
      // Set default statistics while waiting to load
      this.statsMap.set(layerId, {
        min: 0,
        max: 100,
        loaded: false
      });

      const fetchPromise = this.fetchAndStoreStats(layerId, config.filename);
      fetchPromises.push(fetchPromise);
    });

    await Promise.allSettled(fetchPromises);
    console.log('All layer statistics loaded');
  }

  private async fetchAndStoreStats(layerId: string, filename: string): Promise<void> {
    try {
      const response: CogStatistics = await fetchCogStatistics(filename);
      const b1Stats = response.b1;

      if (!b1Stats) {
        throw new Error(`No b1 stats found for ${filename}`);
      }

      this.statsMap.set(layerId, {
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
      });
      
    } catch (error) {
      console.error(`Failed to load stats for layer ${layerId}:`, error);

      this.statsMap.set(layerId, {
        min: 0,
        max: 100,
        loaded: false
      });
    }
  }

  getLayerStats(layerId: string): LayerStats {
    return this.statsMap.get(layerId) || { min: 0, max: 100, loaded: false};
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
    const stats = this.getLayerStats(layerId);
    if (!stats.loaded || !stats.percentile_2 || !stats.percentile_15 || !stats.percentile_85 || !stats.percentile_95 || !stats.percentile_98) {
      return 0.5; // Default position
    }

    // Reference point (value -> percentile)
    const percentilePoints = [
      { value: stats.min, percentile: 0},
      { value: stats.percentile_2, percentile: 2 },
      { value: stats.percentile_15, percentile: 15 },
      { value: stats.percentile_85, percentile: 85 },
      { value: stats.percentile_95, percentile: 95 },
      { value: stats.percentile_98, percentile: 98 },
      { value: stats.max, percentile: 100 }
    ];

    let lowerPoint = percentilePoints[0];
    let upperPoint = percentilePoints[percentilePoints.length - 1];

    // TODO see if optimize after
    for (let i = 0; i < percentilePoints.length - 1; i++) {
      if (value >= percentilePoints[i].value && value <= percentilePoints[i + 1].value) {
        lowerPoint = percentilePoints[i];
        upperPoint = percentilePoints[i + 1];
        break;
      }
    }

    // Linear interpolation between the two points
    let interpolatedPercentile;
    if (upperPoint.value === lowerPoint.value) {
      interpolatedPercentile = lowerPoint.percentile;
    } else {
      const ratio = (value - lowerPoint.value) / (upperPoint.value - lowerPoint.value);
      interpolatedPercentile = lowerPoint.percentile + ratio * (upperPoint.percentile - lowerPoint.percentile)
    }

    return interpolatedPercentile / 100;
  }

  // Geochemical classification based on percentiles
  classifyGeochemicalValue(layerId: string, value: number): GeochemicalClass {
    const stats = this.getLayerStats(layerId);
    if (!stats.loaded || !stats.percentile_2 || !stats.percentile_15 || !stats.percentile_85 || !stats.percentile_95 || !stats.percentile_98) {
      return "background";
    }

    if (value > stats.percentile_98) return 'anomalous';
    if (value > stats.percentile_95) return 'highly-enriched';
    if (value > stats.percentile_85) return 'enriched';
    if (value > stats.percentile_15) return 'background';
    if (value > stats.percentile_2) return 'depleted';
    return 'highly-depleted';
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