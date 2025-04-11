import { colormapCategories, fetchColormapData } from "../geoConfigExporter";
import * as Cesium from 'cesium';

class ColormapService {
  private colormapFirstColors: Map<string, Cesium.Color>;
  private initPromise: Promise<void> | null;
  private initialized: boolean;

  constructor() {
    this.colormapFirstColors = new Map();
    this.initPromise = null;
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadAllColormapFirstColors();
    await this.initPromise;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async loadAllColormapFirstColors(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    for (const [category, colormaps] of Object.entries(colormapCategories)) {
      for (const colormapName of colormaps) {
        const fetchPromise = this.fetchAndStoreColormapFirstColor(colormapName);
        fetchPromises.push(fetchPromise);
      }
    }

    await Promise.allSettled(fetchPromises);
    console.log(`All colormap first colors loaded (${this.colormapFirstColors.size} colormaps`);
  }

  private async fetchAndStoreColormapFirstColor(colormapName: string): Promise<void> {
    try {
      const colormapData = await fetchColormapData(colormapName);

      // First color extraction at index 0
      const rgba = colormapData['0'];
      if (!rgba || rgba.length !== 4) {
        console.warn(`Invalid colormap data for ${colormapName}, using black as default`);
        this.colormapFirstColors.set(colormapName, new Cesium.Color(0, 0, 0, 1));
        return;
      }

      // Convertion to Cesium.color (normalization from 0-255 to 0-1)
      const firstColor = new Cesium.Color(
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
        rgba[3] / 255
      );

      this.colormapFirstColors.set(colormapName, firstColor);
    } catch (error) {
      console.error(`Failed to fetch colormap data for ${colormapName}:`, error);
      // Defaut to black
      this.colormapFirstColors.set(colormapName, new Cesium.Color(0, 0, 0, 1));
    }
  }

  getColormapFirstColor(colormapName: string): Cesium.Color {
    return this.colormapFirstColors.get(colormapName) || new Cesium.Color(0, 0, 0, 1);
  }
}

export const colormapService = new ColormapService();

export async function initializeColormapService() {
  await colormapService.initialize();
  return colormapService;
}