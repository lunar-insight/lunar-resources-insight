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
  const [disableRequests, setDisableRequests] = useState<Record<string, boolean>>({});
  const [isEnabled, setIsEnabled] = useState(true);
  const enableTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const requestDisable = useCallback((id: string) => {
    // Cancel any current activation timeout
    if (enableTimeoutRef.current) {
      clearTimeout(enableTimeoutRef.current);
      enableTimeoutRef.current = null;
    }

    setDisableRequests(prev => {
      const wasEnabled = Object.keys(prev).length === 0;
      const newRequests = { ...prev, [id]: true };
      
      if (wasEnabled) {
        setIsEnabled(false);
        pointValueService.disableMouseTracking();
      }
      
      return newRequests;
    });
  }, []);

  const requestEnable = useCallback((id: string) => {
    // Cancel any previous activation timeout
    if (enableTimeoutRef.current) {
      clearTimeout(enableTimeoutRef.current);
      enableTimeoutRef.current = null;
    }

    setDisableRequests(prev => {
      const newRequests = { ...prev };
      delete newRequests[id];
      
      if (Object.keys(newRequests).length === 0) {
        enableTimeoutRef.current = setTimeout(() => {
          setDisableRequests(current => {
            if (Object.keys(current).length === 0) {
              setIsEnabled(true);
              pointValueService.enableMouseTracking();
            }
            return current;
          });
          enableTimeoutRef.current = null;
        }, 50);
      }
      
      return newRequests;
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (enableTimeoutRef.current) {
        clearTimeout(enableTimeoutRef.current);
      }
      setDisableRequests({});
      pointValueService.enableMouseTracking();
    };
  }, []);

  return (
    <MouseTrackingContext.Provider value={{ requestDisable, requestEnable, isEnabled }}>
      {children}
    </MouseTrackingContext.Provider>
  );
};