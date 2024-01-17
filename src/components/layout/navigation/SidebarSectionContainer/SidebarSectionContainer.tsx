import React from 'react';
import './SidebarSectionContainer.scss';
import { theme } from 'theme';

interface SidebarSectionContainerProps {
  height?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export const SidebarSectionContainer: React.FC<SidebarSectionContainerProps> = ({
  height,
  backgroundColor = theme.color.primary,
  children,
}) => {
  const sidebarSectionStyle: React.CSSProperties = {
    height,
    backgroundColor,
  }

  return (
    <div className="sidebar-section-container" style={sidebarSectionStyle}>
      {children}
    </div>
  );
};

export default SidebarSectionContainer;