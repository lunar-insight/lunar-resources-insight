import React from 'react';
import './SidebarSectionContainer.scss';
import { theme } from 'theme';

interface SidebarSectionContainerProps {
  height?: string;
  backgroundColor?: string;
}

const SidebarSectionContainer: React.FC<SidebarSectionContainerProps> = ({
  height,
  backgroundColor = theme.color.primary,
}) => {
  const sidebarSectionStyle: React.CSSProperties = {
    height,
    backgroundColor,
  }

  return (
    <div className="sidebar-section-container" style={sidebarSectionStyle}></div>
  );
};

export default SidebarSectionContainer;