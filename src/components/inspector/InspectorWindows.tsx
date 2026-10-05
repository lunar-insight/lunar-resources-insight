import React from 'react';
import { Portal } from 'components/ui/Portal/Portal';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { InspectorWindow } from './InspectorWindow/InspectorWindow';

/**
 * One Inspector window per feature. A closed window stays mounted, hidden, so it
 * reopens where it was left.
 */
export const InspectorWindows: React.FC = () => {
  const { features } = useFeaturesContext();
  const open = features.filter(feature => feature.inspectorOpen);

  return (
    <>
      {features.map(feature => (
        <Portal key={feature.id}>
          <InspectorWindow feature={feature} cascadeIndex={Math.max(0, open.indexOf(feature))} />
        </Portal>
      ))}
    </>
  );
};
