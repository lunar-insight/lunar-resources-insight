import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import type { InspectorLine, LineFile } from 'services/inspector/inspectorLayers';
import { useShowOnMap } from './useShowOnMap';
import styles from './ShowOnMap.module.scss';

interface ShowOnMapToggleProps {
  line: Pick<InspectorLine, 'symbol' | 'datasetShort'>;
  file: LineFile;
  className?: string;
}

/** The row's icon. */
export const ShowOnMapToggle: React.FC<ShowOnMapToggleProps> = ({ line, file, className = '' }) => {
  const { pressed, tooltip, press } = useShowOnMap(file);
  return (
    <TooltipTrigger delay={400}>
      <ToggleButton
        isSelected={pressed}
        onChange={press}
        aria-label={`${line.symbol} · ${line.datasetShort} on the map`}
        className={`${styles.toggle} ${className}`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">layers</span>
      </ToggleButton>
      <ButtonTooltip placement="top">{tooltip}</ButtonTooltip>
    </TooltipTrigger>
  );
};
