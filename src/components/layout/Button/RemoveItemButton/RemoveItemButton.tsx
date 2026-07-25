import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import styles from './RemoveItemButton.module.scss';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';

interface RemoveItemButtonProps {
  onPress: () => void;
  className?: string;
  icon?: string;
  label?: string;
  ariaLabel?: string;
  variant?: 'default' | 'danger';
}

const RemoveItemButton: React.FC<RemoveItemButtonProps> = ({
  onPress,
  className = '',
  icon = 'remove',
  label = 'Remove layer',
  ariaLabel = 'remove layer',
  variant = 'default',
}) => {
  return (
    <TooltipTrigger>
      <Button
        onPress={onPress}
        aria-label={ariaLabel}
        className={`${styles.button} ${className}`}
      >
        <span
          className={`material-symbols-outlined ${styles.icon}${
            variant === 'danger' ? ` ${styles.danger}` : ''
          }`}
        >
          {icon}
        </span>
      </Button>
      <ButtonTooltip placement='right'>
        {label}
      </ButtonTooltip>
    </TooltipTrigger>
  )
}

export default RemoveItemButton;
