import React, { ReactNode } from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from '../FeaturesSection.module.scss';

interface DrawingToolToggleButtonProps {
  value: string;
  icon?: string;
  customIcon?: ReactNode;
  tooltip: string;
  isSelected: boolean;
  onChange: (selected: boolean) => void;
}

export const DrawingToolToggleButton: React.FC<DrawingToolToggleButtonProps> = ({
  value,
  icon,
  customIcon,
  tooltip,
  isSelected,
  onChange,
}) => {
  return (
    <TooltipTrigger>
      <ToggleButton
        isSelected={isSelected}
        onChange={onChange}
        aria-label={tooltip}
        className={styles.drawingToolRadio}
      >
        {({ isSelected }) => (
          <div
            className={styles.radioButton}
            data-selected={isSelected || undefined}
          >
            {customIcon ? (
              customIcon
            ) : (
              <span className={`material-symbols-outlined ${styles.icon}`}>
                {icon}
              </span>
            )}
          </div>
        )}
      </ToggleButton>
      <ButtonTooltip placement="bottom">
        {tooltip}
      </ButtonTooltip>
    </TooltipTrigger>
  );
};
