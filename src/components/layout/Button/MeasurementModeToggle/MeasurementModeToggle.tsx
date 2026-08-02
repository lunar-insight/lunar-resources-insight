import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { useMeasurementContext, DistanceMode } from 'utils/context/MeasurementContext';
import { DirectPathIcon } from './icons/DirectPathIcon';
import { TerrainPathIcon } from './icons/TerrainPathIcon';
import styles from './MeasurementModeToggle.module.scss';

interface ModeOption {
  mode: DistanceMode;
  label: string;
  tooltip: string;
  Icon: React.FC<{ className?: string }>;
}

const OPTIONS: ModeOption[] = [
  { mode: 'surface', label: 'Direct', tooltip: 'Straight-line distance, ignoring terrain', Icon: DirectPathIcon },
  { mode: 'terrain', label: 'Terrain', tooltip: 'Distance following terrain elevation', Icon: TerrainPathIcon },
];

// Only rendered while the measurement tool is active, since the mode has no
// meaning otherwise.
const MeasurementModeToggle: React.FC = () => {
  const { isActive, distanceMode, setDistanceMode } = useMeasurementContext();

  if (!isActive) return null;

  return (
    <div className={styles.modeToggle}>
      {OPTIONS.map(({ mode, label, tooltip, Icon }) => (
        <TooltipTrigger key={mode}>
          <Button
            onPress={() => setDistanceMode(mode)}
            aria-label={`${label} distance`}
            className={styles.modeOption}
            data-selected={distanceMode === mode || undefined}
          >
            <Icon className={styles.modeIcon} />
            {label}
          </Button>
          <ButtonTooltip placement="bottom">{tooltip}</ButtonTooltip>
        </TooltipTrigger>
      ))}
    </div>
  );
};

export default MeasurementModeToggle;
