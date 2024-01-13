import React from 'react';
import './BoxContentContainer.scss';
import { theme } from 'theme';

interface BoxContentContainerProps {
  backgroundColor?: string;
  width?: number;
  height?: number;
}

const BoxContentContainer: React.FC<BoxContentContainerProps> = ({
  backgroundColor = theme.color.secondary,
  width,
  height,

}) => {
  const boxContentContainer: React.CSSProperties = {
    backgroundColor,
    width,
    height,
  }

  return (
    <div className="box-content-container" style={boxContentContainer}></div>
  )
}

export default BoxContentContainer;