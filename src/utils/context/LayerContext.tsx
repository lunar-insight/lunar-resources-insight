import React, { createContext, useContext, useState, useRef } from 'react';
import { StyleConfig } from 'types/style.types';
import { useViewer } from './ViewerContext';
import * as Cesium from 'cesium';
import { layersConfig, buildCogTileUrl, fetchCogInfo, fetchCogStatistics } from '../../geoConfigExporter';

interface LayerContextType {
  selectedLayers: string[];
  visibleLayers: Set<string>;
  addLayer: (layer: string) => void;
  removeLayer: (layer: string) => void;
  reorderLayers: (layers: string[]) => void;
  toggleLayerVisibility: (layer: string) => void;
  updateStyle: (layer: string, styleConfig: StyleConfig) => Promise<void>;
  updateRampValues: (layer: string, min: number, max: number) => Promise<void>;
  updateLayerOpacity: (layer: string, opacity: number) => void;
  updateLayerRangeFilter: (layer: string, enabled: boolean) => void;
}

const LayerContext = createContext<LayerContextType | undefined>(undefined);

class CesiumLayerManager {

  private layerMap: Map<string, Cesium.ImageryLayer>;
  private layerStyleConfig: Map<string, StyleConfig>;
  private layerStats: Map<string, { min: number; max: number }>;
  private tileCache = new Map<string, string>();
  private rangeFilterEnabled: Map<string, boolean>;

  constructor(private viewer: Cesium.Viewer | null) {
    this.layerMap = new Map();
    this.layerStyleConfig = new Map();
    this.layerStats = new Map();
    this.rangeFilterEnabled = new Map();
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

      const { min, max } = await fetchCogStatistics(layerConfig.filename);

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
        options.expression = `where((b1 >= ${styleConfig.min}) & (b1 <= ${styleConfig.max}), b1, 0)`;
        options.nodata = 0;
        options.return_mask = true;
      }

      const newProvider = new Cesium.UrlTemplateImageryProvider({
        url: buildCogTileUrl(layerConfig.filename, options),
        tilingScheme: new Cesium.GeographicTilingScheme(),
        minimumLevel: 0,
        maximumLevel: 20,
        rectangle: bounds,
        hasAlphaChannel: rangeFilterEnabled
      });

      const layerOptions: any = {
        show: show,
        alpha: opacity
      };

      if (rangeFilterEnabled) {
        layerOptions.colorToAlpha = new Cesium.Color(0, 0, 0, 1);
        layerOptions.colorToAlphaThreshold = 0.0001;
      }

      const newLayer = new Cesium.ImageryLayer(newProvider, layerOptions);

      this.viewer.imageryLayers.remove(existingLayer, true);
      this.viewer.imageryLayers.add(newLayer, index);
      this.layerMap.set(layerId, newLayer);
      this.layerStyleConfig.set(layerId, styleConfig);
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

  // TODO need to see if necessary
  private getCachedTileUrl(layerId: string, style: StyleConfig): string {
    const cacheKey = `${layerId}-${JSON.stringify(style)}`;

    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    const layerConfig = layersConfig.layers[layerId];
    const url = buildCogTileUrl(layerConfig.filename, {
      colormap: style.type === 'gray' ? undefined : style.type,
      rescale: [style.min, style.max]
    });

    this.tileCache.set(cacheKey, url);
    return url;
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
}


export const LayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const { viewer } = useViewer();
  const cesiumManagerRef = useRef<CesiumLayerManager | null>(null);

  // When viewer change, init or update manager
  if (viewer && !cesiumManagerRef.current) {
    cesiumManagerRef.current = new CesiumLayerManager(viewer);
  }


  const addLayer = (layer: string) => {
    setSelectedLayers(prev => [layer, ...prev]);
    setVisibleLayers(prev => new Set(prev).add(layer));
    cesiumManagerRef.current?.addLayer(layer);
  };


  const removeLayer = (layer: string) => {
    setSelectedLayers(prev => prev.filter(l => l !== layer));
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(layer);
      return newSet;
    });
    cesiumManagerRef.current?.removeLayer(layer);
  };


  const toggleLayerVisibility = (layer: string) => {
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
  };


  const reorderLayers = (layers: string[]) => {
    setSelectedLayers(layers);
    cesiumManagerRef.current?.reorderLayers(layers);
  }


  const updateRampValues = async (layer: string, min: number, max: number) => {
    try {
      cesiumManagerRef.current?.updateRampValues(layer, min, max);
    } catch (error) {
      console.error(`Error updating ramp values for layer ${layer}:`, error);
    }
  };


  const updateStyle = async (layer: string, styleConfig: StyleConfig) => {
    try {
      cesiumManagerRef.current?.updateLayerStyle(layer, styleConfig);
    } catch (error) {
      console.error(`Error updating style for layer ${layer}:`, error);
    }
  };


  const updateLayerOpacity = (layer: string, opacity: number) => {
    try {
      cesiumManagerRef.current?.updateLayerOpacity(layer, opacity);
    } catch (error) {
      console.error(`Error updating opacity for layer ${layer}:`, error);
    }
  }


  const updateLayerRangeFilter = (layer: string, enabled: boolean) => {
    try {
      cesiumManagerRef.current?.updateLayerRangeFilter(layer, enabled);
    } catch (error) {
      console.error(`Error updating range filter for layer ${layer}:`, error)
    }
  };


  return (
    <LayerContext.Provider 
      value={{ 
        selectedLayers, 
        visibleLayers, 
        addLayer, 
        removeLayer, 
        reorderLayers, 
        toggleLayerVisibility,
        updateStyle,
        updateRampValues,
        updateLayerOpacity,
        updateLayerRangeFilter
      }}
    >
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