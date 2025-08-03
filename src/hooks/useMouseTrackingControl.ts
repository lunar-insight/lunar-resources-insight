import { useEffect, useRef } from 'react';
import { useMouseTracking } from '../utils/MouseTrackingProvider';

export const useMouseTrackingControl = (
  shouldDisable: boolean, 
  componentId?: string
) => {
  const { requestDisable, requestEnable } = useMouseTracking();
  const trackingId = useRef(componentId || `component-${Math.random().toString(36).substring(2, 11)}`).current;

  useEffect(() => {
    if (shouldDisable) {
      requestDisable(trackingId);
    } else {
      requestEnable(trackingId);
    }

    // Cleanup
    return () => {
      requestEnable(trackingId);
    };
  }, [shouldDisable, trackingId, requestDisable, requestEnable]);

  return trackingId;
};