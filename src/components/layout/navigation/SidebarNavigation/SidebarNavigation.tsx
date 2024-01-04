import React from 'react';
import './SidebarNavigation.scss';
import { theme } from '../../../../utils/constants/theme.constants';

interface Icon {
  name: string;
  label: string;
}

interface SidebarNavigationProps {
  backgroundColor?: string;
  iconColor?: string;
  hoverColor?: string;
  useGradient?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientColorDegreeDirection?: number;
  useInsetShadow?: boolean;
  insetShadowColor?: string;
  insetShadowBlur?: number;
  withText?: boolean;
  textColor?: string;
}

type ExtendedCSSProperties = React.CSSProperties & {
  '--hover-color'?: string;
  '--inset-shadow-color'?: string;
  '--inset-shadow-blur'?: string;
}

const icons: Icon[] = [
  { name: 'home', label: 'Home' },
  { name: 'layers', label: 'Layers' },
  { name: 'atr', label: 'Minerals' },
  { name: 'lab_research', label: 'Elements' },
  { name: 'frame_inspect', label: 'Inspect' },
  { name: 'settings', label: 'Settings' },
  { name: 'extension', label: 'Plugins' }
];

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  backgroundColor = theme.color.primary,
  iconColor = theme.color.secondary,
  hoverColor = theme.color.neutral,
  useGradient = false,
  gradientColor1 = '#000',
  gradientColor2 = '#fff',
  gradientColorDegreeDirection = 0,
  useInsetShadow = true,
  insetShadowColor = '#000',
  insetShadowBlur = 12,
  withText,
  textColor,
}) => {
  const containerStyle: ExtendedCSSProperties = {
    '--hover-color': hoverColor,
    '--inset-shadow-color': insetShadowColor,
    '--inset-shadow-blur': `${insetShadowBlur}px`,
  };
  const sidebarStyle: React.CSSProperties = {
    background: useGradient ? `linear-gradient(${gradientColorDegreeDirection}deg, ${gradientColor1}, ${gradientColor2})` : backgroundColor,
  }


  return (
    <div className="sidebar" style={sidebarStyle}>
      {icons.map(icon => (
        <div key={icon.label} className={`icon-container ${useInsetShadow ? 'use-inset-shadow' : ''}`} style={containerStyle}>
          <div className="icon material-symbols-outlined" style={{ color: iconColor }}>
            {icon.name}
          </div>
          {withText && <span className="icon-label" style={{ color: textColor }}>{icon.label}</span>}
        </div>
      ))}
    </div>
  );
};

export default SidebarNavigation;