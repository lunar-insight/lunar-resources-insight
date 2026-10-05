import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useFeaturesContext } from './FeaturesContext';
import { useViewer } from './ViewerContext';
import { InspectorStore, type FeatureResults } from 'services/inspector/InspectorStore';
import { allLineFiles, inspectorLines } from 'services/inspector/inspectorLayers';
import { layerStatsService } from 'services/LayerStatsService';

interface InspectorContextType {
  store: InspectorStore;
  comparedIds: Set<string>;
  toggleCompared: (featureId: string) => void;
  addCompared: (featureId: string) => void;
  isComparisonOpen: boolean;
  setComparisonOpen: (open: boolean) => void;
  /** Fetches the whole Moon statistics still missing, as opening an Inspector does. */
  retryMissingStatistics: () => void;
}

const InspectorContext = createContext<InspectorContextType | undefined>(undefined);

export const InspectorProvider: React.FC<{ children: React.ReactNode; store?: InspectorStore }> = ({
  children,
  store: givenStore,
}) => {
  const { features } = useFeaturesContext();
  const { viewer } = useViewer();
  const [store] = useState(() => givenStore ?? new InspectorStore());
  const [comparedIds, setComparedIds] = useState<Set<string>>(new Set());
  const [isComparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => {
    store.sync(features);
    // A deleted feature leaves the comparison with its results.
    setComparedIds(prev => {
      const ids = new Set(features.map(feature => feature.id));
      const kept = [...prev].filter(id => ids.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [store, features]);

  useEffect(() => () => store.dispose(), [store]);

  // Area statistics share the tile instance, so they wait while the camera moves.
  useEffect(() => {
    if (!viewer) return;
    const removeStart = viewer.camera.moveStart.addEventListener(() => store.pauseAreas());
    const removeEnd = viewer.camera.moveEnd.addEventListener(() => store.resumeAreas());
    return () => {
      removeStart();
      removeEnd();
      store.resumeAreas();
    };
  }, [viewer, store]);

  const toggleCompared = useCallback((featureId: string) => {
    setComparedIds(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  }, []);

  const addCompared = useCallback((featureId: string) => {
    setComparedIds(prev => (prev.has(featureId) ? prev : new Set(prev).add(featureId)));
  }, []);

  const retryMissingStatistics = useCallback(() => {
    void layerStatsService.retryMissing(allLineFiles(inspectorLines).map(file => file.filename));
  }, []);

  const value = useMemo(() => ({
    store,
    comparedIds,
    toggleCompared,
    addCompared,
    isComparisonOpen,
    setComparisonOpen,
    retryMissingStatistics,
  }), [store, comparedIds, toggleCompared, addCompared, isComparisonOpen, retryMissingStatistics]);

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
};

export const useInspectorContext = (): InspectorContextType => {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('useInspectorContext must be used within an InspectorProvider');
  return context;
};

/** Results of one feature, updated as they arrive. */
export function useFeatureResults(featureId: string): FeatureResults | undefined {
  const { store } = useInspectorContext();
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store.get(featureId);
}

/** Re-renders when whole Moon statistics are stored. */
export function useLayerStatsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => layerStatsService.subscribe(() => setVersion(v => v + 1)), []);
  return version;
}
