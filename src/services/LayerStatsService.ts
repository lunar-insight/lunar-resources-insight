import { layersConfig, fetchCogStatistics } from '../geoConfigExporter';

export interface LayerStats {
  min: number;
  max: number;
  mean?: number;
  stddev?: number;
  median?: number;
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
      const stats = await fetchCogStatistics(filename);

      this.statsMap.set(layerId, {
        min: stats.min,
        max: stats.max,
        mean: stats.mean,
        stddev: stats.std,
        median: stats.median,
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
}

// Singleton
export const layerStatsService = new LayerStatsService();