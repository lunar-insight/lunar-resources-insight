import React, { createContext, useContext, useState, useRef } from 'react';
import { StyleConfig } from 'types/style.types';
import { useViewer } from './ViewerContext';
import * as Cesium from 'cesium';
import { mapServerWmsUrl } from '../../geoConfigExporter';

interface LayerContextType {
  selectedLayers: string[];
  visibleLayers: Set<string>;
  addLayer: (layer: string) => void;
  removeLayer: (layer: string) => void;
  reorderLayers: (layers: string[]) => void;
  toggleLayerVisibility: (layer: string) => void;
  updateStyle: (layer: string, styleConfig: StyleConfig) => Promise<void>;
}

const LayerContext = createContext<LayerContextType | undefined>(undefined);

class CesiumLayerManager {

  private layerMap: Map<string, Cesium.ImageryLayer>;

  constructor(private viewer: Cesium.Viewer | null) {
    this.layerMap = new Map();
  }

  addLayer(layerId: string) {
    if (!this.viewer) return;

    if (this.layerMap.has(layerId)) {
      const existingLayer = this.layerMap.get(layerId)!;
      if (!this.viewer.imageryLayers.contains(existingLayer)) {
        this.viewer.imageryLayers.add(existingLayer);
      }
      return;
    }

    const imageryProvider = new Cesium.WebMapServiceImageryProvider({
      url: mapServerWmsUrl,
      layers: layerId,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        format: 'image/png',
        transparent: true,
        styles: '',
        srs: 'IAU:30100'
      },
      tileWidth: 256,
      tileHeight: 256,
    });

    const layer = new Cesium.ImageryLayer(imageryProvider);
    this.viewer.imageryLayers.add(layer);
    this.layerMap.set(layerId, layer);
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
    layerIds.forEach(layerId => {
      const layer = this.layerMap.get(layerId);
      if (layer) {
        imageryLayers.add(layer);
      }
    })
  }
  
  updateLayerStyle(layerId: string, styleConfig: StyleConfig) {
    if (!this.viewer) return;

    if (styleConfig.colors.length !== 9 && styleConfig.colors.length !== 11) {
      throw new Error(`Invalid number of colors: ${styleConfig.colors.length}`);
    }

    const existingLayer = this.layerMap.get(layerId);
    if (existingLayer) {
      const index = this.viewer.imageryLayers.indexOf(existingLayer);
      const show = existingLayer.show;

      const newProvider = new Cesium.WebMapServiceImageryProvider({
        url: mapServerWmsUrl,
        layers: layerId,
        parameters: {
          service: 'WMS',
          version: '1.1.1',
          request: 'GetMap',
          format: 'image/png',
          transparent: true,
          styles: `chemical_element_${styleConfig.type}`,
          env: this.generateEnvParams(styleConfig),
          srs: 'IAU:30100'
        },
        tileWidth: 256,
        tileHeight: 256
      });

      const newLayer = new Cesium.ImageryLayer(newProvider);
      newLayer.show = show;

      this.viewer.imageryLayers.remove(existingLayer, true);
      this.viewer.imageryLayers.add(newLayer, index);
      this.layerMap.set(layerId, newLayer);
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
}

export const LayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  // const styleContext = useStyle();
  const { viewer } = useViewer();
  const cesiumManagerRef = useRef<CesiumLayerManager | null>(null);

  // When viewer change, init or update manager
  if (viewer && !cesiumManagerRef.current) {
    cesiumManagerRef.current = new CesiumLayerManager(viewer);
  }

  const addLayer = (layer: string) => {
    setSelectedLayers(prev => [...prev, layer]);
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


  const updateStyle = async (layer: string, styleConfig: StyleConfig) => {
    try {
      cesiumManagerRef.current?.updateLayerStyle(layer, styleConfig);
    } catch (error) {
      console.error(`Error updating style for layer ${layer}:`, error);
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
        updateStyle
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