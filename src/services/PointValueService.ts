import { getPointValueUrl, layersConfig } from '../geoConfigExporter';
import * as Cesium from 'cesium';

export interface PointValue {
  layerId: string;
  filename: string;
  lon: number;
  lat: number;
  value: number | null;
  error?: string;
}

export class PointValueService {
  private viewer: Cesium.Viewer | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private selectedLayers: string[] = [];
  private currentMousePosition: Cesium.Cartesian2 | null = null;
  private mouseMoveHandler: Cesium.ScreenSpaceEventHandler | null = null;

  constructor() {}

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
    this.setupMouseTracking();
  }

  setSelectedLayers(layers: string[]) {
    this.selectedLayers = layers;
  }

  private setupMouseTracking() {
    if (!this.viewer) return;

    if (this.mouseMoveHandler) {
      this.mouseMoveHandler.destroy();
    }

    this.mouseMoveHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    this.mouseMoveHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      this.currentMousePosition = event.endPosition;
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  start() {
    if (this.isActive || !this.viewer) return;
    
    this.isActive = true;
    this.intervalId = setInterval(() => {
      this.fetchPointValues();
    }, 1000);

    console.log('Point value fetching started - fetching every second at mouse position (lunar coordinates)');
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Point value fetching stopped');
  }

  private getCurrentPosition(): { lon: number; lat: number } | null {
    if (!this.viewer || !this.currentMousePosition) return null;

    // Ellipsoid setup in CesiumComponent
    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Mouse position to world coordinates conversion using the moon ellipsoid
    const cartesian = this.viewer.camera.pickEllipsoid(this.currentMousePosition, ellipsoid);

    if (!cartesian) return null;

    // Selenographic coordinate conversion
    const cartographic = ellipsoid.cartesianToCartographic(cartesian);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);

    return { lon, lat };
  }

  private async fetchPointValues() {
    const position = this.getCurrentPosition();
    if (!position) {
      console.log('Could not determine current mouse selenographic position (mouse might be off the moon surface)');
      return;
    }

    if (this.selectedLayers.length === 0) {
      console.log('No layers selected for point fetching');
      return;
    }

    const promises = this.selectedLayers.map(layerId =>
      this.fetchSinglePointValue(layerId, position.lon, position.lat)
    );

    try {
      const results = await Promise.allSettled(promises);
      const pointValues: PointValue[] = [];

      results.forEach((results, index) => {
        const layerId = this.selectedLayers[index];
        if (results.status === 'fulfilled') {
          pointValues.push(results.value);
        } else {
          pointValues.push({
            layerId,
            filename: layersConfig.layers[layerId]?.filename || 'unknown',
            lon: position.lon,
            lat: position.lat,
            value: null,
            error: results.reason?.message || 'Unknown error'
          });
        }
      });

      const values = pointValues.map(pv => pv.value)
      console.log('Values:', values);

    } catch(error) {
      console.error('Error fetching lunar point values:', error);
    }
  }

  private async fetchSinglePointValue(layerId: string, lon: number, lat: number): Promise<PointValue> {
    const layerConfig = layersConfig.layers[layerId];
    if (!layerConfig) {
      throw new Error(`Layer config not found for ${layerId}`);
    }

    const url = getPointValueUrl(layerConfig.filename, lon, lat, { 
      bidx: [1],
      coord_crs: 'IAU:30100'
    });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const value = data.values && data.values.length > 0 ? data.values[0] : null;

      return {
        layerId,
        filename: layerConfig.filename,
        lon,
        lat,
        value: typeof value === 'number' ? value :  null
      };
    } catch (error) {
      throw new Error(`Failed to fetch point value: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clean up
  destroy() {
    this.stop();
    if (this.mouseMoveHandler) {
      this.mouseMoveHandler.destroy();
      this.mouseMoveHandler = null;
    }
  }
}

export const pointValueService = new PointValueService();