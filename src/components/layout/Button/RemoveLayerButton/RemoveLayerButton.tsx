import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import './RemoveLayerButton.scss';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';

interface RemoveLayerButtonProps {
  onPress: () => void;
  className?: string;
}

const RemoveLayerButton: React.FC<RemoveLayerButtonProps> = ({ onPress, className = '' }) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label='remove layer'
        className={`remove-layer-button ${className}`}
      >
        <span className='material-symbols-outlined remove-layer-button__icon'>
          remove
        </span>
      </Button>
      <ButtonTooltip placement='left'>
        Remove layer
      </ButtonTooltip>
    </TooltipTrigger>
  )
}

export default RemoveLayerButton;