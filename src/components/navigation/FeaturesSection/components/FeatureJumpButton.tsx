import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './FeatureInsightsButton.module.scss';

interface FeatureJumpButtonProps {
  onPress: () => void;
}

export const FeatureJumpButton: React.FC<FeatureJumpButtonProps> = ({
  onPress,
}) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label="Jump to Feature"
        className={styles.insightsButton}
      >
        <span className="material-symbols-outlined">
          location_searching
        </span>
      </Button>
      <ButtonTooltip placement="bottom">
        Jump to Feature
      </ButtonTooltip>
    </TooltipTrigger>
  );
};
