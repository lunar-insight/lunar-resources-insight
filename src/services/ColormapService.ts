import { colormapCategories, fetchColormapData, buildGradientPreviewUrl } from "../geoConfigExporter";
import * as Cesium from 'cesium';

class ColormapService {
  private colormapFirstColors: Map<string, Cesium.Color>;
  private preloadedGradients: Map<string, string>;
  private initPromise: Promise<void> | null;
  private initialized: boolean;

  private readonly STANDARD_WIDTH = 600;
  private readonly STANDARD_HEIGHT = 30;

  constructor() {
    this.colormapFirstColors = new Map();
    this.preloadedGradients = new Map();
    this.initPromise = null;
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadAllColormapData();
    await this.initPromise;
    this.initialized = true;
    return this.initPromise
  }

  private async loadAllColormapData(): Promise<void> {
    const colorPromises = [];
    const preloadPromises = [];

    for (const [category, colormaps] of Object.entries(colormapCategories)) {
      for (const colormapName of colormaps) {
        colorPromises.push(this.fetchAndStoreColormapFirstColor(colormapName));
        preloadPromises.push(this.preloadGradient(colormapName));
      }
    }

    await Promise.all([
      Promise.allSettled(colorPromises),
      Promise.allSettled(preloadPromises)
    ]);

    console.log(`Colormaps preloaded: ${this.preloadedGradients.size}`);
  }
  
  private async fetchAndStoreColormapFirstColor(colormapName: string): Promise<void> {
    try {
      const colormapData = await fetchColormapData(colormapName);
      const rgba = colormapData['0'];

      if (!rgba || rgba.length !== 4) {
        console.warn(`Invalid colormap data for ${colormapName}, using black as default`);
        this.colormapFirstColors.set(colormapName, new Cesium.Color(0, 0, 0, 1));
        return;
      }

      // Convert to Cesium.color (normalization from 0-255 to 0-1)
      const firstColor = new Cesium.Color(
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
        rgba[3] / 255
      );

      this.colormapFirstColors.set(colormapName, firstColor);
    } catch (error) {
      console.error(`Failed to fetch colormap data for ${colormapName}:`, error);
      // Default to black
      this.colormapFirstColors.set(colormapName, new Cesium.Color(0, 0, 0, 1));
    }
  }

  private async preloadGradient(colormapName: string): Promise<void> {
    try {
      const url = buildGradientPreviewUrl(
        colormapName,
        this.STANDARD_WIDTH, 
        this.STANDARD_HEIGHT
      );

      await this.preloadImage(url);

      this.preloadedGradients.set(colormapName, url);
    } catch (error) {
      console.error(`Error preloading gradient ${colormapName}:`, error);
    }
  }

  private preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  getColormapFirstColor(colormapName: string): Cesium.Color {
    return this.colormapFirstColors.get(colormapName) || new Cesium.Color(0, 0, 0, 1);
  }

  getGradientUrl(colormapName: string): string {
    if (this.preloadedGradients.has(colormapName)) {
      return this.preloadedGradients.get(colormapName)!;
    }
    
    return buildGradientPreviewUrl(
      colormapName,
      this.STANDARD_WIDTH,
      this.STANDARD_HEIGHT
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const colormapService = new ColormapService();

export async function initializeColormapService() {
  await colormapService.initialize();
  return colormapService;
}