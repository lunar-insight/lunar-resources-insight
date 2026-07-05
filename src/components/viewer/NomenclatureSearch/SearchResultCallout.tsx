import React, { useRef } from 'react';
import * as Cesium from 'cesium';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { useTrackedScreenPosition } from './useTrackedScreenPosition';
import styles from './NomenclatureSearch.module.scss';

interface SearchResultCalloutProps {
  viewer: Cesium.Viewer;
  lon: number;
  lat: number;
  label: string;
  alreadySaved: boolean;
  onSave: () => void;
  onAnalyze: () => void;
  onDismiss: () => void;
}

// Anchored to the same tracked screen position as SearchResultMarker (shared
// hook) so the box, its leader line, and the pin below it never drift apart.
const SearchResultCallout: React.FC<SearchResultCalloutProps> = ({
  viewer,
  lon,
  lat,
  label,
  alreadySaved,
  onSave,
  onAnalyze,
  onDismiss,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  useTrackedScreenPosition(viewer, lon, lat, elementRef, 'translate(-50%, -100%)');

  return (
    // Deliberately not portaled to document.body, see SearchResultMarker for
    // why: canvas-relative coordinates need .viewerContainer's positioning
    // context, not the page's.
    //
    // Starts hidden, useTrackedScreenPosition sets display/transform directly
    // via the ref before the browser paints.
    <div ref={elementRef} className={styles.searchResultCalloutAnchor} style={{ display: 'none' }}>
      <div className={styles.searchResultCallout}>
        <span className={styles.searchResultCalloutLabel}>{label}</span>
        <div className={styles.searchResultCalloutActions}>
          {alreadySaved ? (
            <span className={styles.searchResultCalloutSaved}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              Saved
            </span>
          ) : (
            <Button className={styles.searchResultCalloutSave} onPress={onSave}>
              Save
            </Button>
          )}
          <Button className={styles.searchResultCalloutAnalyze} onPress={onAnalyze}>
            Analyze
          </Button>
          <TooltipTrigger>
            <Button
              aria-label="Dismiss marker"
              className={styles.searchResultCalloutDismiss}
              onPress={onDismiss}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </Button>
            <ButtonTooltip placement="top">Dismiss marker</ButtonTooltip>
          </TooltipTrigger>
        </div>
      </div>
      {/* Leader line ties the floating box back to the exact point it describes,
          useful once the camera tilts into a 3D view where the box could
          otherwise look disconnected from the pin below it. */}
      <div className={styles.searchResultCalloutLeader} />
    </div>
  );
};

export default SearchResultCallout;
