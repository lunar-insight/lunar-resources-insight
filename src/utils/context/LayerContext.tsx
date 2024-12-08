import React, { createContext, useContext, useState } from 'react';

interface LayerContextType {
  selectedLayers: string[];
  visibleLayers: Set<string>;
  addLayer: (layer: string) => void;
  removeLayer: (layer: string) => void;
  reorderLayers: (layers: string[]) => void;
  toggleLayerVisibility: (layer: string) => void;
}

const LayerContext = createContext<LayerContextType | undefined>(undefined);

export const LayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());

  const addLayer = (layer: string) => {
    setSelectedLayers(prev => [...prev, layer]);
    setVisibleLayers(prev => new Set(prev).add(layer));
  };

  const removeLayer = (layer: string) => {
    setSelectedLayers(prev => prev.filter(l => l !== layer));
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(layer);
      return newSet;
    });
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
  };

  const reorderLayers = (layers: string[]) => {
    setSelectedLayers(layers);
  }

  return (
    <LayerContext.Provider value={{ selectedLayers, visibleLayers, addLayer, removeLayer, reorderLayers, toggleLayerVisibility }}>
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