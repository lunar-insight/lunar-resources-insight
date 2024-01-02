import React from 'react';
import './SidebarNavigation.scss';

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
}

type ExtendedCSSProperties = React.CSSProperties & {
  '--hover-color'?: string;
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
  backgroundColor = 'initial',
  iconColor = '#000',
  hoverColor = '#666',
  useGradient = false,
  gradientColor1 = '#000',
  gradientColor2 = '#fff',
  gradientColorDegreeDirection = 0,
}) => {
  const containerStyle: ExtendedCSSProperties = {
    '--hover-color': hoverColor,
  };
  const sidebarStyle: React.CSSProperties = {
    background: useGradient ? `linear-gradient(${gradientColorDegreeDirection}deg, ${gradientColor1}, ${gradientColor2})` : backgroundColor
  }


  return (
    <div className="sidebar" style={sidebarStyle}>
      {icons.map(icon => (
        <div key={icon.label} className="icon-container" style={containerStyle}>
          <div className="icon material-symbols-outlined" style={{ color: iconColor }}>
            {icon.name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SidebarNavigation;