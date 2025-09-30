import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { pointValueService } from '../services/PointValueService';

interface MouseTrackingContextValue {
  requestDisable: (id: string) => void;
  requestEnable: (id: string) => void;
  isEnabled: boolean;
  hasDisableRequests: () => boolean;
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

  useEffect(() => {
    const hasRequests = Object.keys(disableRequests).length > 0;
    
    if (hasRequests && isEnabled) {
      // Deactivate immediatly
      setIsEnabled(false);
      pointValueService.disableMouseTracking();
      
      // Remove any ongoing waiting state timeout
      if (enableTimeoutRef.current) {
        clearTimeout(enableTimeoutRef.current);
        enableTimeoutRef.current = null;
      }
    } else if (!hasRequests && !isEnabled) {
      // Reactivate after a delay
      enableTimeoutRef.current = setTimeout(() => {
        setIsEnabled(true);
        pointValueService.enableMouseTracking();
        enableTimeoutRef.current = null;
      }, 50);
    }

    return () => {
      if (enableTimeoutRef.current) {
        clearTimeout(enableTimeoutRef.current);
        enableTimeoutRef.current = null;
      }
    };
  }, [disableRequests, isEnabled]);

  const requestDisable = useCallback((id: string) => {
    setDisableRequests(prev => ({ ...prev, [id]: true }));
  }, []);

  const requestEnable = useCallback((id: string) => {
    setDisableRequests(prev => {
      const newRequests = { ...prev };
      delete newRequests[id];
      return newRequests;
    });
  }, []);

  const hasDisableRequests = useCallback(() => {
    return Object.keys(disableRequests).length > 0;
  }, [disableRequests]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (enableTimeoutRef.current) {
        clearTimeout(enableTimeoutRef.current);
      }
      pointValueService.enableMouseTracking();
    };
  }, []);

  return (
    <MouseTrackingContext.Provider value={{ 
      requestDisable, 
      requestEnable, 
      isEnabled,
      hasDisableRequests
    }}>
      {children}
    </MouseTrackingContext.Provider>
  );
};