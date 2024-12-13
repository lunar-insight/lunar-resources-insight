import React, { createContext, useContext } from 'react';
import { StyleConfig } from 'types/style.types';
import { mapServerWmsUrl } from '../../geoConfigExporter';

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
  const updateLayerStyle = async (layerId: string, styleConfig: StyleConfig) => {

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

      const params = {
        service: 'WMS',
        version: '1.3.0',
        request: 'GetMap',
        format: 'image/png',
        transparent: 'true',
        layers: layerId,
        env: envParams,
        styles: `chemical_element_${type}`,
        width: '256',
        height: '256',
        srs: 'IAU:30100',
        bbox: '-180, -90, 180, 90',
      };

      const response = await fetch(`${mapServerWmsUrl}?${new URLSearchParams(params)}`);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
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