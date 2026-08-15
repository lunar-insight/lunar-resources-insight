import React, { useState, useCallback, useRef, useEffect } from 'react'
import { getPointValueUrl, layersConfig } from '../geoConfigExporter';
import * as Cesium from 'cesium';
import { ScanIndicator } from '../components/viewer/ScanIndicator/ScanIndicator';
import { tree } from 'd3';

export interface PointValue {
  layerId: string;
  filename: string;
  lon: number;
  lat: number;
  value: number | null;
  error?: string;
}

export interface PointValueCallbackData {
  values: {[layerId: string]: number};
  // Layers whose request failed. A layer absent from both this list and
  // `values` has no data at this point, which the server reported successfully.
  unavailableLayerIds: string[];
  isPaused?: boolean;
}

export class PointValueService {
  private viewer: Cesium.Viewer | null = null;
  private isActive: boolean = false;
  private selectedLayers: string[] = [];
  private currentMousePosition: Cesium.Cartesian2 | null = null;
  private mouseMoveHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private isMouseTrackingEnabled: boolean = true;
  private isLeftButtonDown: boolean = false;
  private lastFetchTime: number = 0;
  private fetchThrottleMs: number = 100; // in ms, between requests. Can be 16, 33, 50-100
  private pendingFetch: NodeJS.Timeout | null = null;
  private isCurrentlyFetching: boolean = false;
  private hasPendingRequest: boolean = false;
  // Coordinates of the last batch that resolved with every layer answering.
  // pickEllipsoid is deterministic for a given screen pixel and camera, so
  // exact equality skips repeat requests for a point already sampled.
  private lastResolvedPosition: { lon: number; lat: number } | null = null;
  private readonly maxFetchAttempts: number = 2;
  private readonly retryDelayMs: number = 150;
  private scanIndicator: ScanIndicator = new ScanIndicator();
  private callbacks: Array<(data: PointValueCallbackData) => void> = [];
  private layerBounds: Map<string, Cesium.Rectangle> = new Map();
  private activeFilenames: Map<string, string> = new Map();

  constructor() {}

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
    this.scanIndicator.setViewer(viewer);
    this.setupMouseTracking();
  }

  setSelectedLayers(layers: string[]) {
    this.selectedLayers = layers;
    // The new selection has no values yet, so the current point needs sampling
    // again even though it was already resolved for the previous selection.
    this.lastResolvedPosition = null;
  }

  onValuesUpdate(callback: (data: PointValueCallbackData) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  private notifyValuesUpdate(
    values: {[layerId: string]: number},
    isPaused: boolean = false,
    unavailableLayerIds: string[] = []
  ) {
    const callbackData: PointValueCallbackData = {
      values: isPaused ? {} : values,
      unavailableLayerIds: isPaused ? [] : unavailableLayerIds,
      isPaused
    };

    this.callbacks.forEach(callback => {
      try {
        callback(callbackData);
      } catch (error) {
        console.error('Error in values update callback:', error);
      }
    });
  }

  private setupMouseTracking() {
    if (!this.viewer) return;

    if (this.mouseMoveHandler) {
      this.mouseMoveHandler.destroy();
    }

    this.mouseMoveHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    this.mouseMoveHandler.setInputAction(() => {
      this.isLeftButtonDown = true;
      this.scanIndicator.hide();
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    this.mouseMoveHandler.setInputAction(() => {
      this.isLeftButtonDown = false;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    this.mouseMoveHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (this.isMouseTrackingEnabled && this.isActive && !this.isLeftButtonDown) {
        this.currentMousePosition = event.endPosition;
        this.scanIndicator.updatePosition(event.endPosition);

        this.throttledFetchPointValues();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }
  
  private throttledFetchPointValues() {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;

    if (this.pendingFetch) {
      clearTimeout(this.pendingFetch);
      this.pendingFetch = null;
    }

    // A request is in flight. The newer position is recorded here and picked up
    // by executeFetch once that request completes.
    if (this.isCurrentlyFetching) {
      this.hasPendingRequest = true;
      return;
    }

    if (timeSinceLastFetch >= this.fetchThrottleMs) {
      this.executeFetch();
    } else {
      const delay = Math.max(this.fetchThrottleMs - timeSinceLastFetch, 10);
      this.pendingFetch = setTimeout(() => {
        this.pendingFetch = null;
        if (this.isActive && this.isMouseTrackingEnabled) {
          this.throttledFetchPointValues();
        }
      }, delay);
    }
  }

  private executeFetch() {
    this.lastFetchTime = Date.now();
    this.isCurrentlyFetching = true;
    this.hasPendingRequest = false;

    this.fetchPointValues().finally(() => {
      this.isCurrentlyFetching = false;

      // The cursor moved while this request was in flight, so the delivered
      // value is for a stale position. Fetch the current position now.
      if (this.hasPendingRequest && this.isActive && this.isMouseTrackingEnabled) {
        this.throttledFetchPointValues();
      }
    })
  }

  disableMouseTracking() {
    if (this.isMouseTrackingEnabled) {
      this.isMouseTrackingEnabled = false;
      this.scanIndicator.hide();
      this.notifyValuesUpdate({}, true);
      this.hasPendingRequest = false;

      if (this.pendingFetch) {
        clearTimeout(this.pendingFetch);
        this.pendingFetch = null;
      }
    }
  }

  enableMouseTracking() {
    if (!this.isMouseTrackingEnabled) {
      this.isMouseTrackingEnabled = true;
      this.resume();
    }
  }

  resume() {
    this.isMouseTrackingEnabled = true;
    // Pausing cleared the displayed values, so the current point is resampled
    // even when the cursor never left it.
    this.lastResolvedPosition = null;
    if (this.currentMousePosition && this.isActive) {
      this.scanIndicator.updatePosition(this.currentMousePosition);
      this.throttledFetchPointValues(); // Immediate fetch on recovery
    }
  }
      
  start() {
    if (this.isActive || !this.viewer) return;
    
    this.isActive = true;

    // Continous render for animation
    this.viewer.scene.requestRenderMode = false;
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.viewer) {
      this.viewer.scene.requestRenderMode = true;
    }

    this.scanIndicator.hide();
    this.hasPendingRequest = false;
    this.lastResolvedPosition = null;

    if (this.pendingFetch) {
      clearTimeout(this.pendingFetch);
      this.pendingFetch = null;
    }
  }

  private getCurrentPosition(): { lon: number; lat: number } | null {
    if (!this.viewer || !this.currentMousePosition || !this.isMouseTrackingEnabled) return null;

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

  // Set layer bounds for bounds checking
  async setLayerBounds(layerId: string, bounds: number[]): Promise<void> {
    try {
      // bounds format: [west, south, east, north] in degrees
      const rectangle = Cesium.Rectangle.fromDegrees(
        bounds[0], // west
        bounds[1], // south  
        bounds[2], // east
        bounds[3]  // north
      );
      this.layerBounds.set(layerId, rectangle);
    } catch (error) {
      console.warn(`Failed to set bounds for layer ${layerId}:`, error);
    }
  }

  // Check if a position is within the bounds of a specific layer
  private isPositionWithinLayerBounds(layerId: string, lon: number, lat: number): boolean {
    const bounds = this.layerBounds.get(layerId);
    if (!bounds) {
      // Allow the request fallback if not bound are set
      return true;
    }

    try {
      const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
      return Cesium.Rectangle.contains(bounds, cartographic);
    } catch (error) {
      console.warn(`Error checking bounds for layer ${layerId}:`, error);
      return true; // Falback to allow request on error
    }
  }

  private async fetchPointValues(): Promise<void> {
    if (!this.isMouseTrackingEnabled) {
      this.scanIndicator.hide();
      this.notifyValuesUpdate({}, true);
      return;
    }

    const position = this.getCurrentPosition();
    if (!position) {
      this.scanIndicator.hide();
      return;
    }

    if (this.selectedLayers.length === 0) {
      this.notifyValuesUpdate({}, true);
      return;
    }

    // Filter layers to only those within bounds
    const layersWithinBounds = this.selectedLayers.filter(layerId =>
      this.isPositionWithinLayerBounds(layerId, position.lon, position.lat)
    );

    if (layersWithinBounds.length === 0) {
      // No layer have data at this position
      this.lastResolvedPosition = position;
      this.notifyValuesUpdate({}, false);
      return;
    }

    if (
      this.lastResolvedPosition !== null &&
      this.lastResolvedPosition.lon === position.lon &&
      this.lastResolvedPosition.lat === position.lat
    ) {
      return;
    }

    const promises = this.selectedLayers.map(layerId =>
      this.fetchSinglePointValue(layerId, position.lon, position.lat)
    );

    try {
      const results = await Promise.allSettled(promises);

      // Discards results for requests that outlive tracking being disabled,
      // so a stale response can't overwrite the paused notification.
      if (!this.isMouseTrackingEnabled) return;

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

      const values: {[layerId: string]: number} = {};
      const unavailableLayerIds: string[] = [];

      pointValues.forEach(pv => {
        if (pv.error) {
          unavailableLayerIds.push(pv.layerId);
        } else if (pv.value !== null) {
          values[pv.layerId] = pv.value;
        }
      });

      // Only a batch where every layer answered marks the point as sampled.
      // Leaving it unmarked after a failure lets the next mouse event retry it.
      if (unavailableLayerIds.length === 0) {
        this.lastResolvedPosition = position;
      }

      this.notifyValuesUpdate(values, false, unavailableLayerIds);

    } catch(error) {
      console.error('Error fetching lunar point values:', error);
    }
  }

  private async fetchSinglePointValue(layerId: string, lon: number, lat: number): Promise<PointValue> {
    const layerConfig = layersConfig.layers[layerId];
    if (!layerConfig) {
      throw new Error(`Layer config not found for ${layerId}`);
    }

    const filename = this.activeFilenames.get(layerId) ?? layerConfig.filename;
    const url = getPointValueUrl(filename, lon, lat, {
      bidx: [1],
      coord_crs: 'IAU:30100'
    });

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.maxFetchAttempts; attempt++) {
      try {
        const response = await fetch(url);

        // The tiler answers 404 for a point outside the raster. That is a
        // successful answer of "no data here", not a failed request.
        if (response.status === 404) {
          return { layerId, filename, lon, lat, value: null };
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        const value = data.values && data.values.length > 0 ? data.values[0] : null;

        return {
          layerId,
          filename,
          lon,
          lat,
          value: typeof value === 'number' ? value : null
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.maxFetchAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    throw new Error(`Failed to fetch point value: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
  }

  updateActiveFilename(layerId: string, filename: string) {
    this.activeFilenames.set(layerId, filename);
  }

  clearActiveFilename(layerId: string) {
    this.activeFilenames.delete(layerId);
  }

  // Clean up
  destroy() {
    this.stop();
    this.callbacks = [];
    this.scanIndicator.destroy();
    this.layerBounds.clear();
    this.activeFilenames.clear();

    if (this.pendingFetch) {
      clearTimeout(this.pendingFetch);
      this.pendingFetch = null;
    }

    if (this.mouseMoveHandler) {
      this.mouseMoveHandler.destroy();
      this.mouseMoveHandler = null;
    }
  }
}

export const pointValueService = new PointValueService();