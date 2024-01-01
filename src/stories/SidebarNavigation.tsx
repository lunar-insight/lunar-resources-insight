import React from 'react';
import './SidebarNavigation.scss';

interface Icon {
  name: string;
  label: string;
}

interface SidebarNavigationProps {
  backgroundColor?: string;
  hoverColor?: string;
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

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({backgroundColor = 'initial', hoverColor = '#666' }) => {
  const containerStyle: ExtendedCSSProperties = {
    '--hover-color': hoverColor,
  };


  return (
    <div className="sidebar" style={{ backgroundColor }}>
      {icons.map(icon => (
        <div key={icon.label} className="icon-container" style={containerStyle}>
          <div className="icon material-symbols-outlined">
            {icon.name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SidebarNavigation;