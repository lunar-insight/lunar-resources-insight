import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from './ViewerContext';
import { generateFeatureName, useFeaturesContext } from './FeaturesContext';
import { useAppSettings } from './AppSettingsContext';
import { useDialogContext } from 'utils/DialogWindowManagement';
import { createPointFeature } from 'services/drawing/PointDrawingService';
import { pointValueService } from 'services/PointValueService';
import {
  DROP_END,
  FEATURES_DIALOG_ID,
  FLY_START,
  IMPACT_START,
  MARKER_START,
  RAIL_RECEIVE_DURATION,
  REDUCED_MARKER_DURATION,
  REDUCED_NOTICE_DURATION,
  REDUCED_RING_DURATION,
  ROW_HIGHLIGHT_DURATION,
} from 'components/viewer/PointDrop/pointDropTimeline';

/** probe: falling to the spot. impact: on the ground. fly: a dot flying to Features. */
export type DropStage = 'probe' | 'impact' | 'fly';
export type FlyTarget = 'row' | 'rail';

export interface PointDrop {
  id: number;
  featureId: string;
  position: Cesium.Cartesian3;
  reduceMotion: boolean;
  stage: DropStage;
  /** Where the dot flies: the new row while the Features window is open, otherwise the Features button. */
  flyTarget: FlyTarget | null;
}

/** hidden: before the probe lands. pop and fade: the marker's entrance. */
export type MarkerArrival = 'hidden' | 'pop' | 'fade';
/** pending: hidden until the dot lands on it. highlight: lights up once. notice: the same, shorter, for reduced motion. */
export type RowArrival = 'pending' | 'highlight' | 'notice';

export interface RailNotice {
  /** Changes with every notice, so the animation restarts. */
  key: number;
  /** receive: the dot landed, with "+1". notice: the background lights up, for reduced motion. */
  kind: 'receive' | 'notice';
}

interface PointDropContextValue {
  drops: PointDrop[];
  markerArrivals: Record<string, MarkerArrival>;
  rowArrivals: Record<string, RowArrival>;
  railNotice: RailNotice | null;
  /** Creates a point and plays the drop. The scanner hold is released once the marker appears. */
  dropPoint: (position: Cesium.Cartesian3, holdToken: number | null) => void;
}

const PointDropContext = createContext<PointDropContextValue | undefined>(undefined);

const withEntry = <T,>(record: Record<string, T>, key: string, value: T | null): Record<string, T> => {
  const next = { ...record };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
};

/**
 * Creates points from the globe menu and runs the timeline of their drop:
 * the probe falls, hits the ground, the marker appears and a dot flies to
 * Features. The overlay draws the drops; the marker, the Features row and the
 * Features button read their arrival state from here.
 */
export const PointDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { viewer } = useViewer();
  const { addFeature } = useFeaturesContext();
  const { reduceMotion } = useAppSettings();
  const { isDialogOpen } = useDialogContext();
  const [drops, setDrops] = useState<PointDrop[]>([]);
  const [markerArrivals, setMarkerArrivals] = useState<Record<string, MarkerArrival>>({});
  const [rowArrivals, setRowArrivals] = useState<Record<string, RowArrival>>({});
  const [railNotice, setRailNotice] = useState<RailNotice | null>(null);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const framesRef = useRef(new Set<number>());
  const nextIdRef = useRef(1);

  // The window state is read when the dot takes off, not when the drop starts.
  const isDialogOpenRef = useRef(isDialogOpen);
  isDialogOpenRef.current = isDialogOpen;
  const featuresTarget = (): FlyTarget => (isDialogOpenRef.current(FEATURES_DIALOG_ID) ? 'row' : 'rail');

  useEffect(() => {
    const timers = timersRef.current;
    const frames = framesRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
      frames.forEach(cancelAnimationFrame);
      frames.clear();
    };
  }, []);

  const later = useCallback((ms: number, action: () => void) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      action();
    }, ms);
    timersRef.current.add(timer);
  }, []);

  // Runs after the next frame is painted: the second animation frame callback
  // comes after the paint that follows the first.
  const afterPaint = useCallback((action: () => void) => {
    const frame = (callback: () => void) => {
      const id = requestAnimationFrame(() => {
        framesRef.current.delete(id);
        callback();
      });
      framesRef.current.add(id);
    };
    frame(() => frame(action));
  }, []);

  const updateDrop = useCallback((id: number, changes: Partial<PointDrop>) => {
    setDrops(prev => prev.map(drop => (drop.id === id ? { ...drop, ...changes } : drop)));
  }, []);

  const removeDrop = useCallback((id: number) => {
    setDrops(prev => prev.filter(drop => drop.id !== id));
  }, []);

  const setMarker = useCallback((featureId: string, arrival: MarkerArrival | null) => {
    setMarkerArrivals(prev => withEntry(prev, featureId, arrival));
  }, []);

  const setRow = useCallback((featureId: string, arrival: RowArrival | null) => {
    setRowArrivals(prev => withEntry(prev, featureId, arrival));
  }, []);

  const notifyRail = useCallback((kind: RailNotice['kind'], duration: number) => {
    const key = nextIdRef.current++;
    setRailNotice({ key, kind });
    later(duration, () => setRailNotice(current => (current?.key === key ? null : current)));
  }, [later]);

  // Lights up the row while the Features window is open, otherwise the Features button.
  const announce = useCallback((featureId: string, target: FlyTarget, reduced: boolean) => {
    if (target === 'row') {
      setRow(featureId, reduced ? 'notice' : 'highlight');
      later(reduced ? REDUCED_NOTICE_DURATION : ROW_HIGHLIGHT_DURATION, () => setRow(featureId, null));
    } else {
      setRow(featureId, null);
      notifyRail(reduced ? 'notice' : 'receive', reduced ? REDUCED_NOTICE_DURATION : RAIL_RECEIVE_DURATION);
    }
  }, [later, notifyRail, setRow]);

  const dropPoint = useCallback((position: Cesium.Cartesian3, holdToken: number | null) => {
    if (!viewer) return;

    const feature = createPointFeature(viewer, position, generateFeatureName('point'));
    const id = nextIdRef.current++;
    const releaseHold = () => {
      if (holdToken !== null) pointValueService.releaseHold(holdToken);
    };

    if (reduceMotion) {
      addFeature(feature);
      setDrops(prev => [...prev, { id, featureId: feature.id, position, reduceMotion, stage: 'impact', flyTarget: null }]);
      setMarker(feature.id, 'fade');
      releaseHold();
      announce(feature.id, featuresTarget(), true);
      later(REDUCED_MARKER_DURATION, () => setMarker(feature.id, null));
      later(REDUCED_RING_DURATION, () => removeDrop(id));
      return;
    }

    setDrops(prev => [...prev, { id, featureId: feature.id, position, reduceMotion, stage: 'probe', flyTarget: null }]);
    setMarker(feature.id, 'hidden');
    setRow(feature.id, 'pending');
    // Adding the feature re-renders the Features list and starts the
    // Inspector, which keeps the main thread busy. Added once the probe is on
    // screen, that work does not hold up the probe, which the compositor animates.
    afterPaint(() => addFeature(feature));

    later(IMPACT_START, () => updateDrop(id, { stage: 'impact' }));
    later(MARKER_START, () => {
      setMarker(feature.id, 'pop');
      releaseHold();
    });
    let target: FlyTarget = 'rail';
    later(FLY_START, () => {
      setMarker(feature.id, null);
      target = featuresTarget();
      updateDrop(id, { stage: 'fly', flyTarget: target });
    });
    later(DROP_END, () => {
      removeDrop(id);
      announce(feature.id, target, false);
    });
  }, [viewer, addFeature, reduceMotion, later, afterPaint, updateDrop, removeDrop, setMarker, setRow, announce]);

  const value = useMemo(
    () => ({ drops, markerArrivals, rowArrivals, railNotice, dropPoint }),
    [drops, markerArrivals, rowArrivals, railNotice, dropPoint]
  );

  return <PointDropContext.Provider value={value}>{children}</PointDropContext.Provider>;
};

export const usePointDrop = (): PointDropContextValue => {
  const context = useContext(PointDropContext);
  if (!context) {
    throw new Error('usePointDrop must be used within a PointDropProvider');
  }
  return context;
};
