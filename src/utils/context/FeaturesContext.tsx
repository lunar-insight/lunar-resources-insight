import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as Cesium from 'cesium';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { useViewer } from './ViewerContext';

interface FeaturesContextType {
  features: Feature[];
  activeDrawingTool: string | null;
  addFeature: (feature: Feature) => void;
  removeFeature: (id: string) => void;
  renameFeature: (id: string, newName: string) => void;
  updateFeaturePosition: (id: string, newPosition: Cesium.ConstantProperty | Cesium.Cartographic) => void;
  updateLinePositions: (id: string, newPositions: Cesium.Cartographic[]) => void;
  updatePolygonPositions: (id: string, newPositions: Cesium.Cartographic[]) => void;
  updateCircleCenter: (id: string, newCenter: Cesium.Cartographic) => void;
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

export const generateFeatureName = (
  type: 'point' | 'line' | 'polygon' | 'circle' | 'two-point-circle' | 'three-point-circle'
): string => {
  switch (type) {
    case 'point':
      return `Point ${pointCounter++}`;
    case 'line':
      return `Line ${pointCounter++}`;
    case 'polygon':
      return `Polygon ${pointCounter++}`;
    case 'circle':
    case 'two-point-circle':
    case 'three-point-circle':
      return `Circle ${pointCounter++}`;
    default:
      // Exhaustive check: if we reach here, TypeScript will error if a new type is added
      const _exhaustiveCheck: never = type;
      return _exhaustiveCheck;
  }
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

  const updateFeaturePosition = useCallback((id: string, newPosition: Cesium.Cartographic) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, metadata: { ...f.metadata, position: newPosition } } : f
      )
    );
  }, []);

  const updateLinePositions = useCallback((id: string, newPositions: Cesium.Cartographic[]) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, metadata: { ...f.metadata, positions: newPositions } } : f
      )
    );
  }, []);

  const updatePolygonPositions = useCallback((id: string, newPositions: Cesium.Cartographic[]) => {
    setFeatures(prev =>
      prev.map(f =>
        f.id === id ? { ...f, metadata: { ...f.metadata, positions: newPositions } } : f
      )
    );
  }, []);

  const updateCircleCenter = useCallback((id: string, newCenter: Cesium.Cartographic) => {
    setFeatures(prev =>
      prev.map(f => {
        if (f.id !== id) return f;

        // Calculate delta for shifting related metadata points
        const oldCenter = f.metadata.centerPosition || f.metadata.center;
        if (!oldCenter) return { ...f, metadata: { ...f.metadata, center: newCenter, centerPosition: newCenter } };

        const deltaLon = newCenter.longitude - oldCenter.longitude;
        const deltaLat = newCenter.latitude - oldCenter.latitude;

        const updatedMetadata = { ...f.metadata };

        // Update center/centerPosition
        if (f.type === 'circle') {
          updatedMetadata.center = newCenter;
        } else {
          updatedMetadata.centerPosition = newCenter;
        }

        // Shift related points based on circle type
        if (f.type === 'two-point-circle' && f.metadata.diameterEndpoints) {
          updatedMetadata.diameterEndpoints = f.metadata.diameterEndpoints.map(ep =>
            new Cesium.Cartographic(ep.longitude + deltaLon, ep.latitude + deltaLat, ep.height)
          );
        } else if (f.type === 'three-point-circle' && f.metadata.circumferencePoints) {
          updatedMetadata.circumferencePoints = f.metadata.circumferencePoints.map(cp =>
            new Cesium.Cartographic(cp.longitude + deltaLon, cp.latitude + deltaLat, cp.height)
          );
        }

        return { ...f, metadata: updatedMetadata };
      })
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
          entity.point.show = new Cesium.ConstantProperty(shouldShowFeature);
        }
        if (entity.polyline) {
          entity.polyline.show = new Cesium.ConstantProperty(shouldShowFeature);
        }
        if (entity.polygon) {
          entity.polygon.show = new Cesium.ConstantProperty(shouldShowFeature);
        }
        if (entity.ellipse) {
          entity.ellipse.show = new Cesium.ConstantProperty(shouldShowFeature);
        }

        // Control label visibility (depends on features being visible)
        if (entity.label) {
          entity.label.show = new Cesium.ConstantProperty(shouldShowFeature && showLabels);
          entity.label.text = new Cesium.ConstantProperty(feature.name);
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
    updateFeaturePosition,
    updateLinePositions,
    updatePolygonPositions,
    updateCircleCenter,
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
