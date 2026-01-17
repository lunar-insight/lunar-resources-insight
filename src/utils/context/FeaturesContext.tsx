import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ConstantProperty } from 'cesium';
import { Feature } from '../../components/navigation/FeaturesSection/types';
import { useViewer } from './ViewerContext';

interface FeaturesContextType {
  features: Feature[];
  activeDrawingTool: string | null;
  addFeature: (feature: Feature) => void;
  removeFeature: (id: string) => void;
  renameFeature: (id: string, newName: string) => void;
  setActiveDrawingTool: (tool: string | null) => void;
  toggleFeatureInsights: (id: string) => void;
  toggleFeatureVisible: (id: string) => void;
  showFeatures: boolean;
  showLabels: boolean;
  toggleFeatureVisibility: () => void;
  toggleLabelVisibility: () => void;
}

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

let pointCounter = 1;

export const generateFeatureName = (type: string): string => {
  if (type === 'point') {
    return `Point ${pointCounter++}`;
  }
  if (type === 'line') {
    return `Line ${pointCounter++}`;
  }
  if (type === 'polygon') {
    return `Polygon ${pointCounter++}`;
  }
  if (type === 'circle') {
    return `Circle ${pointCounter++}`;
  }
  // Future: handle other types
  return `Feature ${pointCounter++}`;
};

export const FeaturesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
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

  const renameFeature = useCallback((id: string, newName: string) => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return;
    }

    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, name: trimmedName } : f
      )
    );
  }, []);

  const toggleFeatureInsights = useCallback((id: string) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, insightsOpen: !f.insightsOpen } : f
      )
    );
  }, []);

  const toggleFeatureVisible = useCallback((id: string) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, visible: !f.visible } : f
      )
    );
  }, []);

  const toggleFeatureVisibility = useCallback(() => {
    setShowFeatures(prev => !prev);
  }, []);

  const toggleLabelVisibility = useCallback(() => {
    setShowLabels(prev => !prev);
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

  // Synchronize visibility state with Cesium entities
  useEffect(() => {
    if (viewer && features.length > 0) {
      features.forEach(feature => {
        const entity = feature.entity;
        const shouldShowFeature = showFeatures && feature.visible;

        // Control shape visibility
        if (entity.point) {
          entity.point.show = new ConstantProperty(shouldShowFeature);
        }
        if (entity.polyline) {
          entity.polyline.show = new ConstantProperty(shouldShowFeature);
        }
        if (entity.polygon) {
          entity.polygon.show = new ConstantProperty(shouldShowFeature);
        }
        if (entity.ellipse) {
          entity.ellipse.show = new ConstantProperty(shouldShowFeature);
        }

        // Control label visibility (depends on features being visible)
        if (entity.label) {
          entity.label.show = new ConstantProperty(shouldShowFeature && showLabels);
          entity.label.text = new ConstantProperty(feature.name);
        }
      });
    }
  }, [viewer, features, showFeatures, showLabels]);

  const value: FeaturesContextType = {
    features,
    activeDrawingTool,
    addFeature,
    removeFeature,
    renameFeature,
    setActiveDrawingTool,
    toggleFeatureInsights,
    toggleFeatureVisible,
    showFeatures,
    showLabels,
    toggleFeatureVisibility,
    toggleLabelVisibility,
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
