import React from 'react';
import './BoxContentContainer.scss';

export interface BoxContentContainerProps {
  minWidth?: number;
  minHeight?: number;
  height?: number;
  width?: number;
  borderRadius?: number;
  flexible?: boolean;
  backgroundColor?: string;
  useGradient?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientAngle?: number;
  useShadow?: boolean;
  shadowValues?: string;
  shadowBlur?: number;
  shadowColor?: string;
  className?: string;
  children?: React.ReactNode;
}

export const BoxContentContainer: React.FC<BoxContentContainerProps> = ({
  width = 40,
  height = 20,
  borderRadius = 20,
  flexible = false,
  backgroundColor = '#85a2af',
  useGradient = true,
  gradientColor1 = '#85a2af',
  gradientColor2 = '#b6bbc1',
  gradientAngle = 45,
  useShadow = true,
  shadowValues = '0px 0px',
  shadowBlur = 2,
  shadowColor = '#000',
  className = '', // Allow custom styling for other components
  children, // Allow other components to be nested inside
}) => {
  const boxContentContainer: React.CSSProperties = {
    backgroundColor,
    width: flexible ? '100%' : `${width}px`,
    height: flexible ? '100%' : `${height}px`,
    borderRadius: `${borderRadius}px`,
    background: useGradient ? `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})` : backgroundColor,
    boxShadow: useShadow ? `${shadowValues} ${shadowBlur}px ${shadowColor}` : 'none',
  }

  return (
    <div className={`box-content-container ${className}`} style={boxContentContainer}>
      {children}
    </div>
  )
}

export default BoxContentContainer;