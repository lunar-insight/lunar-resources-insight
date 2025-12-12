import React, { useState } from 'react';
import { Button, TooltipTrigger, DialogTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../Tooltip/ButtonTooltip';
import { InfoPopover } from '../../Popover/InfoPopover/InfoPopover';
import styles from './InfoButton.module.scss';

interface InfoButtonProps {
  tooltipText: string;
  popoverTitle: string;
  popoverBody: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const InfoButton: React.FC<InfoButtonProps> = ({
  tooltipText,
  popoverTitle,
  popoverBody,
  placement = 'bottom',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger onOpenChange={setIsOpen}>
      <TooltipTrigger>
        <Button
          aria-label={tooltipText}
          className={`${styles.infoButton} ${className}`}
        >
          <span className={`material-symbols-outlined ${styles.icon}`}>
            info
          </span>
        </Button>
        <ButtonTooltip placement={placement}>
          {tooltipText}
        </ButtonTooltip>
      </TooltipTrigger>
      <InfoPopover title={popoverTitle} body={popoverBody} isOpen={isOpen} />
    </DialogTrigger>
  );
};

export default InfoButton;
