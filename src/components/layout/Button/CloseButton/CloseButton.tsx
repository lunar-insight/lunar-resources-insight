import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import './CloseButton.scss';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';

interface CloseButtonProps {
  onPress: () => void;
  className?: string;
}

const CloseButton: React.FC<CloseButtonProps> = ({ onPress, className = '' }) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label='close'
        className={`close-button ${className}`}
      >
        <span className='material-symbols-outlined close-button__icon'>
          close
        </span>
      </Button>
      <ButtonTooltip placement='left'>
        close
      </ButtonTooltip>
    </TooltipTrigger>
  )
}

export default CloseButton;