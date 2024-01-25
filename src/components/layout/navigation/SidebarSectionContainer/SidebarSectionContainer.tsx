import React from 'react';
import './SidebarSectionContainer.scss';
import { theme } from 'theme';

interface SidebarSectionContainerProps {
  height?: string;
  backgroundColor?: string;
  useGradient?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientAngle?: number;
  children?: React.ReactNode;
}

export const SidebarSectionContainer: React.FC<SidebarSectionContainerProps> = ({
  height,
  backgroundColor = theme.color.primary,
  useGradient = true,
  gradientColor1 = theme.color.primary,
  gradientColor2 = theme.color.neutral,
  gradientAngle = 90,
  children,
}) => {
  const sidebarSectionStyle: React.CSSProperties = {
    height,
    background: useGradient ? `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})` : backgroundColor,
  }

  return (
    <div className="sidebar-section-container" style={sidebarSectionStyle}>
      {children}
    </div>
  );
};

export default SidebarSectionContainer;