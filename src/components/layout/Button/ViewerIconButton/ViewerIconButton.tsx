import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';
import styles from './ViewerIconButton.module.scss';

interface ViewerIconButtonProps {
  icon?: string;
  label?: string;
  ariaLabel: string;
  tooltipText: string;
  onPress: () => void;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const ViewerIconButton: React.FC<ViewerIconButtonProps> = ({
  icon,
  label,
  ariaLabel,
  tooltipText,
  onPress,
  tooltipPlacement = 'left',
  className = '',
}) => {
  return (
    <TooltipTrigger>
      <Button
        aria-label={ariaLabel}
        className={`${styles.viewerIconButton} ${className}`}
        onPress={onPress}
      >
        {icon && (
          <span className={`material-symbols-outlined ${styles.icon}`}>
            {icon}
          </span>
        )}
        {label && <span className={styles.label}>{label}</span>}
      </Button>
      <ButtonTooltip placement={tooltipPlacement}>
        {tooltipText}
      </ButtonTooltip>
    </TooltipTrigger>
  );
};

export default ViewerIconButton;
