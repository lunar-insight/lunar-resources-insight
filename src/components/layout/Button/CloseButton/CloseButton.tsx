import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import './CloseButton.scss';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';

interface CloseButtonProps {
  onPress: () => void;
  className?: string;
  light?: boolean;
}

const CloseButton: React.FC<CloseButtonProps> = ({ 
  onPress, 
  className = '',
  light = false
}) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label='close'
        className={`close-button ${light ? 'close-button--light' : ''} ${className}`}
      >
        <span className='material-symbols-outlined close-button__icon'>
          close
        </span>
      </Button>
      <ButtonTooltip placement='left'>
        Close
      </ButtonTooltip>
    </TooltipTrigger>
  )
}

export default CloseButton;