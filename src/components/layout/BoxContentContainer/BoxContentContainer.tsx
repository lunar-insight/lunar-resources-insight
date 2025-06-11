/**
 * A flexible container component with predefined styling (gradient background, shadow, rounded corners)
 * that can be customized through CSS classes and optional props for dimensions.
 * 
 * @example
 * ```tsx
 * function Example() {
 *   return (
 *     <BoxContentContainer 
 *       className="my-custom-box box-content-container--large"
 *       width={200}
 *       height={100}
 *     >
 *       <p>Content goes here</p>
 *     </BoxContentContainer>
 *   );
 * }
 * ```
 * @param {string} [className] - Additional CSS classes for customization
 * @param {React.ReactNode} [children] - Content to display inside the container
 * @param {number} [width] - Override default width in pixels
 * @param {number} [height] - Override default height in pixels
 * @param {React.CSSProperties} [style] - Additional inline styles if needed
 */

import React from 'react';
import './BoxContentContainer.scss';

export interface BoxContentContainerProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  width?: number;
  style?: React.CSSProperties;
}

export const BoxContentContainer: React.FC<BoxContentContainerProps> = ({
  className = '',
  children,
  width,
  height,
  style,
}) => {
  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width && { width: `${width}px` }),
    ...(height && { height: `${height}px` }),
  };

  return (
    <div 
      className={`box-content-container ${className}`} 
      style={Object.keys(inlineStyles).length > 0 ? inlineStyles : undefined}
    >
      {children}
    </div>
  );
};

export default BoxContentContainer;