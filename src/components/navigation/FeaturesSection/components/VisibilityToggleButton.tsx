import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './VisibilityToggleButton.module.scss';

interface VisibilityToggleButtonProps {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  label: string;
  tooltip: string;
  isDisabled?: boolean;
}

export const VisibilityToggleButton: React.FC<VisibilityToggleButtonProps> = ({
  isSelected,
  onChange,
  label,
  tooltip,
  isDisabled = false,
}) => {
  return (
    <TooltipTrigger>
      <ToggleButton
        isSelected={isSelected}
        onChange={onChange}
        isDisabled={isDisabled}
        aria-label={tooltip}
        className={styles.visibilityToggle}
      >
        {({ isSelected }) => (
          <>
            <span className={`material-symbols-outlined ${styles.icon}`}>
              {isSelected ? 'visibility' : 'visibility_off'}
            </span>
            <span className={styles.label}>{label}</span>
          </>
        )}
      </ToggleButton>
      <ButtonTooltip placement="bottom">{tooltip}</ButtonTooltip>
    </TooltipTrigger>
  );
};
