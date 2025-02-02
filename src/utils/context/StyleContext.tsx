import React, { createContext, useContext } from 'react';
import { StyleConfig } from 'types/style.types';
import { mapServerWmsUrl } from '../../geoConfigExporter';
import * as Cesium from 'cesium';
import { useViewer } from './ViewerContext';

interface StyleError {
  message: string;
  code?: string;
}

interface StyleContextType {
  updateLayerStyle: (layerId: string, styleConfig: StyleConfig) => Promise<void>;
  error?: StyleError;
}

const StyleContext = createContext<StyleContextType | undefined>(undefined);


export const StyleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { viewer } = useViewer();

  const updateLayerStyle = async (layerId: string, styleConfig: StyleConfig) => {

    if (!viewer) return;

    try {

      const { colors, min = 0, max = 100, type } = styleConfig;

      if (colors.length !== 9 && colors.length !== 11) {
        throw new Error(`Invalid number of colors: ${colors.length}`);
      }

      // SLD ENV parameter generation
      const envParams = colors
        .map((color, index) => {
          const quantity = min + ((max - min) / (colors.length - 1)) * index;
          return `color${index + 1}:${color};quantity${index + 1}:${quantity}`;
        })
        .join(';');

      // New provider creation
      const newProvider = new Cesium.WebMapServiceImageryProvider({
        url: mapServerWmsUrl,
        layers: layerId,
        parameters: {
          service: 'WMS',
          version: '1.1.1',
          request: 'GetMap',
          format: 'image/png',
          transparent: true,
          styles: `chemical_element_${type}`,
          env: envParams,
          srs: 'IAU:30100'
        },
        tileWidth: 256,
        tileHeight: 256
      });

      // Search and update layer
      const imageryLayers = viewer.imageryLayers;
      let index = -1;

      for (let i = 0; i < imageryLayers.length; i++) {
        const layer = imageryLayers.get(i);
        if (layer && layer.imageryProvider) {
          const provider = layer.imageryProvider;
          if (provider instanceof Cesium.WebMapServiceImageryProvider &&
              provider.layers === layerId) {
            index = i;
            imageryLayers.remove(layer);
            break;
          }
        }
      }

      // Add new layer
      const newLayer = new Cesium.ImageryLayer(newProvider);
      if (index >= 0) {
        imageryLayers.add(newLayer, index);
      } else {
        imageryLayers.add(newLayer);
      }

    } catch (error) {
      console.error('Style update error:', error);
      throw error;
    }
  };

  return (
    <StyleContext.Provider value={{ updateLayerStyle }}>
      {children}
    </StyleContext.Provider>
  );
};

export const useStyle = () => {
  const context = useContext(StyleContext);
  if (!context) {
    throw new Error('useStyle needs to be used in a StyleProvider');
  }
  return context;
}