import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './FeatureInsightsButton.module.scss';

interface FeatureInsightsButtonProps {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
}

export const FeatureInsightsButton: React.FC<FeatureInsightsButtonProps> = ({
  isSelected,
  onChange,
}) => {
  return (
    <TooltipTrigger>
      <ToggleButton
        isSelected={isSelected}
        onChange={onChange}
        aria-label="Feature Insights"
        className={styles.insightsButton}
      >
        <span className="material-symbols-outlined">
          search_insights
        </span>
      </ToggleButton>
      <ButtonTooltip placement="left">
        Feature Insights
      </ButtonTooltip>
    </TooltipTrigger>
  );
};
