import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import './TopBarButton.scss';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';

interface TopBarButtonProps {
  icon: string;
  ariaLabel: string;
  tooltipText: string;
  onPress: () => void;
  isSelected?: boolean;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const TopBarButton: React.FC<TopBarButtonProps> = ({
  icon,
  ariaLabel,
  tooltipText,
  onPress,
  isSelected = false,
  tooltipPlacement = 'bottom',
  className = '',
}) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label={ariaLabel}
        className={`top-bar-button ${className}`}
        data-selected={isSelected || undefined}
      >
        <span className='material-symbols-outlined top-bar-button__icon'>
          {icon}
        </span>
      </Button>
      <ButtonTooltip placement={tooltipPlacement}>
        {tooltipText}
      </ButtonTooltip>
    </TooltipTrigger>
  );
};

export default TopBarButton;
