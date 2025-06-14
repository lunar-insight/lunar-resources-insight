import React, { CSSProperties } from 'react';
import { OverlayArrow, Tooltip, type TooltipProps } from "react-aria-components";
import './ButtonTooltip.scss';

interface ButtonTooltipProps extends Omit<TooltipProps, 'children'> { 
  children: React.ReactNode;
}

export function ButtonTooltip({ children, ...props }: ButtonTooltipProps) {

  return (
    <Tooltip {...props} className="button-tooltip">
      <OverlayArrow className="button-tooltip__overlay-arrow">
        <svg width={8} height={8} viewBox="0 0 8 8">
          <path d="M0 0 L4 4 L8 0" />
        </svg>
      </OverlayArrow>
      {children}
    </Tooltip>
  );
}