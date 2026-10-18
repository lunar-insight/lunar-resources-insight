import React, { useRef } from 'react';
import * as Cesium from 'cesium';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { useTrackedScreenPosition } from 'hooks/useTrackedScreenPosition';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { GLOBE_POPUP_ATTRIBUTE, useGlobePopup } from 'utils/context/GlobePopupContext';
import { shapeWord } from 'services/inspector/featureGeometry';
import { formatCoordinatePair } from 'utils/featurePointNaming';
import { useCopyCoordinates } from 'hooks/useCopyCoordinates';
import { Feature } from '../types';
import styles from 'components/viewer/Callout/Callout.module.scss';

interface FeatureCalloutProps {
  viewer: Cesium.Viewer;
  feature: Feature;
  /** Where the leader line points. */
  position: Cesium.Cartographic;
}

// Clears the point's dot, so the leader line ends at its edge.
const ANCHOR_TRANSFORM = 'translate(-50%, -100%) translateY(-7px)';

/**
 * A saved feature's box: its name and coordinate, then Inspect, Copy
 * coordinates, Delete and close, the actions of its Features list row.
 * Positioned like SearchResultCallout, which shares its look.
 */
const FeatureCallout: React.FC<FeatureCalloutProps> = ({ viewer, feature, position }) => {
  const { openFeatureInspector, removeFeature } = useFeaturesContext();
  const { closePopup } = useGlobePopup();
  const copyCoordinates = useCopyCoordinates();
  const elementRef = useRef<HTMLDivElement>(null);
  const lon = Cesium.Math.toDegrees(position.longitude);
  const lat = Cesium.Math.toDegrees(position.latitude);
  useTrackedScreenPosition(viewer, lon, lat, elementRef, ANCHOR_TRANSFORM, true, position.height);

  const word = shapeWord(feature.type);
  const act = (action: () => void) => () => {
    closePopup();
    action();
  };

  return (
    <div
      ref={elementRef}
      className={styles.anchor}
      style={{ display: 'none' }}
      {...{ [GLOBE_POPUP_ATTRIBUTE]: '' }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={styles.box} role="dialog" aria-label={feature.name}>
        <span className={styles.label}>
          <span className={styles.title}>{feature.name}</span>
          <span className={styles.coordinate}>{formatCoordinatePair(lat, lon)}</span>
        </span>
        <div className={styles.actions}>
          <Button className={styles.primaryButton} onPress={act(() => openFeatureInspector(feature.id))}>
            Inspect
          </Button>
          <Button className={styles.button} onPress={act(() => void copyCoordinates(lat, lon))}>
            Copy coordinates
          </Button>
          <TooltipTrigger>
            <Button
              aria-label={`Delete ${word}`}
              className={`${styles.iconButton} ${styles.dangerButton}`}
              onPress={act(() => removeFeature(feature.id))}
            >
              <span className="material-symbols-outlined" aria-hidden="true">delete</span>
            </Button>
            <ButtonTooltip placement="top">{`Delete ${word}`}</ButtonTooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button aria-label="Close" className={styles.iconButton} onPress={closePopup}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </Button>
            <ButtonTooltip placement="top">Close</ButtonTooltip>
          </TooltipTrigger>
        </div>
      </div>
      <div className={styles.leader} />
    </div>
  );
};

export default FeatureCallout;
