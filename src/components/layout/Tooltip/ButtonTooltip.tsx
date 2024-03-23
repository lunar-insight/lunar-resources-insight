import React, { CSSProperties } from 'react';
import { OverlayArrow, Tooltip, type TooltipProps } from "react-aria-components";
import './ButtonTooltip.scss';
import { theme } from 'theme';

interface ButtonTooltipProps extends Omit<TooltipProps, 'children'> { 
  children: React.ReactNode;
}

export function ButtonTooltip({ children, ...props }: ButtonTooltipProps) {

  const style: CSSProperties & { [key: string]: string } = {
    '--color-primary': theme.color.primary,
    '--color-secondary': theme.color.secondary,
    '--color-tertiary': theme.color.tertiary,
    '--color-quartenary': theme.color.quartenary,
    '--color-neutral': theme.color.neutral,
    '--color-neutralVariant': theme.color.neutralVariant,
  };

  return (
    <Tooltip {...props} className="button-tooltip" style={style}>
      <OverlayArrow className="button-tooltip__overlay-arrow">
        <svg width={8} height={8} viewBox="0 0 8 8">
          <path d="M0 0 L4 4 L8 0" />
        </svg>
      </OverlayArrow>
      {children}
    </Tooltip>
  );
}