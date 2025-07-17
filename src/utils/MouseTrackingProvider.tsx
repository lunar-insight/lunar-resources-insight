import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { pointValueService } from '../services/PointValueService';

interface MouseTrackingContextValue {
  requestDisable: (id: string) => void;
  requestEnable: (id: string) => void;
  isEnabled: boolean;
}

const MouseTrackingContext = createContext<MouseTrackingContextValue | undefined>(undefined);

export const useMouseTracking = () => {
  const context = useContext(MouseTrackingContext);
  if (!context) {
    throw new Error('useMouseTracking must be used within a MouseTrackingProvider');
  }
  return context;
};

export const MouseTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [disableRequests] = useState<Set<string>>(() => new Set());
 const [isEnabled, setIsEnabled] = useState(true);
 
 const requestDisable = useCallback((id: string) => {
  const wasEnabled = disableRequests.size === 0;
  disableRequests.add(id);

  if (wasEnabled && disableRequests.size > 0) {
    setIsEnabled(false);
    pointValueService.disableMouseTracking();
  }
 }, [disableRequests]);

 const requestEnable = useCallback((id: string) => {
  const wasEnabled = disableRequests.size === 0;
  disableRequests.delete(id);

  if (!wasEnabled && disableRequests.size === 0) {
    setIsEnabled(true);
    pointValueService.enableMouseTracking();
  }
 }, [disableRequests]);

 // Cleanup
 useEffect(() => {
  return () => {
    disableRequests.clear();
    pointValueService.enableMouseTracking();
  };
 }, [disableRequests]);

 return (
  <MouseTrackingContext.Provider value={{ requestDisable, requestEnable, isEnabled }}>
    {children}
  </MouseTrackingContext.Provider>
 );
};