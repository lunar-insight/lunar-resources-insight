import React, { createContext, useContext, useCallback, useState } from 'react';
import * as Cesium from 'cesium';

export type DistanceMode = 'surface' | 'terrain';

interface MeasurementContextValue {
  isActive: boolean;
  toggleMeasurement: () => void;
  points: Cesium.Cartographic[];
  setPoints: (points: Cesium.Cartographic[]) => void;
  distanceMode: DistanceMode;
  setDistanceMode: (mode: DistanceMode) => void;
  distanceMeters: number | null;
  setDistanceMeters: (meters: number | null) => void;
  isDistanceLoading: boolean;
  setIsDistanceLoading: (loading: boolean) => void;
}

const MeasurementContext = createContext<MeasurementContextValue | undefined>(undefined);

export const useMeasurementContext = () => {
  const context = useContext(MeasurementContext);
  if (!context) {
    throw new Error('useMeasurementContext must be used within a MeasurementProvider');
  }
  return context;
};

export const MeasurementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [points, setPoints] = useState<Cesium.Cartographic[]>([]);
  const [distanceMode, setDistanceMode] = useState<DistanceMode>('surface');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isDistanceLoading, setIsDistanceLoading] = useState(false);

  const toggleMeasurement = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev;
      if (!next) {
        setPoints([]);
        setDistanceMeters(null);
        setIsDistanceLoading(false);
      }
      return next;
    });
  }, []);

  return (
    <MeasurementContext.Provider
      value={{
        isActive,
        toggleMeasurement,
        points,
        setPoints,
        distanceMode,
        setDistanceMode,
        distanceMeters,
        setDistanceMeters,
        isDistanceLoading,
        setIsDistanceLoading,
      }}
    >
      {children}
    </MeasurementContext.Provider>
  );
};
