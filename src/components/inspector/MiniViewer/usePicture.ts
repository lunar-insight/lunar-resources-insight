import { useEffect, useSyncExternalStore } from 'react';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import { useInspectorContext } from 'utils/context/InspectorContext';
import type { LineFile } from 'services/inspector/inspectorLayers';
import { pictureKey, type PictureEntry, type PictureKind } from 'services/inspector/PictureStore';

export interface UsedPicture {
  entry: PictureEntry | undefined;
  retry: () => void;
}

/**
 * One picture, requested on mount and when its key changes while `active`. An
 * entry removed by a feature's cancel is requested again while still shown.
 */
export function usePicture(feature: Feature, file: LineFile, kind: PictureKind, active = true): UsedPicture {
  const { pictures } = useInspectorContext().store;
  useSyncExternalStore(pictures.subscribe, pictures.getVersion);

  const key = pictureKey(feature, file, kind);
  const entry = pictures.get(key);
  const missing = !entry;

  useEffect(() => {
    if (active && missing) pictures.request(feature, file, kind);
    // The key stands for the feature's geometry and the file
  }, [active, missing, key, pictures]);

  return { entry, retry: () => pictures.retry(key) };
}
