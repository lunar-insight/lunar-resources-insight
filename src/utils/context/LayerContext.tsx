import React, { createContext, useContext, useState } from 'react';

interface LayerContextType {
  selectedLayers: string[];
  addLayer: (layer: string) => void;
  removeLayer: (layer: string) => void;
}

const LayerContext = createContext<LayerContextType | undefined>(undefined);

export const LayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);

  const addLayer = (layer: string) => {
    setSelectedLayers(prev => [...prev, layer]);
  };

  const removeLayer = (layer: string) => {
    setSelectedLayers(prev => prev.filter(l => l !== layer));
  };

  return (
    <LayerContext.Provider value={{ selectedLayers, addLayer, removeLayer }}>
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