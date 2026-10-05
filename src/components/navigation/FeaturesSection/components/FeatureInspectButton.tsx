import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './FeatureActionButton.module.scss';

interface FeatureInspectButtonProps {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
}

export const FeatureInspectButton: React.FC<FeatureInspectButtonProps> = ({
  isSelected,
  onChange,
}) => {
  return (
    <TooltipTrigger>
      <ToggleButton
        isSelected={isSelected}
        onChange={onChange}
        aria-label="Inspect"
        className={styles.actionButton}
      >
        <span className="material-symbols-outlined">
          search_insights
        </span>
      </ToggleButton>
      <ButtonTooltip placement="bottom">
        Inspect
      </ButtonTooltip>
    </TooltipTrigger>
  );
};
