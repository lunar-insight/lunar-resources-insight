import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import type { LineFile } from 'services/inspector/inspectorLayers';
import { flyToFeature } from 'utils/featureUtils';
import { useViewer } from 'utils/context/ViewerContext';
import { ShowOnMapButton } from './ShowOnMapButton';
import styles from './ShowOnMap.module.scss';

const GO_TO = 'Go to the feature';

/** "Show on the map" and "Go to the feature". */
export const PopoverFooter: React.FC<{ feature: Feature; file: LineFile }> = ({ feature, file }) => {
  const { viewer } = useViewer();
  return (
    <div className={styles.footer}>
      <ShowOnMapButton file={file} />
      <TooltipTrigger delay={400}>
        <Button aria-label={GO_TO} className={styles.goTo} onPress={() => flyToFeature(viewer, feature)}>
          <span className="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
        </Button>
        <ButtonTooltip placement="top">{GO_TO}</ButtonTooltip>
      </TooltipTrigger>
    </div>
  );
};
