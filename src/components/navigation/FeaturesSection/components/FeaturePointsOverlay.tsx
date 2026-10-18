import React from 'react';
import { useViewer } from 'utils/context/ViewerContext';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useGlobePopup } from 'utils/context/GlobePopupContext';
import FeaturePointMarker from './FeaturePointMarker';
import FeatureCallout from './FeatureCallout';

// Renders every point-type Feature as a DOM marker, and the box of the point
// whose box is open. Must be mounted inside .viewerContainer (position:
// relative), since screen coordinates from Cesium are relative to the
// canvas's own top-left corner, not the page's (see SearchResultMarker for
// the same requirement).
const FeaturePointsOverlay: React.FC = () => {
  const { viewer } = useViewer();
  const { features } = useFeaturesContext();
  const { popup } = useGlobePopup();

  if (!viewer) return null;

  const boxFeature = popup?.kind === 'feature' ? features.find((feature) => feature.id === popup.featureId) : undefined;
  const boxPosition = boxFeature?.metadata.position;

  return (
    <>
      {features
        .filter((feature) => feature.type === 'point')
        .map((feature) => (
          <FeaturePointMarker key={feature.id} viewer={viewer} feature={feature} />
        ))}
      {boxFeature && boxPosition && (
        <FeatureCallout key={boxFeature.id} viewer={viewer} feature={boxFeature} position={boxPosition} />
      )}
    </>
  );
};

export default FeaturePointsOverlay;
