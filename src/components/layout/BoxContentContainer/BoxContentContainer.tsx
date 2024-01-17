import React from 'react';
import './BoxContentContainer.scss';
import { theme } from 'theme';

export interface BoxContentContainerProps {
  backgroundColor?: string;
  minWidth?: number;
  minHeight?: number;
  height?: number;
  width?: number;
  className?: string;
  flexible?: boolean;
}

export const BoxContentContainer: React.FC<BoxContentContainerProps> = ({
  backgroundColor = theme.color.secondary,
  width = 8,
  height = 8,
  className = '',
  flexible = false,
}) => {
  const boxContentContainer: React.CSSProperties = {
    backgroundColor,
    width: flexible ? '100%' : `${width}px`,
    height: flexible ? '100%' : `${height}px`,
  }

  return (
    <div className={`box-content-container ${className}`} style={boxContentContainer}></div>
  )
}

export default BoxContentContainer;