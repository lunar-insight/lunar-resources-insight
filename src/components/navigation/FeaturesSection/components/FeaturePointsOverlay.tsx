import React from 'react';
import { useViewer } from 'utils/context/ViewerContext';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import FeaturePointMarker from './FeaturePointMarker';

// Renders every point-type Feature as a DOM marker. Must be mounted inside
// .viewerContainer (position: relative), since screen coordinates from
// Cesium are relative to the canvas's own top-left corner, not the page's
// (see SearchResultMarker for the same requirement).
const FeaturePointsOverlay: React.FC = () => {
  const { viewer } = useViewer();
  const { features } = useFeaturesContext();

  if (!viewer) return null;

  return (
    <>
      {features
        .filter((feature) => feature.type === 'point')
        .map((feature) => (
          <FeaturePointMarker key={feature.id} viewer={viewer} feature={feature} />
        ))}
    </>
  );
};

export default FeaturePointsOverlay;
