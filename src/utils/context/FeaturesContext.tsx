import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Feature } from '../../types/features';
import { useViewer } from './ViewerContext';

interface FeaturesContextType {
  features: Feature[];
  activeDrawingTool: string | null;
  addFeature: (feature: Feature) => void;
  removeFeature: (id: string) => void;
  setActiveDrawingTool: (tool: string | null) => void;
  toggleFeatureInsights: (id: string) => void;
}

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

let pointCounter = 1;

export const generateFeatureName = (type: string): string => {
  if (type === 'point') {
    return `Point ${pointCounter++}`;
  }
  // Future: handle other types
  return `Feature ${pointCounter++}`;
};

export const FeaturesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const { viewer } = useViewer();

  const addFeature = useCallback((feature: Feature) => {
    setFeatures(prev => [...prev, feature]);
  }, []);

  const removeFeature = useCallback((id: string) => {
    setFeatures(prev => {
      const feature = prev.find(f => f.id === id);
      if (feature && viewer) {
        viewer.entities.remove(feature.entity);
      }
      return prev.filter(f => f.id !== id);
    });
  }, [viewer]);

  const toggleFeatureInsights = useCallback((id: string) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, insightsOpen: !f.insightsOpen } : f
      )
    );
  }, []);

  // Cleanup all entities on unmount
  useEffect(() => {
    return () => {
      if (viewer) {
        features.forEach(feature => {
          viewer.entities.remove(feature.entity);
        });
      }
    };
  }, []);

  const value: FeaturesContextType = {
    features,
    activeDrawingTool,
    addFeature,
    removeFeature,
    setActiveDrawingTool,
    toggleFeatureInsights,
  };

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeaturesContext = (): FeaturesContextType => {
  const context = useContext(FeaturesContext);
  if (!context) {
    throw new Error('useFeaturesContext must be used within a FeaturesProvider');
  }
  return context;
};
