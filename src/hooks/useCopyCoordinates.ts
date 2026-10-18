import { useCallback } from 'react';
import { useToast } from 'utils/context/ToastContext';
import { formatCoordinatePair } from 'utils/featurePointNaming';
import { copyText } from 'utils/clipboard';

/** Copies a coordinate as "lat, lon" and confirms it in a toast. */
export function useCopyCoordinates(): (lat: number, lon: number) => Promise<void> {
  const { showToast } = useToast();

  return useCallback(async (lat: number, lon: number) => {
    const text = formatCoordinatePair(lat, lon);
    if (await copyText(text)) {
      showToast({ icon: 'check', message: 'Coordinates copied', detail: text });
    } else {
      showToast({ icon: 'error', message: 'The coordinates could not be copied' });
    }
  }, [showToast]);
}
