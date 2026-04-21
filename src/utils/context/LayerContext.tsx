import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { useViewer } from './ViewerContext';
import * as Cesium from 'cesium';
import { layersConfig, buildCogTileUrl, fetchCogInfo, fetchCogStatistics } from '../../geoConfigExporter';
import { colormapService } from '../../services/ColormapService';
import { layerStatsService } from '../../services/LayerStatsService';
import { pointValueService } from 'services/PointValueService';
import { useMouseTracking } from 'utils/MouseTrackingProvider';

interface StyleConfig {
  type: string;
  colors: string[];
  min?: number;
  max?: number;
}

interface DynamicLayerMetadata {
  displayName: string;
  category: string;
  element?: string;
}

interface LayerContextType {
  selectedLayers: string[];
  visibleLayers: Set<string>;
  dynamicLayerMetadata: Map<string, DynamicLayerMetadata>;
  addLayer: (layer: string, metadata?: DynamicLayerMetadata) => void;
  removeLayer: (layer: string) => void;
  reorderLayers: (layers: string[]) => void;
  toggleLayerVisibility: (layer: string) => void;
  updateStyle: (layer: string, styleConfig: StyleConfig) => Promise<void>;
  updateRampValues: (layer: string, min: number, max: number) => Promise<void>;
  updateLayerOpacity: (layer: string, opacity: number) => void;
  updateLayerRangeFilter: (layer: string, enabled: boolean) => void;
  getLayerStyle: (layer: string) => StyleConfig | undefined;
  activeVariants: Map<string, number>;
  swappingLayers: Set<string>;
  swapLayerVariant: (layerId: string, variantIndex: number) => Promise<void>;
  statsVersion: number;
}

const LayerContext = createContext<LayerContextType | undefined>(undefined);

class CesiumLayerManager {

  private layerMap: Map<string, Cesium.ImageryLayer>;
  private layerStyleConfig: Map<string, StyleConfig>;
  private layerStats: Map<string, { min: number; max: number }>;
  private tileCache = new Map<string, string>();
  private rangeFilterEnabled: Map<string, boolean>;
  private hasDisableRequests: (() => boolean) | null = null;
  private activeFilenames: Map<string, string>

  constructor(
    private viewer: Cesium.Viewer | null,
    hasDisableRequestsFn?: () => boolean
  ) {
    this.layerMap = new Map();
    this.layerStyleConfig = new Map();
    this.layerStats = new Map();
    this.rangeFilterEnabled = new Map();
    this.hasDisableRequests = hasDisableRequestsFn || null;
    this.activeFilenames = new Map();
  }

  async addLayer(layerId: string) {
    if (!this.viewer) return;

    if (this.layerMap.has(layerId)) {
      const existingLayer = this.layerMap.get(layerId)!;
      if (!this.viewer.imageryLayers.contains(existingLayer)) {
        this.viewer.imageryLayers.add(existingLayer);
      }
      return;
    }

    const layerConfig = layersConfig.layers[layerId];
    if (!layerConfig) {
      console.error(`Layer configuration not found for ${layerId}`);
      return;
    }

    try {
      const { bounds } = await fetchCogInfo(layerConfig.filename);

      // Bounds checking
      await pointValueService.setLayerBounds(layerId, bounds);

      const stats = layerStatsService.getLayerStats(layerId);
      const min = stats.loaded ? stats.min : 0;
      const max = stats.loaded ? stats.max : 100;

      const rectangle = Cesium.Rectangle.fromDegrees(
        bounds[0], // West
        bounds[1], // South
        bounds[2], // East
        bounds[3]  // North
      )

      this.layerStats.set(layerId, { min, max });

      const imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: buildCogTileUrl(layerConfig.filename, {
          rescale: [min, max]
        }),
        tilingScheme: new Cesium.GeographicTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 20,
        rectangle: rectangle,
        credit: `${layerConfig.displayName || layerId}`
      });

      const layer = new Cesium.ImageryLayer(imageryProvider, {
        alpha: 1.0
      });
      this.viewer.imageryLayers.add(layer);
      this.layerMap.set(layerId, layer);
      this.activeFilenames.set(layerId, layerConfig.filename);

      this.forceResumeMouseTracking();
    } catch (error) {
      console.error(`Failed to add layer ${layerId}:`, error);
    }
  }


  removeLayer(layerId: string) {
    if (!this.viewer) return;

    const layer = this.layerMap.get(layerId);
    
    if (layer) {
      this.viewer.imageryLayers.remove(layer, true) // True to delete layer
      this.layerMap.delete(layerId); // Remove ref
      this.activeFilenames.delete(layerId);
    }
  }


  async swapVariant(layerId: string, newFilename: string) {
    if (!this.viewer) return;

    const existingLayer = this.layerMap.get(layerId);
    if (!existingLayer) throw new Error(`Layer ${layerId} is not active in Cesium`);

    const layerConfig = layersConfig.layers[layerId];
    const layerIndex = this.viewer.imageryLayers.indexOf(existingLayer);
    const currentAlpha = existingLayer.alpha;
    const currentShow = existingLayer.show;
    const currentStyle = this.layerStyleConfig.get(layerId);
    const rangeFilterEnabled = this.rangeFilterEnabled.get(layerId) || false;

    this.viewer.imageryLayers.remove(existingLayer, false);

    try {
      const { bounds } = await fetchCogInfo(newFilename);
      await pointValueService.setLayerBounds(layerId, bounds);

      // Prefer the style's explicit min/max; fall back to cached stats then safe default
      const cachedStats = this.layerStats.get(layerId);
      const min = currentStyle?.min ?? cachedStats?.min ?? 0;
      const max = currentStyle?.max ?? cachedStats?.max ?? 100;

      const rectangle = Cesium.Rectangle.fromDegrees(
        bounds[0], bounds[1], bounds[2], bounds[3]
      );

      // Build full style option in one pass
      // (versus plain layer creation with updateLayerStyle)
      const options: any = {
        colormap: currentStyle?.type === 'gray' ? undefined : currentStyle?.type,
        rescale: [min, max],
      };

      if (rangeFilterEnabled) {
        const nodataValue = -9999;
        options.expression = `where((b1 >= ${min}) & (b1 <= ${max}), b1, ${nodataValue})`;
        options.nodata = nodataValue;
        options.return_mask = true;
        options.format = 'png';
      }

      const imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: buildCogTileUrl(newFilename, options),
        tilingScheme: new Cesium.GeographicTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 20,
        rectangle,
        hasAlphaChannel: rangeFilterEnabled,
        credit: layerConfig?.displayName ?? layerId,
      });

      const layerOptions: any = {
        show: currentShow,
        alpha: currentAlpha,
      };

      if (rangeFilterEnabled) {
        layerOptions.colorToAlpha = colormapService.getColormapFirstColor(currentStyle?.type ?? 'gray');
        layerOptions.colorToAlphaThreshold = 0.0001;
      }

      const newLayer = new Cesium.ImageryLayer(imageryProvider, layerOptions);

      this.viewer.imageryLayers.add(newLayer, layerIndex >= 0 ? layerIndex : undefined);
      this.layerMap.set(layerId, newLayer);
      this.activeFilenames.set(layerId, newFilename);
      // Keep internal layerStats in sync so updateRampValues uses correct defaults
      this.layerStats.set(layerId, { min, max });
      // Sync layerStyleConfig min/max so future updateLayerStyle calls use the new variant's range.
      // Preserves the user's chosen colormap; only the ramp bounds are updated.
      if (currentStyle) {
        this.layerStyleConfig.set(layerId, { ...currentStyle, min, max });
      }
      // Destroy the old layer now that the swap succeeded, remove(false) above preserved it
      // for the error-recovery path; without this explicit destroy the layer object leaks.
      existingLayer.destroy();

      this.forceResumeMouseTracking();
    } catch (error) {
      // Restore the original layer so the map doesn't go blank
      this.viewer.imageryLayers.add(existingLayer, layerIndex >= 0 ? layerIndex : undefined);
      this.layerMap.set(layerId, existingLayer);
      console.error(`Failed to swap variant for ${layerId}:`, error);
      throw error;
    }
  }


  toggleVisibility(layerId: string) {
    const layer = this.layerMap.get(layerId);
    if (layer) {
      layer.show = !layer.show;
    }
  }


  reorderLayers(layerIds: string[]) {
    if (!this.viewer) return;

    const imageryLayers = this.viewer.imageryLayers;

    Array.from(this.layerMap.values()).forEach(layer => {
      if (imageryLayers.contains(layer)) {
        imageryLayers.remove(layer, false) // False equal not remove layer
      }
    });

    // Reorder
    [...layerIds].reverse().forEach(layerId => {
      const layer = this.layerMap.get(layerId);
      if (layer) {
        imageryLayers.add(layer);
      }
    })
  }


  updateRampValues(layerId: string, min: number, max: number) {
    const currentStats = this.layerStats.get(layerId);
    const currentStyle = this.layerStyleConfig.get(layerId) || {
      type: 'gray',
      colors: [],
      min: currentStats?.min || 0,
      max: currentStats?.max || 100
    };
    
    const updatedStyle = {
      ...currentStyle,
      min,
      max
    };

    this.layerStyleConfig.set(layerId, updatedStyle);
    this.updateLayerStyle(layerId, updatedStyle);
    
  }

  updateLayerStyle(layerId: string, styleConfig: StyleConfig) {
    if (!this.viewer) return;
    
    const layerConfig = layersConfig.layers[layerId];
    if (!layerConfig) return;
    
    const existingLayer = this.layerMap.get(layerId);
    if (existingLayer) {
      const index = this.viewer.imageryLayers.indexOf(existingLayer);
      const show = existingLayer.show;
      const opacity = existingLayer.alpha;
      const bounds = existingLayer.imageryProvider.rectangle;

      const rangeFilterEnabled = this.rangeFilterEnabled.get(layerId) || false;

      const options: any = {
        colormap: styleConfig.type === 'gray' ? undefined : styleConfig.type,
        rescale: [styleConfig.min, styleConfig.max]
      };

      if (rangeFilterEnabled) {
        const nodataValue = -9999;

        options.expression = `where((b1 >= ${styleConfig.min}) & (b1 <= ${styleConfig.max}), b1, ${nodataValue})`;
        options.nodata = nodataValue;
        options.return_mask = true;
        options.format = 'png';
      }

      const newProvider = new Cesium.UrlTemplateImageryProvider({
        url: buildCogTileUrl(this.activeFilenames.get(layerId) ?? layerConfig.filename, options),
        tilingScheme: new Cesium.GeographicTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 20,
        rectangle: bounds,
        hasAlphaChannel: rangeFilterEnabled,
        credit: `${layerConfig.displayName || layerId}`
      });

      const layerOptions: any = {
        show: show,
        alpha: opacity
      };

      if (rangeFilterEnabled) {
        const colorToMakeTransparent = colormapService.getColormapFirstColor(styleConfig.type);

        layerOptions.colorToAlpha = colorToMakeTransparent;
        layerOptions.colorToAlphaThreshold = 0.0001; // or 0.05
      }

      const newLayer = new Cesium.ImageryLayer(newProvider, layerOptions);

      this.viewer.imageryLayers.remove(existingLayer, true);
      this.viewer.imageryLayers.add(newLayer, index);
      this.layerMap.set(layerId, newLayer);
      this.layerStyleConfig.set(layerId, styleConfig);

      this.forceResumeMouseTracking();
    }
  }


  private generateEnvParams(styleConfig: StyleConfig): string {
    const { colors, min = 0, max = 100 } = styleConfig;
    
    return colors
      .map((color, index) => {
        const quantity = min + ((max - min) / (colors.length - 1)) * index;
        return `color${index + 1}:${color};quantity${index + 1}:${quantity}`;
    })
    .join(';');
  }


  updateLayerOpacity(layerId: string, opacity: number) {
    if (!this.viewer) return;

    const layer = this.layerMap.get(layerId);
    if (layer) {
      layer.alpha = opacity;
    }
  }

  
  updateLayerRangeFilter(layerId: string, enabled: boolean) {
    this.rangeFilterEnabled.set(layerId, enabled)

    const currentStyle = this.layerStyleConfig.get(layerId);
    if (currentStyle) {
      this.updateLayerStyle(layerId, currentStyle);
    }
  }

  getLayerStyleConfig(layerId: string): StyleConfig | undefined {
    return this.layerStyleConfig.get(layerId);
  }

  private forceResumeMouseTracking() {
    // Delay in ms to wait Cesium finish operations
    setTimeout(() => {
      if (!this.hasDisableRequests || !this.hasDisableRequests()) {
        pointValueService.enableMouseTracking();
      }
    }, 150);
  }
}


export const LayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const [dynamicLayerMetadata, setDynamicLayerMetadata] = useState<Map<string, DynamicLayerMetadata>>(new Map());
  const [activeVariants, setActiveVariants] = useState<Map<string, number>>(new Map());
  const [swappingLayers, setSwappingLayers] = useState<Set<string>>(new Set());
  const [statsVersion, setStatsVersion] = useState(0);
  const { viewer } = useViewer();
  const { hasDisableRequests } = useMouseTracking();
  const cesiumManagerRef = useRef<CesiumLayerManager | null>(null);

  // When viewer change, init or update manager
  if (viewer && !cesiumManagerRef.current) {
    cesiumManagerRef.current = new CesiumLayerManager(viewer, hasDisableRequests);
  }


  const addLayer = useCallback((layer: string, metadata?: DynamicLayerMetadata) => {
    // Store dynamic metadata if provided
    if (metadata) {
      setDynamicLayerMetadata(prev => new Map(prev).set(layer, metadata));
    }

    setSelectedLayers(prev => [layer, ...prev]);
    setVisibleLayers(prev => new Set(prev).add(layer));

    // Only add to Cesium if layer has config with filename
    const layerConfig = layersConfig.layers[layer];
    if (layerConfig?.filename) {
      cesiumManagerRef.current?.addLayer(layer);
    } else {
      console.log(`Layer ${layer} has no COG file. Added to management list only.`);
    }
  }, []);


  const removeLayer = useCallback((layer: string) => {
    // Clean up dynamic metadata
    setDynamicLayerMetadata(prev => {
      const newMap = new Map(prev);
      newMap.delete(layer);
      return newMap;
    });

    setSelectedLayers(prev => prev.filter(l => l !== layer));
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(layer);
      return newSet;
    });
    // Prevents stale pill highlight if the layer is re-added later
    setActiveVariants(prev => {
      const next = new Map(prev);
      next.delete(layer);
      return next;
    });
    // Clears any in-progress swap indicator for this layer
    setSwappingLayers(prev => {
      const next = new Set(prev);
      next.delete(layer);
      return next;
    });
    cesiumManagerRef.current?.removeLayer(layer);
  }, []);


  const toggleLayerVisibility = useCallback((layer: string) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer)) {
        newSet.delete(layer);
      } else {
        newSet.add(layer);
      }
      return newSet
    });
    cesiumManagerRef.current?.toggleVisibility(layer);
  }, []);


  const reorderLayers = useCallback((layers: string[]) => {
    setSelectedLayers(layers);
    cesiumManagerRef.current?.reorderLayers(layers);
  }, []);


  const updateRampValues = useCallback(async (layer: string, min: number, max: number) => {
    try {
      cesiumManagerRef.current?.updateRampValues(layer, min, max);
    } catch (error) {
      console.error(`Error updating ramp values for layer ${layer}:`, error);
    }
  }, []);


  const updateStyle = useCallback(async (layer: string, styleConfig: StyleConfig) => {
    try {
      cesiumManagerRef.current?.updateLayerStyle(layer, styleConfig);
    } catch (error) {
      console.error(`Error updating style for layer ${layer}:`, error);
    }
  }, []);


  const updateLayerOpacity = useCallback((layer: string, opacity: number) => {
    try {
      cesiumManagerRef.current?.updateLayerOpacity(layer, opacity);
    } catch (error) {
      console.error(`Error updating opacity for layer ${layer}:`, error);
    }
  }, []);


  const updateLayerRangeFilter = useCallback((layer: string, enabled: boolean) => {
    try {
      cesiumManagerRef.current?.updateLayerRangeFilter(layer, enabled);
    } catch (error) {
      console.error(`Error updating range filter for layer ${layer}:`, error)
    }
  }, []);

  const getLayerStyle = useCallback((layer: string) => {
    return cesiumManagerRef.current?.getLayerStyleConfig(layer);
  }, []);

  const swappingRef = useRef<Set<string>>(new Set());

  const swapLayerVariant = useCallback(async (layerId: string, variantIndex: number) => {
    // Guard against concurrent swaps for the same layer (e.g. rapid pill clicks)
    if (swappingRef.current.has(layerId)) return;

    // Guard: manager must be initialised before we can attempt the swap
    if (!cesiumManagerRef.current) return;

    const config = layersConfig.layers[layerId];
    const variant = config?.variants?.[variantIndex];
    if (!variant) return;

    swappingRef.current.add(layerId);
    setSwappingLayers(prev => new Set(prev).add(layerId));

    try {
      await cesiumManagerRef.current.swapVariant(layerId, variant.filename);
    } catch (error) {
      console.error(`Variant swap failed for ${layerId}:`, error);
      swappingRef.current.delete(layerId);
      setSwappingLayers(prev => {
        const next = new Set(prev);
        next.delete(layerId);
        return next;
      });
      return; // Swap was rolled back leaving activeVariants unchanged
    }

    swappingRef.current.delete(layerId);
    setSwappingLayers(prev => {
      const next = new Set(prev);
      next.delete(layerId);
      return next;
    });

    setActiveVariants(prev => {
      const next = new Map(prev);
      next.set(layerId, variantIndex);
      return next;
    });

    // Re-fetch stats for the new variant file. The old stats remain visible
    // until the new ones arrive, avoiding a "not loaded" flash.
    layerStatsService.refreshStats(layerId, variant.filename)
      .then(() => setStatsVersion(v => v + 1))
      .catch(console.error);
  }, []);

  const contextValue = useMemo(() => ({
    selectedLayers,
    visibleLayers,
    dynamicLayerMetadata,
    addLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    updateStyle,
    updateRampValues,
    updateLayerOpacity,
    updateLayerRangeFilter,
    getLayerStyle,
    activeVariants,
    swappingLayers,
    swapLayerVariant,
    statsVersion,
  }), [
    selectedLayers,
    visibleLayers,
    dynamicLayerMetadata,
    addLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    updateStyle,
    updateRampValues,
    updateLayerOpacity,
    updateLayerRangeFilter,
    getLayerStyle,
    activeVariants,
    swappingLayers,
    swapLayerVariant,
    statsVersion,
  ]);

  return (
    <LayerContext.Provider value={contextValue}>
      {children}
    </LayerContext.Provider>
  );
};

export const useLayerContext = () => {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error('useLayerContext must be used within a LayerProvider');
  }
  return context;
};