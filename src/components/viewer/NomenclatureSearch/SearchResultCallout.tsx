import React, { useEffect, useState } from 'react';
import * as Cesium from 'cesium';
import { Button } from 'react-aria-components';
import { Portal } from 'components/ui/Portal/Portal';
import styles from './NomenclatureSearch.module.scss';

interface SearchResultCalloutProps {
  viewer: Cesium.Viewer;
  label: string;
  alreadySaved: boolean;
  getScreenPosition: () => Cesium.Cartesian2 | null;
  onAnalyze: () => void;
  onDismiss: () => void;
}

// Anchored to the search result pin's screen position, recomputed whenever Cesium
// re-renders a frame (camera move, zoom, etc.) rather than on a separate rAF loop.
const SearchResultCallout: React.FC<SearchResultCalloutProps> = ({
  viewer,
  label,
  alreadySaved,
  getScreenPosition,
  onAnalyze,
  onDismiss,
}) => {
  const [screenPosition, setScreenPosition] = useState<Cesium.Cartesian2 | null>(null);

  useEffect(() => {
    const update = () => setScreenPosition(getScreenPosition());
    update();
    viewer.scene.postRender.addEventListener(update);
    return () => {
      viewer.scene.postRender.removeEventListener(update);
    };
  }, [viewer, getScreenPosition]);

  if (!screenPosition) return null;

  return (
    <Portal>
      <div
        className={styles.searchResultCallout}
        style={{ left: screenPosition.x, top: screenPosition.y }}
      >
        <span className={styles.searchResultCalloutLabel}>{label}</span>
        <div className={styles.searchResultCalloutActions}>
          {alreadySaved ? (
            <span className={styles.searchResultCalloutSaved}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              Saved
            </span>
          ) : (
            <Button className={styles.searchResultCalloutAnalyze} onPress={onAnalyze}>
              Analyze
            </Button>
          )}
          <Button
            aria-label="Dismiss marker"
            className={styles.searchResultCalloutDismiss}
            onPress={onDismiss}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </Button>
        </div>
      </div>
    </Portal>
  );
};

export default SearchResultCallout;
