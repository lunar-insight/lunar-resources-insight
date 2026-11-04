import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import type { LineFile } from 'services/inspector/inspectorLayers';
import { useShowOnMap } from './useShowOnMap';
import styles from './ShowOnMap.module.scss';

/** The popover's button. */
export const ShowOnMapButton: React.FC<{ file: LineFile }> = ({ file }) => {
  const { pressed, label, tooltip, press } = useShowOnMap(file);
  return (
    <TooltipTrigger delay={400}>
      <ToggleButton isSelected={pressed} onChange={press} className={styles.button}>
        <span className="material-symbols-outlined" aria-hidden="true">{pressed ? 'check' : 'layers'}</span>
        {label}
      </ToggleButton>
      <ButtonTooltip placement="top">{tooltip}</ButtonTooltip>
    </TooltipTrigger>
  );
};
